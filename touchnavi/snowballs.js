"use strict";

function I(id) {
    return document.getElementById(id);
}

// speed in svg position units per sec
let vx = 0;
let vy = 0;
let posx = 50;
let posy = 50;
const headRadius = 5;
const arenaWidth = 100;
const arenaHeight = 100;
let lastTimestamp = null;
// in svg position units per sec^2
const decceleration = 50;

function frame(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;

    const dt = (timestamp - lastTimestamp) / 1000;
    if (vx < 0 && posx < headRadius) vx = -vx;
    if (vx > 0 && posx + headRadius > arenaWidth) vx = -vx;
    if (vy < 0 && posy < headRadius) vy = -vy;
    if (vy > 0 && posy + headRadius > arenaHeight) vy = - vy;
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
    posx += vx * dt;
    posy += vy * dt;
    I("circ").setAttribute("cx", posx);
    I("circ").setAttribute("cy", posy);

    lastTimestamp = timestamp;
    window.requestAnimationFrame(frame);
}

const movementScale = 30;

function processEvent(e) {
    vx = movementScale * e.speedX;
    vy = movementScale * e.speedY;
}

function makeControllerLink(serverId) {
    // ?serverId=${serverId} is already in the URL
    return window.location.href.replace("index.html", `touchpad.html`);
}

function initServer(serverId) {
    const peer = new Peer(serverId, {debug: 2});

    peer.on('open', (id) => {
        log.connection("PeerJS server gave us ID " + id);
        log.connection("Controller link to share:", makeControllerLink(serverId));
        log.connection("Waiting for peers to connect");
    });

    peer.on('connection', (conn) => {
        log.connection("Connected to " + conn.peer);

        conn.on('open', () => {
            log.connection("Connection to " + conn.peer + " open");
        });

        conn.on('data', e => {
            log.data(`actions received from client:`);
            log.data(e);
            processEvent(e);
        });
        conn.on('close', () => {
            log.connection(`Connection to client closed`);
        });
    });

    peer.on('disconnected', () => {
        log.connection("disconnected!");
    });

    peer.on('close', () => {
        log.connection('Connection to PeerJS server closed');
    });

    peer.on('error', (err) => {
        log.connection(err);
    });
}

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("serverId")) {
        initServer(urlParams.get("serverId"));
    } else {
        console.error("No serverId in URL");
    }
    window.requestAnimationFrame(frame);
}

window.onload = init;

