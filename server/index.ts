import * as fs from "mz/fs";
import * as path from "path";
import { promisify } from "util";
import { spawn } from "child_process";
import * as log4js from "log4js";
import * as express from "express";
import * as Koa from "koa";
import * as Router from "koa-router";
import * as koaStatic from "koa-static";
import { Frame } from "../common/api";
import { pad } from "../common/pad";

const rootDir = path.normalize(path.join(__dirname, "..", ".."));
const dataDir = path.normalize(path.join(rootDir, "data"));
const staticDir = path.normalize(path.join(rootDir, "..", "client"));

const router = new Router();

router.get('/version', async ctx => {
    ctx.body = {
        version: "0.1.0",
        __dirname,
        rootDir,
        dataDir,
        staticDir
    };
});

router.get('/cameras', async ctx => {
    ctx.body = (await fs.readdir(dataDir)).filter(n => n[0] !== '.');
});

interface CameraContext extends Router.IRouterContext {
    params: {
        device: string;
        year: string;
        month: string;
        date: string;
    },
    query: {
        threshold: string;
    }
}

router.get('/camera/:device/:year/:month/:date', async (ctx: CameraContext) => {

    const { device, year, month, date } = ctx.params;
    const threshold = parseInt(ctx.query.threshold || "1", 10);

    const frameFiles = await fs.readdir(path.join(
        dataDir, device, "archive", 
        pad(year, 4), pad(month, 2), pad(date, 2)));

    ctx.body = frameFiles.map(parseFrameName)
                         .filter(f => f && f.motion >= threshold);
});

interface FrameContext extends Router.IRouterContext {
    params: {
        device: string;
        year: string;
        month: string;
        date: string;
        hour: string;
        minute: string;
        second: string;
        ms: string;
        motion: string;
        counter: string;
    }
}

router.get('/frame/:device/:year/:month/:date/:hour/:minute/:second/:ms/:motion/:counter', async (ctx: FrameContext) => {

    const { device, year, month, date, hour, minute, second, ms, motion, counter } = ctx.params;

    const frameDir = path.join(dataDir, device, "archive", pad(year, 4), pad(month, 2), pad(date, 2));
    const time = `${pad(hour, 2)}-${pad(minute, 2)}-${pad(second, 2)}-${pad(ms, 3)}`;

    let full = path.join(frameDir, `${time}-${pad(motion, 5)}-${pad(counter, 9)}.jpg`);

    if (!await fs.exists(full)) {
        full = path.join(frameDir, `${time}-${pad(counter, 9)}.jpg`);
    }

    ctx.type = "image/jpg";
    ctx.body = await fs.readFile(full); 
});

function parseFrameName(name: string): Frame | undefined {
    if (name[0] === '.') {
        return;
    }
    const hour = parseInt(name.substr(0, 2), 10),
          minute = parseInt(name.substr(3, 2), 10),
          second = parseInt(name.substr(6, 2), 10),
          ms = parseInt(name.substr(9, 3), 10);    
    if (isNaN(hour) || isNaN(minute) || isNaN(second) || isNaN(ms)) {
        return;
    }

    const hasMotion = name[18] == '-';
    const motion = hasMotion ? parseInt(name.substr(13, 5), 10) : 20;
    const frame = parseInt(name.substr(hasMotion ? 19 : 13, 9), 10);    
    if (isNaN(motion) || isNaN(frame)) {
        return;
    }
    return { hour, minute, second, ms, frame, motion };
}

new Koa().use(router.routes())
         .use(router.allowedMethods())
         .use(koaStatic(staticDir))
         .listen(3030);

log4js.configure({
    appenders: [{ 
        type: "file",
        level: "ALL",
        category: "ffmpeg",
        filename: "logs/ffmpeg.log",
        maxLogSize: 10000000
    }, {
        type: "stdout",
        level: "INFO",
        category: "chatter"
    }]
});

var log = log4js.getLogger("chatter");
log.setLevel(log4js.levels.ALL);
log.info("Starting");

var logFfmpeg = log4js.getLogger("ffmpeg");
logFfmpeg.setLevel(log4js.levels.ALL);
logFfmpeg.info("Starting");

async function removeAll(fileOrDir: string) {

    if (!await fs.exists(fileOrDir)) {
        return;
    }

    log.info(`Removing ${fileOrDir}`);

    const s = await fs.stat(fileOrDir);
    if (s.isDirectory()) {
        for (const child of await fs.readdir(fileOrDir)) {
            await removeAll(path.join(fileOrDir, child));
        }

    } else {
        await fs.unlink(fileOrDir);
    } 
}

async function createIfNeeded(dir: string) {

    if (!await fs.exists(dir)) {
        log.info(`Creating ${dir}`);
        await fs.mkdir(dir);
    }
}

function sleep(ms: number) {
    return new Promise<void>(done => setTimeout(done, ms));
}

async function startup(...devices: string[]) {

    await createIfNeeded(dataDir);

    for (const device of devices) {
        const flatDeviceName = device.replace(/\//g, "_");

        const deviceDir = path.join(dataDir, flatDeviceName);
        await createIfNeeded(deviceDir);

        monitorInput(device, deviceDir).then(() => {
            log.info(`monitor for ${device} stopped cleanly`);
        }, err => {
            log.error(`monitor for ${device} stopped with error`, err);
        });
    }
}

function captureDevice(inputDevice: string, outputDir: string) {

    const outputFilePattern = path.join(outputDir, "%09d.jpg");

    const debugLog = (b: Buffer) => logFfmpeg.debug(b.toString());

    return new Promise<void>((done, fail) => {
        const child = spawn("ffmpeg", 
            ["-i", inputDevice,
             "-qscale:v", "3",
             "-vf", "fps=5",
             outputFilePattern]);

        child.stdout.on("data", debugLog);
        child.stderr.on("data", debugLog);

        child.on("error", fail);
        child.on("close", code => done());
    });
}

function getDistance(fuzzy1: Buffer, fuzzy2: Buffer) {

    const l = fuzzy1.length;
    if (l != fuzzy2.length) {
        log.error("Warning: fuzzy buffers different lengths");
        return 0;
    }

    let sumOfSquares = 0;
    for (let i = 0; i < l; i++) {
        const diff = fuzzy1[i] - fuzzy2[i];
        sumOfSquares += diff * diff;
    }

    return Math.sqrt(sumOfSquares);
}

function getFuzzy(inputFile: string) {

    const buffers: Buffer[] = [];

    return new Promise<Buffer>((done, fail) => {
        const child = spawn("ffmpeg",
            ["-i", inputFile,
             "-s", "8x6",
             "-pix_fmt", "gray",
             "-f", "rawvideo",
             "pipe:1"]);

        child.on("error", fail);
        child.on("close", code => done(
            buffers.length == 1 ? buffers[0] : Buffer.concat(buffers))
        );
        child.stdout.on("data", data => {
            if (data instanceof Buffer) {
                buffers.push(data);
            }
        });
    });
}

async function archive(bufferDir: string, archiveDir: string) {

    let lastFuzzy: Buffer|undefined = undefined;

    let counter = 1;
    for (;;) {

        const bufferName = pad(counter, 9) + ".jpg";
        const bufferFile = path.join(bufferDir, bufferName);

        const nextFile = path.join(bufferDir, pad(counter + 1, 9) + ".jpg");

        if (await fs.exists(nextFile)) {

            const newFuzzy = await getFuzzy(bufferFile);
            const distance = !lastFuzzy ? 0 : Math.round(getDistance(lastFuzzy, newFuzzy));
            lastFuzzy = newFuzzy;

            if (distance > 20) {
                const now = (await fs.stat(bufferFile)).ctime;

                const yearDir = path.join(archiveDir, now.getFullYear() + "");
                await createIfNeeded(yearDir);

                const monthDir = path.join(yearDir, pad(now.getMonth() + 1, 2));
                await createIfNeeded(monthDir);

                const dayDir = path.join(monthDir, pad(now.getDate(), 2));
                await createIfNeeded(dayDir);

                const h = pad(now.getHours(), 2),
                    m = pad(now.getMinutes(), 2),
                    s = pad(now.getSeconds(), 2),
                    f = pad(now.getMilliseconds(), 3),
                    d = pad(distance, 5),
                    fileName = `${h}-${m}-${s}-${f}-${d}-${bufferName}`;

                await fs.rename(bufferFile, path.join(dayDir, fileName));

            } else {

                await fs.unlink(bufferFile);
            }

            counter++;
            continue;
        }

        await sleep(500);        
    }
}

async function monitorInput(device: string, dataDir: string) {

    const bufferDir = path.join(dataDir, "buffer");
    const archiveDir = path.join(dataDir, "archive");

    await removeAll(bufferDir);

    await createIfNeeded(bufferDir);
    await createIfNeeded(archiveDir);

    return Promise.all([
        captureDevice(device, bufferDir),
        archive(bufferDir, archiveDir)
    ]);
}

startup("/dev/video0");
