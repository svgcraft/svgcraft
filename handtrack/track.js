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

let showArms = false;
let showHandboxes = false;
let showHands = true;

function placeArms(predictions) {
    I("arm0").style.display = "none";
    I("arm1").style.display = "none";
    I("handbox0").style.display = "none";
    I("handbox1").style.display = "none";
    I("hand0").style.display = "none";
    I("hand1").style.display = "none";
    for (var i = 0; i < predictions.length; i++) {
        const minx = predictions[i].bbox[0];
        const miny = predictions[i].bbox[1];
        const w = predictions[i].bbox[2];
        const h = predictions[i].bbox[3];
        const cx = minx + w / 2;
        const cy = miny + h / 2;
        if (showHands) {
            const hand = I("hand" + i);
            hand.style.display = "";
            hand.setAttribute("cx", cx);
            hand.setAttribute("cy", cy);
            hand.setAttribute("rx", w/2);
            hand.setAttribute("ry", h/2);
        }
        if (showArms) {
            const arm = I("arm" + i);
            arm.style.display = "";
            arm.setAttribute("x2", cx);
            arm.setAttribute("y2", cy);
        }        
        if (showHandboxes) {
            const handbox = I("handbox" + i);
            handbox.style.display = "";
            handbox.setAttribute("x", minx);
            handbox.setAttribute("y", miny);
            handbox.setAttribute("width", w);
            handbox.setAttribute("height", h);
        }
    }
}

function runDetection() {
    model.detect(I("myvideo")).then(predictions => {
        console.log("predictions: ", predictions);
        //const context = I("canvas").getContext("2d");
        //model.renderPredictions(predictions, I("canvas"), context, I("myvideo"));
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
