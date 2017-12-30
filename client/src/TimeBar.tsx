import * as React from "react";
import { Frame, msFromFrame } from "picam-common";
import { TimeBarFrames } from "./TimeBarFrames";
import { TimeBarLine } from "./TimeBarLine";
import { msPerDay, viewWidth } from "./constants";

function msFromTimeBarPixels(pixels: number) {
    return (pixels / viewWidth) * msPerDay;
}

function timeBarPixelsFromMs(ms: number) {
    return (ms / msPerDay) * viewWidth;
}

function timeBarPixelsFromFrameIndex(frames: Frame[], index?: number) {
    if (index === undefined || index < 0 || index >= frames.length) {
        return undefined;
    }

    return timeBarPixelsFromMs(msFromFrame(frames[index]));
}

interface TimeBarProps {
    frames: Frame[];
    selected?: number;
    frameClicked(index: number): void;
}

interface TimeBarState {
    hover?: number;
}

export class TimeBar extends React.Component<TimeBarProps, TimeBarState> {

    constructor(props: TimeBarProps) {
        super(props);
        this.state = { };
    }

    setPlaybackHover(pos: number) {
        let hover: number|undefined = undefined;

        const ms = msFromTimeBarPixels(pos);

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

    mouseMove = (e: React.MouseEvent<SVGElement>) => {
        this.setPlaybackHover(e.clientX -
            e.currentTarget.getBoundingClientRect().left);
    }

    mouseLeave = (e: React.MouseEvent<SVGElement>) => {
        this.setState({ hover: undefined });
    }

    mouseDown = (e: React.MouseEvent<SVGElement>) => {
        if (this.state.hover !== undefined) {
            this.props.frameClicked(this.state.hover);
        }
    }

    touchStart = (e: React.TouchEvent<SVGElement>) => {
        this.setPlaybackHover(e.touches[0].clientX -
            e.currentTarget.getBoundingClientRect().left);
        if (this.state.hover !== undefined) {
            this.props.frameClicked(this.state.hover);
        }
    }

    render() {
        const hover = timeBarPixelsFromFrameIndex(this.props.frames, this.state.hover);
        const selected = timeBarPixelsFromFrameIndex(this.props.frames, this.props.selected);

        return (
            <svg 
                width={640} 
                height={20}
                onTouchStart={this.touchStart}
                onMouseMove={this.mouseMove}
                onMouseLeave={this.mouseLeave}
                onMouseDown={this.mouseDown}
            >
                <TimeBarFrames frames={this.props.frames} />
                { 
                    hover !== undefined ? 
                        <TimeBarLine stroke="blue" x={hover}/> :
                        undefined 
                }
                {
                    selected !== undefined ?
                        <TimeBarLine stroke="green" x={selected}/> : undefined
                }
            </svg>
        );
    }
}
