"use strict";

function I(id) {
    return document.getElementById(id);
}

let isVideo = false;
let model = null;

const modelParams = {
    flipHorizontal: true,
    maxNumBoxes: 1,
    iouThreshold: 0.5,
    scoreThreshold: 0.6
}

function startVideo() {
    I("myvideo").width = videoWidth;
    I("myvideo").height = videoHeight;
    handTrack.startVideo(I("myvideo")).then(function (status) {
        console.log("video started", status);
        if (status) {
            I("updatenote").innerText = "Video started. Now tracking";
            isVideo = true;
            requestAnimationFrame(runDetection);
        } else {
            I("updatenote").innerText = "Please enable video";
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
let headRadius = 0.4;
let playerX = arenaWidth / 2;
let playerY = arenaHeight / 2;

// CSS pixels
const arenaBorder = 20; 

// handtrack.js video processing pixels
const videoWidth = 320;
const videoHeight = 240;

let pxPerUnit = 123;

function setDim(elem, w, h) {
    elem.style.width = pxPerUnit * w + "px";
    elem.style.height = pxPerUnit * h + "px";
}

function setPos(elem, x, y) {
    elem.style.left = pxPerUnit * x + "px";
    elem.style.top = pxPerUnit * y + "px";
}

// speed in svg units per ms
let vx = 0;
let vy = 0;

// caused by "friction", in svg units per ms^2
let decceleration = 1e-7;

let lastTimestamp = null;

// polar coordinates of hand wrt center of head, in svg units
let lastHandR = null;
let lastHandAlpha = null;
// center coordinates in svg units relative to top left corner of player video
let lastHandCx = null;
let lastHandCy = null;
// let lastHandTimestamp = null; // last time a hand was detected

// translation of hand movement into speed increase
let accelerationFactor = 0.001;

const angleThresh = Math.PI / 5;

function angleCloseToZero(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < - Math.PI) a += 2 * Math.PI;
    return Math.abs(a) < angleThresh;
}

function positionArenaAndPlayer(timestamp, predictions) {
    const availableWidth = window.innerWidth - 2 * arenaBorder;
    const availableHeight = window.innerHeight - 2 * arenaBorder;
    pxPerUnit = Math.min(availableWidth / arenaWidth, availableHeight / arenaHeight);

    setDim(I("arenaWrapper"), arenaWidth, arenaHeight);
    setDim(I("arenaBG"),      arenaWidth, arenaHeight);
    setDim(I("arenaFG"),      arenaWidth, arenaHeight);

    if (lastTimestamp === null) {
        // in first call, we just claim that there was 0 time difference to the previous,
        // so zero movement will be made
        lastTimestamp = timestamp;
    }
    const dt = timestamp - lastTimestamp;
    console.log("frame length:", dt);

    I("handMovement").style.display = "none";
    let curHandR = null;
    let curHandAlpha = null;
    let curHandCx = null;
    let curHandCy = null;
    if (predictions.length === 1) {
        const minx = predictions[0].bbox[0] / videoWidth * playerWidth;
        const miny = predictions[0].bbox[1] / videoHeight * playerHeight;
        const w = predictions[0].bbox[2] / videoWidth * playerWidth;
        const h = predictions[0].bbox[3] / videoHeight * playerHeight;
        curHandCx = minx + w / 2;
        curHandCy = miny + h / 2;
        const relx = curHandCx - playerWidth / 2;
        const rely = curHandCy - playerHeight / 2;
        curHandR = Math.sqrt(relx * relx + rely * rely);
        curHandAlpha = Math.atan2(rely, relx);
        if (lastHandAlpha !== null) {
            //I("handMovement").style.display = "";
            I("handMovement").setAttribute("x1", lastHandCx);
            I("handMovement").setAttribute("y1", lastHandCy);
            I("handMovement").setAttribute("x2", curHandCx);
            I("handMovement").setAttribute("y2", curHandCy);
            if (angleCloseToZero(curHandAlpha - lastHandAlpha) && curHandR > lastHandR) {
                vx += (lastHandCx - curHandCx) * accelerationFactor;
                vy += (lastHandCy - curHandCy) * accelerationFactor;
                I("handMovement").setAttribute("stroke", "red");
            } else {
                I("handMovement").setAttribute("stroke", "blue");
            }
        }
    }
    const v = Math.sqrt(vx * vx + vy * vy);
    const vNew = Math.max(0, v - decceleration * dt);
    if (vNew <= 0) {
        vx = 0;
        vy = 0;
    } else {
        const alpha = Math.atan2(vy, vx);
        vx = Math.cos(alpha) * vNew;
        vy = Math.sin(alpha) * vNew;
    }

    //console.log([vx*1000, vy*1000]);
    playerX += vx * dt;
    playerY += vy * dt;
    if (vx < 0 && playerX < headRadius) vx = -vx;
    if (vx > 0 && playerX + headRadius > arenaWidth) vx = -vx;
    if (vy < 0 && playerY < headRadius) vy = -vy;
    if (vy > 0 && playerY + headRadius > arenaHeight) vy = - vy;

    const x1 = playerX - playerWidth / 2;
    const y1 = playerY - playerHeight / 2;
    setPos(I("myvideo"), x1, y1);
    setDim(I("myvideo"), playerWidth, playerHeight);

    I("overlayG").setAttribute("transform", `translate(${x1}, ${y1})`);

    lastTimestamp = timestamp;
    if (curHandR !== null) {
        lastHandR = curHandR;
        lastHandAlpha = curHandAlpha;
        lastHandCx = curHandCx;
        lastHandCy = curHandCy;
    }
}

let showArms = false;
let showHandboxes = false;
let showHands = false;

let handScaleFactor = 1;

// l: list of string or Point
function pathStr(l) {
    return l.map(e => typeof(e) === "string" ? e : e.x + " " + e.y).join(" ");
}

// Returns d string representing a bubble deformed by a hand.
// Center of head is at (c.x, c.y).
// Center of hand is at polar coordinates (handDist, handAngle) relative to (cx, cy).
// Output coordinates are scaled by scale.x, scale.y wrt c.
function headPath(c, headR, handR, handDist, handAngle, scale) {
    function polar(r, alpha) {
        return Point.polar(r, alpha).scale(scale);
    }
    const pHand = c.add(polar(handDist + handR, handAngle));
    const pSide1 = c.add(polar(headR, handAngle + Math.PI/2));
    const pOpp = c.add(polar(headR, handAngle + Math.PI));
    const pSide2 = c.add(polar(headR, handAngle - Math.PI/2));
    return pathStr([
        "M", pHand, 
        "C", pHand.add(polar(handR, handAngle + Math.PI/2)), 
             pSide1.add(polar(headR, handAngle)),
             pSide1,
        "Q", pSide1.add(polar(headR, handAngle + Math.PI)),
             pOpp,
        "Q", pSide2.add(polar(headR, handAngle + Math.PI)),
             pSide2,
        "C", pSide2.add(polar(headR, handAngle)),
             pHand.add(polar(handR, handAngle - Math.PI/2)),
             pHand,
        "Z"
    ]);
}

function hideStickfigure() {
    for (var i = 0; i < 2; i++) {
        I("arm" + i).style.display = "none";
        I("handbox" + i).style.display = "none";
        I("hand" + i).style.display = "none";
        //I("handClip" + i).style.display = "none";
    }
}

function showStickfigure(predictions) {
    hideStickfigure();
    I("deformedHead").style.display = "none";
    I("deformedHeadClip").style.display = "none";
    I("roundHead").style.display = "";
    I("roundHeadClip").style.display = "";
    for (var i = 0; i < predictions.length; i++) {
        // in svg units
        const topleft = new Point(predictions[i].bbox[0] / videoWidth * playerWidth, 
                                  predictions[i].bbox[1] / videoHeight * playerHeight);
        const w = predictions[i].bbox[2] / videoWidth * playerWidth;
        const h = predictions[i].bbox[3] / videoHeight * playerHeight;
        const c = new Point(topleft.x + w / 2, topleft.y + h / 2);

        const handR = (w + h) / 4 * handScaleFactor;
        const headCenter = new Point(playerWidth / 2, playerHeight / 2);
        const relHandPos = c.sub(headCenter);
        if (relHandPos.norm() + handR > headRadius) {
            I("roundHead").style.display = "none";
            I("roundHeadClip").style.display = "none";
            I("deformedHead").style.display = "";
            I("deformedHeadClip").style.display = "";
            const d = headPath(headCenter, headRadius, handR, relHandPos.norm(), relHandPos.angle(), new Point(1, 1));
            I("deformedHead").setAttribute("d", d);
            const scale = new Point(-1.0/playerWidth, 1.0/playerHeight); // minus because camera is mirrored
            const dClip = headPath(new Point(0.5, 0.5), headRadius, handR, relHandPos.norm(), relHandPos.angle(), scale);
            I("deformedHeadClip").setAttribute("d", dClip);
        }

        if (showHands) {
            const hand = I("hand" + i);
            hand.style.display = "";
            hand.setAttribute("cx", c.x);
            hand.setAttribute("cy", c.y);
            hand.setAttribute("rx", w / 2 * handScaleFactor);
            hand.setAttribute("ry", h / 2 * handScaleFactor);
        }
        if (showArms) {
            const arm = I("arm" + i);
            arm.style.display = "";
            arm.setAttribute("x2", c.x);
            arm.setAttribute("y2", c.y);
        }        
        if (showHandboxes) {
            const handbox = I("handbox" + i);
            handbox.style.display = "";
            handbox.setAttribute("x", topleft.x);
            handbox.setAttribute("y", topleft.y);
            handbox.setAttribute("width", w);
            handbox.setAttribute("height", h);
        }
    }
}

function runDetection(timestamp) {
    model.detect(I("myvideo")).then(predictions => {
        //console.log("predictions: ", predictions);
        //const context = I("canvas").getContext("2d");
        //model.renderPredictions(predictions, I("canvas"), context, I("myvideo"));
        positionArenaAndPlayer(timestamp, predictions);
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
