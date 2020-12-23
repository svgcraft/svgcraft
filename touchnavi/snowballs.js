"use strict";

function I(id) {
    return document.getElementById(id);
}

class Player {
    // initialPos: Point
    constructor(initialPos) {
        // currentPos is an interpolated approximation of the true current position,
        // posAtTime(Date.now()/1000), and to save the true position, we don't save
        // current coordinates, but the position and time at which speed 0 will be
        // reached, and the angle from that point to the current position,
        // so that given the decceleration and current time, clients compute the
        // current position themselves (and interpolate a trajectory if they're
        // a bit off, without causing jumps)
        this.currentPos = initialPos;
        this.zeroSpeedPos = initialPos;
        this.zeroSpeedTime = Date.now() / 1000;
        this.angle = 0.12345;
        this.decceleration = 50; // in svg position units per sec^2
    }
    // time: seconds
    posAtTime(time) {
        const t = Math.max(0, this.zeroSpeedTime - time);
        const d = 0.5 * this.decceleration * t * t;
        return this.zeroSpeedPos.add(Point.polar(d, this.angle));
    }
    // time: seconds, at which point in time this speed was adopted
    // speed: Point, speed vector
    setSpeed(time, speed) {
        const corner = this.posAtTime(time);
        const v = speed.norm();
        const timeToStop = v / this.decceleration;
        const distToStop = 0.5 * v * timeToStop;
        this.zeroSpeedTime = time + timeToStop;
        this.zeroSpeedPos = corner.add(speed.scale(distToStop / v));
        this.angle = speed.angle() + Math.PI;
    }
}

const headRadius = 5;
const arenaWidth = 100;
const arenaHeight = 100;
let lastTimestamp = null;
let player = null;

// will remain 0 in server, set to (likely) non-zero in clients
let serverTimeDelta = 0;

function toServerTime(t) {
    return t - serverTimeDelta;
}

function positionCircle(dom, pos) {
    dom.setAttribute("cx", pos.x);
    dom.setAttribute("cy", pos.y);
}

// we always aim towards the true position of the player aimTime seconds in the future
const aimTime = 0.3;

let rafEpoch = null; // when was requestAnimationFrame timestamp 0?

function frame(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    if (rafEpoch === null) rafEpoch = Date.now() - timestamp;
    const dt = (timestamp - lastTimestamp) / 1000;
    const t = toServerTime((rafEpoch + timestamp) / 1000);
    const aimPos = player.posAtTime(t + aimTime);
    player.currentPos = player.currentPos.add(aimPos.sub(player.currentPos).scale(dt / aimTime));

    /*
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
    */

    positionCircle(I("circ"), player.currentPos);
    positionCircle(I("circTruePos"), player.posAtTime(t));
    positionCircle(I("circZeroSpeedPos"), player.zeroSpeedPos);

    let att = player.posAtTime(t);
    if (att.sub(player.currentPos).norm() > 10) {
        att = player.posAtTime(t);
        console.log(att);
    }

    lastTimestamp = timestamp;
    window.requestAnimationFrame(frame);
}

const movementScale = 30;

function processEvent(e) {
    const speed = new Point(e.speedX * movementScale, e.speedY * movementScale);
    player.setSpeed(e.timeStamp, speed);
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
            if (e === "gettime") {
                conn.send({ type: "time", timeStamp: Date.now() });
            } else {
                processEvent(e);
            }
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
    player = new Player(new Point(50, 50));
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("serverId")) {
        initServer(urlParams.get("serverId"));
    } else {
        console.error("No serverId in URL");
    }
    window.requestAnimationFrame(frame);
}

window.onload = init;

