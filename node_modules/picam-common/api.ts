
export interface Frame {
    hour: number;
    minute: number;
    second: number;
    ms: number;
    frame: number;
    motion: number;
}

export function msFromFrame(frame: Frame) {
    return (((((frame.hour * 60) + frame.minute) * 60) + frame.second) * 1000) + frame.ms;
}