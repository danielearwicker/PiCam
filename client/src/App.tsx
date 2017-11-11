import * as React from 'react';
import './App.css';
import { VideoArchive, CameraSelection, VideoPlayerModel } from "./models";
import { VideoPlayer } from "./VideoPlayer";

const videoArchive = new VideoArchive();
const cameraSelection = new CameraSelection(videoArchive);
const videoPlayer = new VideoPlayerModel(cameraSelection);

class App extends React.Component {
  render() {
    return (
      <VideoPlayer model={videoPlayer}/>
    );
  }
}

export default App;
