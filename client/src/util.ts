import * as React from "react";

export function pure<Props>(func: (props: Props) => JSX.Element) {
    return class extends React.PureComponent<Props> {
        render() {
            return func(this.props);
        }
    };
}

export function sum(ar: number[]) {
    return ar.reduce((a, b) => a + b, 0);
}

export function max(ar: number[]) {
    return ar.reduce((a, b) => Math.max(a, b), 0);
}

export function mean(ar: number[]) {
    return ar.length === 0 ? 0 : sum(ar) / ar.length;
}
