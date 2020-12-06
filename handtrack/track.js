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

// svg units
const arenaWidth = 16;
const arenaHeight = 9;
let playerWidth = 2;
let playerHeight = 1.5;
let playerX = arenaWidth / 2;
let playerY = arenaHeight / 2;

// CSS pixels
const arenaBorder = 20; 

// handtrack.js video processing pixels
const videoWidth = 640;
const videoHeight = 480;

let pxPerUnit = 123;

function setDim(elem, w, h) {
    elem.style.width = pxPerUnit * w + "px";
    elem.style.height = pxPerUnit * h + "px";
}

function setPos(elem, x, y) {
    elem.style.left = pxPerUnit * x + "px";
    elem.style.top = pxPerUnit * y + "px";
}

function positionArenaAndPlayer() {
    const availableWidth = window.innerWidth - 2 * arenaBorder;
    const availableHeight = window.innerHeight - 2 * arenaBorder;
    pxPerUnit = Math.min(availableWidth / arenaWidth, availableHeight / arenaHeight);

    setDim(I("arenaWrapper"), arenaWidth, arenaHeight);
    setDim(I("arenaBG"),      arenaWidth, arenaHeight);
    setDim(I("arenaFG"),      arenaWidth, arenaHeight);

    const x1 = playerX - playerWidth / 2;
    const y1 = playerY - playerHeight / 2;
    setPos(I("myvideo"), x1, y1);
    setDim(I("myvideo"), playerWidth, playerHeight);

    I("overlayG").setAttribute("transform", `translate(${x1}, ${y1})`);
}

let showHead = true;
let showArms = true;
let showHandboxes = true;
let showHands = true;

let handScaleFactor = 1.6;

function hideStickfigure() {
    for (var i = 0; i < 2; i++) {
        I("head").style.display = "none";
        I("arm" + i).style.display = "none";
        I("handbox" + i).style.display = "none";
        I("hand" + i).style.display = "none";
        I("handClip" + i).style.display = "none";
    }
}

function showStickfigure(predictions) {
    hideStickfigure();
    if (showHead) {
        I("head").style.display = "";
    }
    for (var i = 0; i < predictions.length; i++) {
        // in svg units
        const minx = predictions[i].bbox[0] / videoWidth * playerWidth;
        const miny = predictions[i].bbox[1] / videoHeight * playerHeight;
        const w = predictions[i].bbox[2] / videoWidth * playerWidth;
        const h = predictions[i].bbox[3] / videoHeight * playerHeight;
        const cx = minx + w / 2;
        const cy = miny + h / 2;

        const handClip = I("handClip" + i);
        handClip.style.display = "";
        handClip.setAttribute("cx", 1.0 - cx / playerWidth); // mirror
        handClip.setAttribute("cy", cy / playerHeight);
        handClip.setAttribute("rx", w / 2 / playerWidth * handScaleFactor);
        handClip.setAttribute("ry", h / 2 / playerHeight * handScaleFactor);

        if (showHands) {
            const hand = I("hand" + i);
            hand.style.display = "";
            hand.setAttribute("cx", cx);
            hand.setAttribute("cy", cy);
            hand.setAttribute("rx", w / 2 * handScaleFactor);
            hand.setAttribute("ry", h / 2 * handScaleFactor);
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
        positionArenaAndPlayer();
        showStickfigure(predictions);
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
