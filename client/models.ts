import { observable, action, computed, runInAction } from "mobx";
import { Frame, msFromFrame } from "../common/api";
import { sleep } from "../common/sleep";
import { pad } from "../common/pad";
import { field } from "bidi-mobx";

function getDayPath(day: Date) {
    return `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`;
}

function compareFrames(f1: Frame, f2: Frame) {
    return msFromFrame(f1) - msFromFrame(f2);
}

async function loadFrameImage(camera: string, day: Date, info: Frame) {

    const dayPath = getDayPath(day),
        { hour, minute, second, ms, motion, frame } = info,
        path = `${hour}/${minute}/${second}/${ms}/${motion}/${frame}`;

    return await (await fetch(`frame/${camera}/${day}/${path}`)).blob();
}

const dayAsString = {
    render(now: Date) {
        return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDay(), 2)}`;
    },
    parse(str: string) {
        const parts = str.split("-");
        if (parts.length === 3) {        
            const year = parseInt(parts[0], 10),
                 month = parseInt(parts[1], 10) - 1,
                  date = parseInt(parts[2], 10);

            const day = new Date(year, month, date);
            if (day <= new Date() && day > new Date(2017, 7, 1)) {
                return day;
            }
        }
    }
};

export class DayFrames {

    @observable frames: Frame[] = [];

    constructor(
        public readonly camera: CameraArchive,
        public readonly day: Date
    ) {
        this.fetch();
    }

    @action
    append(frames: Frame[]) {
        this.frames = this.frames.concat(frames);
    }

    async fetch() {
        while (new Date().getTime() < (this.day.getTime() + (24 * 60 * 60 * 1000))) {
            if (new Date().getTime() > this.day.getTime()) {

                let uri = `camera/${this.camera.name}/${getDayPath(this.day)}`;
                const lastFrame = this.frames[this.frames.length - 1];
                if (lastFrame) {
                    uri += "?after=" + JSON.stringify(lastFrame);
                }

                try {
                    const frames = (await (await fetch(uri)).json()) as Frame[];
                    if (frames.length) {
                        frames.sort(compareFrames);
                        this.append(frames);                
                    }


                } catch (x) { }
            }
        }

        await sleep(1000);
    }
}

export class CameraArchive {

    private readonly days = observable.map<DayFrames>();
    
    constructor(public readonly name: string) {}

    getDay(day: Date) {
        const key = getDayPath(day);
        const existing = this.days.get(key);
        if (existing) {
            existing;
        }
        const created = new DayFrames(this, day);
        this.days.set(key, created);
        return created;
    }
}

export class VideoArchive {

    @observable cameras: CameraArchive[] = [];

    constructor() {
        this.load();
    }

    private async load() {        
        this.init(await (await fetch("cameras")).json());
    }

    @action
    private init(cameras: string[]) {
        this.cameras = cameras.map(c => new CameraArchive(c));
    }
}

export class CameraSelection {

    constructor(public readonly archive: VideoArchive) {}

    @observable private _currentCamera: CameraArchive | undefined;

    @computed get currentCamera() {
        return this._currentCamera || 
               !!this.archive.cameras.length && this.archive.cameras[0] ||
               undefined;
    }
    
    @computed get currentCameraName() {
        return (this.currentCamera && this.currentCamera.name) || "";
    }
    set currentCameraName(name: string) {
        this._currentCamera = this.archive.cameras.find(c => c.name === name);
    }
}

export class VideoPlayer {

    constructor(public readonly cameraSelection: CameraSelection) {
        this.play();
    }

    day = field(dayAsString).create(new Date());

    @computed get currentDay() {
        const camera = this.cameraSelection.currentCamera;
        if (this.day.model && camera) {
            return camera.getDay(this.day.model);
        }
        return undefined;
    }

    @computed get frames() {
        return this.currentDay && this.currentDay.frames || [];
    }

    @observable neededFrameIndex = -1;
    @observable private loadedFrameIndex = -1;
    @observable frameSrc: string;
    @observable paused = false;

    @computed get currentFrame() {
        const frameIndex = Math.min(this.neededFrameIndex, this.frames.length - 1) || 0;
        return frameIndex >=0 && this.frames[frameIndex];
    }

    @action
    stepDay(incr: 1 | -1) {
        if (!this.day.model) {
            this.day.model = new Date();
        } else {
            var day = new Date(this.day.model.getTime());
            day.setDate(day.getDate() + incr);
            this.day.model = day;
        }
    }

    incrDay = () => this.stepDay(1);
    decrDay = () => this.stepDay(-1);

    @action
    stepFrame(incr: 1 | -1) {
        if (!this.currentDay) {
            return;
        }
        const i = this.neededFrameIndex + incr;
        if (i >= 0 && i < this.currentDay.frames.length) {
            this.neededFrameIndex = i;
        }
    }

    incrFrame = () => this.stepFrame(1);
    decrFrame = () => this.stepFrame(-1);

    @action.bound
    togglePause() {
        if (this.loadedFrameIndex) {
            this.loadedFrameIndex--;
        }
        this.paused = !this.paused;
    }

    @action.bound
    frameClicked(frameIndex: number) {
        this.neededFrameIndex = frameIndex;
    }

    private async play() {

        for (;;) {
            await sleep(10);

            const day = this.currentDay;
            const camera = this.cameraSelection.currentCamera;
            if (!day || !camera) {
                await sleep(100);
                continue;
            }                
            if (this.neededFrameIndex === -1 && day.frames.length) {
                runInAction(() => this.neededFrameIndex = day.frames.length - 1);
            }

            if (this.neededFrameIndex >= day.frames.length ||
                this.loadedFrameIndex === this.neededFrameIndex) {

                await sleep(250);
                continue;
            }

            try {                    
                const blob = await loadFrameImage(
                    camera.name, day.day, day.frames[this.neededFrameIndex]
                );

                if (this.frameSrc) {
                    URL.revokeObjectURL(this.frameSrc);
                }

                runInAction(() => {
                    this.loadedFrameIndex = this.neededFrameIndex;
                    this.frameSrc = URL.createObjectURL(blob);
                    this.neededFrameIndex += (this.paused ? 0 : 1)
                });

            } catch (x) { }            
        }
    }
}
