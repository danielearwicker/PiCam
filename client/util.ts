import * as React from "react";

function pure<Props>(func: (props: Props) => JSX.Element) {
    return class extends React.PureComponent<Props> {
        render() {
            return func(this.props);
        }
    }
}
