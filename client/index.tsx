import * as React from "react";
import * as ReactDOM from "react-dom";
import { Frame } from "../common/api";
import { pad } from "../common/pad";

function pure<Props>(func: (props: Props) => JSX.Element) {
  return class extends React.PureComponent<Props> {
    render() {
      return func(this.props);
    }
  }  
}

const viewWidth = 640;
const viewHeight = (viewWidth / 4) * 3;

function getDayPath(day: Date) {
    return `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`;
}

async function getFrames(camera: string, day: Date, threshold = 20) {
    const uri = `camera/${camera}/${getDayPath(day)}`;
    const frames = (await (await fetch(uri)).json()) as Frame[];
    frames.sort(compareFrames);
    return frames;
}

function msFromFrame(frame: Frame) {
    return (((((frame.hour * 60) + frame.minute) * 60) + frame.second) * 1000) + frame.ms;
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

interface TimeBarProps {
    frames: Frame[];
    selected?: number;
    frameClicked(index: number): void;
}

interface TimeBarState {
    hover?: number;
}

class TimeBar extends React.Component<TimeBarProps, TimeBarState> {

    constructor(props: TimeBarProps) {
        super(props);
        this.state = { };
    }

    mouseMove = (e: React.MouseEvent<SVGElement>) => {
        let hover: number|undefined = undefined;

        const ms = msFromTimeBarPixels(e.clientX - 
            e.currentTarget.getBoundingClientRect().left);

        const l = this.props.frames.length;
        for (let f = 0; f < l; f++) {
            const frame = this.props.frames[f];
            const frameMs = msFromFrame(frame);
            if (ms <= frameMs) {
                hover = f;
                break;
            }
        }

        if (hover === undefined && l > 0) {
            hover = 0;
        }

        this.setState({ hover });
    }

    mouseLeave = (e: React.MouseEvent<SVGElement>) => {
        this.setState({ hover: undefined });
    }

    mouseDown = (e: React.MouseEvent<SVGElement>) => {
        if (this.state.hover !== undefined) {
            this.props.frameClicked(this.state.hover);
        }
    }

    render() {
        const hover = timeBarPixelsFromFrameIndex(this.props.frames, this.state.hover);
        const selected = timeBarPixelsFromFrameIndex(this.props.frames, this.props.selected);

        return (
            <svg width={640} height={20}
                onMouseMove={this.mouseMove}
                onMouseLeave={this.mouseLeave}
                onMouseDown={this.mouseDown}>
                <TimeBarFrames frames={this.props.frames} />
                { hover !== undefined ? <TimeBarLine stroke="blue" x={hover}/> : undefined }
                { selected !== undefined ? <TimeBarLine stroke="green" x={selected}/> : undefined }
            </svg>
        );
    }
}

interface AppState {
    cameras: string[];
    camera?: string;
    day: Date;
    frames: Frame[];
    frameIndex: number;
    frameSrc?: string;
}

class App extends React.Component<{}, AppState> {

    constructor() {
        super();
        this.state = { 
            day: new Date(),
            cameras: [],
            frames: [],
            frameIndex: 0
        };
    }

    componentDidMount() {
        this.init();
    }

    async init() {
        const cameras = await (await fetch("cameras")).json() as string[];
        const camera = cameras[0];
        this.setState({ cameras, camera });

        const frames = await getFrames(camera, this.state.day);
        const frameIndex = 0;
        this.setState({ frames, frameIndex });

        await this.loadFrame();
    }

    async loadFrame() {
        const camera = this.state.camera,
              day = getDayPath(this.state.day),
              info = this.state.frames[this.state.frameIndex],
              { hour, minute, second, ms, motion, frame } = info,
              path = `${hour}/${minute}/${second}/${ms}/${motion}/${frame}`,
              blob = await (await fetch(`frame/${camera}/${day}/${path}`)).blob();

        if (this.state.frameSrc) {
            URL.revokeObjectURL(this.state.frameSrc);
        }
        this.setState({ frameSrc: URL.createObjectURL(blob) });
    }

    step(incr: number) {
        const frameIndex = this.state.frameIndex + incr;
        if (frameIndex >= 0 && frameIndex < this.state.frames.length) {
            this.setState({ frameIndex });
            this.loadFrame();
        }
    }

    frameClicked = (frameIndex: number) => {
        this.setState({ frameIndex });
        this.loadFrame();
    }

    render() {
        const frame = this.state.frames[this.state.frameIndex];
        if (!frame) {
            return <div></div>;
        }

        const { hour, minute, second, ms, motion } = frame;

        return (
            <div>
                <img width="640" height="480" src={this.state.frameSrc}/>
                <div>
                    <TimeBar frames={this.state.frames} 
                             selected={this.state.frameIndex}
                             frameClicked={this.frameClicked}/>
                </div>
                <div>
                    <button onClick={() => this.step(-1)}>&lt;</button>
                    <button onClick={() => this.step(1)}>&gt;</button>
                    <span>{ this.state.day.toDateString() } </span>
                    <span>{pad(hour, 2)}:{pad(minute, 2)}:{pad(second, 2)}:{pad(ms, 3)}</span>
                </div>                
            </div>
        );
    }
}

ReactDOM.render(<App/>, document.querySelector("#root")!);
