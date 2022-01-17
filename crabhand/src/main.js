// adapted from https://github.com/handtracking-io/yoha/blob/ce7be6371231414adddf5acc29df77a262bc47ab/src/demos/draw/entry.ts
// import {VideoLayer, PointLayer, DynamicPathLayer, LayerStack, LandmarkLayer, FpsLayer} from '../../util/layers'
// import {CreateEngine, MediaStreamErrorEnum, EventEnum} from '../../util/engine_helper'
// import {IsMobile} from '../../util/mobile_detect'
// import {ExponentialMovingAverage} from '../../util/ema'

const BORDER_PADDING_FACTOR = 0.05;
const VIDEO_WIDTH_FACTOR = 0.66;

function ScaleResolutionToWidth(resolution, width) {
  const cw = resolution.width;
  const ch = resolution.height;
  const tw = width;
  return {
    width: tw,
    height: ch / (cw / tw),
  };
}

async function main() {
  await window.LoadHandtrackingApi("TESTURL");
  const engine = await CreateEngine();
  await engine.DownloadModel(progress => {
    document.getElementById('progress').innerText = `${Math.round(progress * 100)}%`;
  });

  engine.Configure({
    // Webcam video is usually flipped so we want the coordinates to be flipped as well.
    flipX: true,
    // Crop away a small area at the border to prevent the user to move out of view
    // when reaching for border areas on the canvas.
    padding: BORDER_PADDING_FACTOR,
  });

  document.getElementById("warmup").style.display = '';
  await engine.Warmup();
  document.getElementById("camera").style.display = '';

  // Create a video stream. This will ask the user for camera access.
  const src = await engine.SetUpCameraTrackSource();

  if (src.error) {
    if (src.error === MediaStreamErrorEnum.NOT_ALLOWED_ERROR) {
      LogError("You denied camera access. Refresh the page if this was a mistake and you'd like to try again.")
      return;
    } else if (src.error === MediaStreamErrorEnum.NOT_FOUND_ERROR) {
      LogError("No camera found. For the handtracking to work you need to connect a camera. Refresh the page to try again.")
      return;
    } else {
      LogError(`Something went wrong when trying to access your camera (${src.error}) You may try again by refreshing the page.`);
      return;
    }
  }

  document.getElementById('logs').style.display = 'none'

  let width = src.video.width;
  let height = src.video.height;

  // Scale up/down to desired size...
  const targetWidth = window.innerWidth * VIDEO_WIDTH_FACTOR;
  ({width, height} = ScaleResolutionToWidth({width, height}, targetWidth));

  engine.Start((e) => {
    if (e.type === EventEnum.RESULT) {
      console.log(e.coordinates);
      // Uncomment to hide video upon detection.
      // videoLayer.FadeOut();
    } else if (e.type === EventEnum.LOST) {
      // Uncomment to show video upon loosing the hand.
      // videoLayer.FadeIn();
    }
  });
}

function LogError(error) {
  document.getElementById("error").innerText = error;
}

document.addEventListener("DOMContentLoaded", main);
