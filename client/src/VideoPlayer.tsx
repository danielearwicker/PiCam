import * as React from "react";
import { pad } from "../../common/pad";
import { TimeBar } from "./TimeBar";
import { TextInput } from "bidi-mobx";
import { VideoPlayerModel } from "./models";
import { observer } from "mobx-react";

export const VideoPlayer = observer(({model}: {
    model: VideoPlayerModel;
}) => {

    const dayNav = (
        <div>
            <button onClick={model.decrDay}>Previous day</button>
            <TextInput value={model.day} />            
            <button onClick={model.incrDay}>Next day</button>
        </div>
    );

    if (!model.currentFrame) {
        return (
            <div>
                {dayNav}
                <div>No frames have been saved yet</div>
            </div>
        );
    }

    const { hour, minute, second, ms } = model.currentFrame;

    return (
        <div>
            {dayNav}
            <img width="640" height="480" src={model.frameSrc}/>
            <div>
                <TimeBar frames={model.frames} 
                         selected={model.neededFrameIndex}
                         frameClicked={model.frameClicked}/>
            </div>
            <div>
                <button onClick={model.togglePause}>{model.paused ? "Play" : "Pause"}</button>
                { 
                    model.paused ? (
                        <span>
                            <button onClick={model.decrFrame}>&lt;</button>
                            <button onClick={model.incrFrame}>&gt;</button>
                        </span>
                    ) : undefined 
                }
                <span>{pad(hour, 2)}:{pad(minute, 2)}:{pad(second, 2)}:{pad(ms, 3)}</span>
            </div>
        </div>
    );
});

