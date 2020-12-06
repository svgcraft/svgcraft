
source of handtrack.js: https://github.com/victordibia/handtrack.js/blob/master/src/index.js

copied & adapted from https://github.com/tensorflow/tfjs-models/blob/master/coco-ssd/src/index.ts

about 50% of the time is spent in the readPixels invoked by

      const scores = result[0].dataSync()
      const boxes = result[1].dataSync()

For each frame, ~115ms is spent in readPixels invoked to convert back the results described as:
    // model returns two tensors:
    // 1. box classification score with shape of [1, 1917, 90]
    // 2. box location with shape of [1, 1917, 1, 4]
    // where 1917 is the number of box detectors, 90 is the number of classes.
    // and 4 is the four coordinates of the box.
(but replace 90 by 1 class, only "hand").

Can we get this onto the GPU and only retrieve the final best scores?


Also, result of https://github.com/tensorflow/tfjs/issues/102 (running tfjs in webworkers) seems to be not yet used in handtrack.js.

