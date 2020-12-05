"use strict";

function I(id) {
    return document.getElementById(id);
}

let isVideo = false;
let model = null;

const modelParams = {
    flipHorizontal: true,
    maxNumBoxes: 2,
    iouThreshold: 0.5,
    scoreThreshold: 0.6
}

function startVideo() {
    handTrack.startVideo(I("myvideo")).then(function (status) {
        console.log("video started", status);
        if (status) {
            I("updatenote").innerText = "Video started. Now tracking"
            isVideo = true
            runDetection()
        } else {
            I("updatenote").innerText = "Please enable video"
        }
    });
}

function toggleVideo() {
    if (!isVideo) {
        I("updatenote").innerText = "Starting video"
        startVideo();
    } else {
        I("updatenote").innerText = "Stopping video"
        handTrack.stopVideo(I("myvideo"))
        isVideo = false;
        I("updatenote").innerText = "Video stopped"
    }
}

let showHandboxes = false;

function placeArms(predictions) {
    I("arm0").style.display = "none";
    I("arm1").style.display = "none";
    I("handbox0").style.display = "none";
    I("handbox1").style.display = "none";
    for (var i = 0; i < predictions.length; i++) {
        const arm = I("arm" + i);
        arm.style.display = "";
        arm.setAttribute("x2", predictions[i].bbox[0] + predictions[i].bbox[2] / 2);
        arm.setAttribute("y2", predictions[i].bbox[1] + predictions[i].bbox[3] / 2);
        
        if (showHandboxes) {
            const handbox = I("handbox" + i);
            handbox.style.display = "";
            handbox.setAttribute("x", predictions[i].bbox[0]);
            handbox.setAttribute("y", predictions[i].bbox[1]);
            handbox.setAttribute("width", predictions[i].bbox[2]);
            handbox.setAttribute("height", predictions[i].bbox[3]);
        }
    }
}

function runDetection() {
    model.detect(I("myvideo")).then(predictions => {
        console.log("predictions: ", predictions);
        const context = I("canvas").getContext("2d");
        model.renderPredictions(predictions, I("canvas"), context, I("myvideo"));
        placeArms(predictions);
        if (isVideo) {
            requestAnimationFrame(runDetection);
        }
    });
}

handTrack.load(modelParams).then(lmodel => {
    model = lmodel
    I("updatenote").innerText = "Loaded Model!"
    I("trackbutton").disabled = false
});
