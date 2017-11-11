const padding = "00000000000";

export function pad(value: string | number, length: number) {
    if (typeof value === "number") {
        value = value + "";
    }

    return padding.substr(0, length - value.length) + value;
}
