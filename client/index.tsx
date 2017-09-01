import * as React from "react";
import * as ReactDOM from "react-dom";
import { Frame, msFromFrame } from "../common/api";
import { pad } from "../common/pad";
import { sleep } from "../common/sleep";
import { TimeBar } from "./TimeBar";

function getDayPath(day: Date) {
    return `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`;
}

function compareFrames(f1: Frame, f2: Frame) {
    return msFromFrame(f1) - msFromFrame(f2);
}

interface AppState {
    cameras: string[];
    camera?: string;
    day: Date;
    dayString: string;
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
            dayString: "",
            cameras: [],
            frames: [],
            frameIndex: 0,
            paused: false
        };
    }

    componentDidMount() {
        this.init();
    }

    updateDayString() {

        const year = this.state.day.getFullYear(),
              month = this.state.day.getMonth() + 1,
              date = this.state.day.getDate();

        this.setState({
            dayString: `${pad(year, 4)}-${pad(month, 2)}-${pad(date, 2)}`,
            frames: []
        });
    }

    dayStringChanged = () => {
        return (ev: React.ChangeEvent<HTMLInputElement>) => {

            const parts = ev.target.value.split("-");
            if (parts.length == 3) {
                this.setState({
                    day: new Date(
                        parseInt(parts[0], 10), 
                        parseInt(parts[1], 10) - 1, 
                        parseInt(parts[2], 10))
                });
            }

            this.updateDayString();
        }
    }

    async init() {
        this.updateDayString();

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

    step = (unit: "day" | "frame", incr: 1 | -1) => {
        return () => {
            switch (unit) {
                case "frame":
                    const frameIndex = this.state.frameIndex + incr;
                    if (frameIndex >= 0 && frameIndex < this.state.frames.length) {
                        this.setState({ frameIndex });
                    }
                    break;
                case "day":
                    var day = new Date(this.state.day.valueOf());
                    day.setDate(day.getDate() + incr);                    
                    this.setState({ day });
                    this.updateDayString();
                    break;
            }
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

        const dayNav = (
            <div>
                <button onClick={this.step("day", -1)}>Previous day</button>
                <input value={this.state.dayString} onChange={this.dayStringChanged}></input>
                <button onClick={this.step("day", 1)}>Next day</button>
            </div>
        );

        const frameIndex = Math.min(this.state.frameIndex, this.state.frames.length - 1);
        const frame = this.state.frames[frameIndex];
        if (!frame) {
            return (
                <div>
                    {dayNav}
                    <div>No frames have been saved yet</div>
                </div>
            );
        }

        const { hour, minute, second, ms, motion } = frame;

        return (
            <div>
                {dayNav}
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
                            <button onClick={this.step("frame", -1)}>&lt;</button>
                            <button onClick={this.step("frame", 1)}>&gt;</button>
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
