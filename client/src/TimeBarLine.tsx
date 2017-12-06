import * as React from "react";
import { pure } from "./util";

interface TimeBarLineProps {
    x: number;
    stroke: string;
    height?: number;
}

export const TimeBarLine = pure(({ x, stroke, height }: TimeBarLineProps) => {
    if (height === undefined) {
        height = 1;
    }
    return <line key={x} x1={x} y1={(1-height)*20} x2={x} y2={20} stroke={stroke}/>;
});
