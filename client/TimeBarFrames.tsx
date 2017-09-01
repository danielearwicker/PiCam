import * as React from "react";
import { Frame, msFromFrame } from "../common/api";
import { pure, mean, max } from "./util";
import { TimeBarLine } from "./TimeBarLine";

export const TimeBarFrames = pure(({ frames }: { frames: Frame[] }) => {
    
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
