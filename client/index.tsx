import * as React from "react";
import * as ReactDOM from "react-dom";
import { Frame, msFromFrame } from "../common/api";
import { pad } from "../common/pad";
import { sleep } from "../common/sleep";

const viewWidth = 640;
const viewHeight = (viewWidth / 4) * 3;

function getDayPath(day: Date) {
    return `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`;
}

function compareFrames(f1: Frame, f2: Frame) {
    return msFromFrame(f1) - msFromFrame(f2);
}

const msPerDay = 86400000;
const barWidth = 2;
const barWidthMs = barWidth * (msPerDay / viewWidth);

function timeBarPixelsFromMs(ms: number) {
    return (ms / msPerDay) * viewWidth;
}

function timeBarPixelsFromFrameIndex(frames: Frame[], index?: number) {
    if (index == undefined || index < 0 || index >= frames.length) {
        return undefined;
    }

    return timeBarPixelsFromMs(msFromFrame(frames[index]));
}

function msFromTimeBarPixels(pixels: number) {
    return (pixels / viewWidth) * msPerDay;
}

interface TimeBarLine {
    x: number;
    stroke: string;
    height?: number;
}

const TimeBarLine = pure(({ x, stroke, height }: TimeBarLine) => {
    if (height === undefined) {
        height = 1;
    }
    return <line key={x} x1={x} y1={(1-height)*20} x2={x} y2={20} stroke={stroke}/>;
});

function sum(ar: number[]) {
    return ar.reduce((a, b) => a + b, 0);
}

function max(ar: number[]) {
    return ar.reduce((a, b) => Math.max(a, b), 0);
}

function mean(ar: number[]) {
    return ar.length === 0 ? 0 : sum(ar) / ar.length;
}

const TimeBarFrames = pure(({ frames }: { frames: Frame[] }) => {

    const bars: Frame[][] = [];
    const barWidthPixels = barWidthMs / (msPerDay / viewWidth);
    const barCount = viewWidth / barWidthPixels;

    bars.length = barCount;
    for (let n = 0; n < barCount; n++) {
        bars[n] = [];
    }

    for (const frame of frames) {
        const bar = Math.floor(msFromFrame(frame) / barWidthMs);
        if (bar < 0 || bar >= barCount) {
            debugger;
        }
        bars[bar].push(frame);
    }

    const means = bars.map(bar => mean(bar.map(f => f.motion)));
    const maxMean = max(means);

    return (
        <svg>
        {
            means.map((bar, i) => {
                const x = i * barWidthPixels;
                return <TimeBarLine key={x} stroke="silver" x={x} height={bar / maxMean}/>
            })
        }
        </svg>
    );
});


interface AppState {
    cameras: string[];
    camera?: string;
    day: Date;
    frames: Frame[];
    frameIndex: number;
    frameSrc?: string;
    paused: boolean;
}

class App extends React.Component<{}, AppState> {

    loadedFrame?: number;
    
    constructor() {
        super();
        this.state = { 
            day: new Date(),
            cameras: [],
            frames: [],
            frameIndex: 0,
            paused: false
        };
    }

    componentDidMount() {
        this.init();
    }

    async init() {
        const cameras = await (await fetch("cameras")).json() as string[];
        const camera = cameras[0];
        this.setState({ cameras, camera });

        this.pullFrames();
        this.pullImages();
    }

    async pullFrames() {

        for (;;) {
            if (this.state.camera) { 
                
                let uri = `camera/${this.state.camera}/${getDayPath(this.state.day)}`;
                const lastFrame = this.state.frames[this.state.frames.length - 1];
                if (lastFrame) {
                    uri += "?after=" + JSON.stringify(lastFrame);
                }

                const frames = (await (await fetch(uri)).json()) as Frame[];
                if (frames.length) {
                    frames.sort(compareFrames);
                    this.setState({ frames: this.state.frames.concat(frames) });
                }
            }

            await sleep(1000);
        }
    }

    async pullImages() {

        for (;;) {

            if (this.loadedFrame === undefined && this.state.frames.length) {
                this.setState({ frameIndex: this.state.frames.length - 1 });
            }

            if (this.state.frameIndex >= this.state.frames.length ||
                this.loadedFrame === this.state.frameIndex) {

                await sleep(250);
                continue;
            }

            const camera = this.state.camera,
                day = getDayPath(this.state.day),
                info = this.state.frames[this.state.frameIndex],
                { hour, minute, second, ms, motion, frame } = info,
                path = `${hour}/${minute}/${second}/${ms}/${motion}/${frame}`,
                blob = await (await fetch(`frame/${camera}/${day}/${path}`)).blob();

            if (this.state.frameSrc) {
                URL.revokeObjectURL(this.state.frameSrc);
            }

            this.loadedFrame = this.state.frameIndex;

            this.setState({ 
                frameSrc: URL.createObjectURL(blob),
                frameIndex: this.state.frameIndex + (this.state.paused ? 0 : 1)
            });            
        }
    }

    step(incr: number) {
        const frameIndex = this.state.frameIndex + incr;
        if (frameIndex >= 0 && frameIndex < this.state.frames.length) {
            this.setState({ frameIndex });
        }
    }

    togglePause() {
        if (this.loadedFrame) {
            this.loadedFrame--;
        }
        this.setState({ paused: !this.state.paused });
    }

    frameClicked = (frameIndex: number) => {
        this.setState({ frameIndex });
    }

    render() {
        const frameIndex = Math.min(this.state.frameIndex, this.state.frames.length - 1);
        const frame = this.state.frames[frameIndex];
        if (!frame) {
            return <div>No frames have been saved yet</div>;
        }

        const { hour, minute, second, ms, motion } = frame;

        return (
            <div>
                <img width="640" height="480" src={this.state.frameSrc}/>
                <div>
                    <TimeBar frames={this.state.frames} 
                             selected={frameIndex}
                             frameClicked={this.frameClicked}/>
                </div>
                <div>
                    <button onClick={() => this.togglePause()}>{this.state.paused ? "Play" : "Pause"}</button>
                    { this.state.paused ? (
                        <span>
                            <button onClick={() => this.step(-1)}>&lt;</button>
                            <button onClick={() => this.step(1)}>&gt;</button>
                        </span>
                    ) : undefined }
                    <span>{ this.state.day.toDateString() } </span>
                    <span>{pad(hour, 2)}:{pad(minute, 2)}:{pad(second, 2)}:{pad(ms, 3)}</span>
                </div>                
            </div>
        );
    }
}

ReactDOM.render(<App/>, document.querySelector("#root")!);
