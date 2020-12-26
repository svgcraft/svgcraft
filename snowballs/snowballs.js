"use strict";

function I(id) {
    return document.getElementById(id);
}

// returns angle between -Math.PI and Math.PI
function normalizeAngle(a) {
    return a - 2 * Math.PI * Math.floor(a / 2 / Math.PI + 0.5);
}

// avoids getting huge angles by repeatedly adding Math.PI
function oppositeAngle(a) {
    return normalizeAngle(a + Math.PI);
}

function angleDist(a, b) {
    return Math.abs(normalizeAngle(a - b));
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
        // usually equals this.posAtTime(timeAtLastFrame), unless there was a speed change between the current and last frame
        this.oldPos = initialPos;
        this.zeroSpeedPos = initialPos;
        this.zeroSpeedTime = -1e10;
        this.angle = 0.12345;
        this.decceleration = 12; // in svg position units per sec^2
    }
    // time: seconds
    speedAtTime(time) {
        const t = Math.max(0, this.zeroSpeedTime - time);
        return Point.polar(this.decceleration * t, oppositeAngle(this.angle));
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
        this.angle = oppositeAngle(speed.angle());
    }
}

const headRadius = 0.5;
const arenaWidth = 16;
const arenaHeight = 9;
let lastTimestamp = null;
let player = null;

// will remain 0 in server, set to (likely) non-zero in clients
let serverTimeDelta = 0;

function toServerTime(t) {
    return t / 1000 - serverTimeDelta;
}

function positionCircle(dom, pos, radius) {
    dom.setAttribute("cx", pos.x);
    dom.setAttribute("cy", pos.y);
    if (radius !== undefined) {
        dom.setAttribute("r", radius);
    }
}

function placeNewCircle(pos, r, color) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("fill-color", color);
    positionCircle(c, pos, r);
    I("arena").appendChild(c);
}

function positionVector(dom, start, direction) {
    dom.setAttribute("x1", start.x);
    dom.setAttribute("y1", start.y);
    const target = start.add(direction);
    dom.setAttribute("x2", target.x);
    dom.setAttribute("y2", target.y);
}

// we always aim towards the true position of the player aimTime seconds in the future
const aimTime = 0.3;

function frame(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000;
    const t = toServerTime(timestamp);
    reflections(t, dt, player, bounceLines);
    const aimPos = player.posAtTime(t + aimTime);

    const move = aimPos.sub(player.currentPos);
    // average speed while doing the move:
    const avgV = move.scale(1 / aimTime);
    // our speed should linearly decrease, and avgV is the speed we should have
    // in aimTime/2 from now
    const speedDelta = aimTime / 2 * player.decceleration; // (constant)
    const initialV = speedDelta > avgV.norm() ? avgV.scale(2) // no justification from physics, just to make breaking look smoother
        : avgV.scale((avgV.norm() + speedDelta) / avgV.norm()); // more correct
    player.currentPos = player.currentPos.add(initialV.scale(dt));

    const truePos = player.posAtTime(t);
    positionCircle(I("circ"), player.currentPos);
    positionCircle(I("circTruePos"), truePos);
    positionCircle(I("circZeroSpeedPos"), player.zeroSpeedPos);

    I("serverTime").innerText = Math.floor(t);

    player.oldPos = truePos;
    //placeNewCircle(truePos, 0.02, "black");
    lastTimestamp = timestamp;
    window.requestAnimationFrame(frame);
}

const movementScale = 10;

// if player is closer than this much from a wall, speed updates are disabled,
// otherwise after a few numeric imprecisions, the player will sneak through the wall
const speedIgnoringThreshDist = 0.4;

let lastSpeedUpdateTimestamp = Number.NEGATIVE_INFINITY;

function processEvent(e) {
    if (e.timeStamp > lastSpeedUpdateTimestamp) {
        //const pos = player.posAtTime(e.timeStamp);
        //const d = distFromSegments(pos, bounceLines);
        //positionVector(I("distToBorder"), pos, d);
        const speed = new Point(e.speedX * movementScale, e.speedY * movementScale);
        //if (d.norm() < speedIgnoringThreshDist && angleDist(d.angle(), speed.angle()) < Math.PI / 2) return;
        const timeAtLastFrame = toServerTime(lastTimestamp);
        player.setSpeed(timeAtLastFrame, speed); // not e.timeStamp, otherwise we get non-linear time and can jump over walls
    }
    lastSpeedUpdateTimestamp = e.timeStamp;
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
            if (e.type === "gettime") {
                sendMessage(conn, { type: "time", timeStamp: toServerTime(performance.now()) });
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

function genArray(len, f) {
    return Array.from(Array(len).keys(), f);
}

// a list of [a, v] pairs, where a is the start point of the line segment,
// and v is the vector pointing from a to the line segment's end point
let bounceLines = [];

function polygonToLines(dom) {
    const points = dom.getAttribute("points").split(/ *, *| +/).map(parseFloat);
    return genArray(points.length / 2, i => {
        const a = new Point(points[2*i], points[2*i+1]);
        const b = new Point(points[(2*i+2) % points.length], points[(2*i+3) % points.length]);
        return [a, b.sub(a)];
    });
}

const epsilon = 1e-20;

// All argument types are Point, return type is an array of length 2.
// Given the lines `a + s*u` and `b + t*v`, returns the coefficients [s,t]
// at which they intersect, or null if the two lines are parallel.
function lineIntersectionCoeffs(a, u, b, v) {
    const det = -u.x * v.y + u.y * v.x;
    if (Math.abs(det) < epsilon) {
        return null;
    } else {
        return [
            1/det * (-v.y * (b.x - a.x) + v.x * (b.y - a.y)),
            1/det * (-u.y * (b.x - a.x) + u.x * (b.y - a.y))
        ];
    }
}

// given speed vector and wall vector, returns new speed vector after bouncing at wall
function reflect(speed, wall) {
    const theta = speed.angle() - wall.angle();
    const a = Math.cos(theta) * speed.norm() / wall.norm();
    const b = Math.sin(theta) * speed.norm() / wall.norm();
    // [a, b] expresses the speed vector in the coordinate system
    // spanned by [wall, rotate90(wall)]:
    //    speed = a * wall + b * rotate90(wall)
    // To bounce, we just need to invert the sign of b.
    return wall.scale(a).sub(wall.rotate(Math.PI/2).scale(b));
}

function distFromSegment(p, start, direction) {
    const perp = direction.rotate(Math.PI/2);
    const [s, t] = lineIntersectionCoeffs(start, direction, p, perp);
    let res = -1;
    if (0 <= s && s <= 1) { // distance is perpendicular to segment
        res = perp.scale(t);
    } else { // distance goes to a segment endpoint
        const v1 = start.sub(p);
        const v2 = v1.add(direction);
        res = Point.min(v1, v2);
    }
    return res;
}

function distFromSegments(p, segments) {
    return segments.reduce(
        (res, [start, direction]) => Point.min(res, distFromSegment(p, start, direction)),
        Point.infinity());
}

function reflections(t, dt, player, bounceLines) {
    const used = bounceLines.map(line => false);
    // more than 2 reflections in the same frame is considered very unlikely, upper
    // bound of 10 just to avoid infinite loops in case of insane conditions
    let nReflections = 0;
    for (; nReflections < 10; nReflections++) {
        const newPos = player.posAtTime(t);
        const v = newPos.sub(player.oldPos);
        let minDistCoeff = Number.POSITIVE_INFINITY;
        let directionOfClosestWall = null;
        let indexOfClosestWall = null;
        for (let i = 0; i < bounceLines.length; i++) {
            if (used[i]) continue;
            const [q, w] = bounceLines[i];
            const coeffs = lineIntersectionCoeffs(q, w, player.oldPos, v);
            if (coeffs === null) continue;
            const [c1, c2] = coeffs;
            // we prefer to bounce too often rather than too rarely to prevent
            // players from exiting the arena by sneaking through a corner in
            // case the player aims exactly at the corner and floating point
            // instabilities are against us
            if (0 <= c1 && c1 <= 1 + epsilon && 0 <= c2 && c2 <= 1 + epsilon && c2 < minDistCoeff) {
                minDistCoeff = c2;
                directionOfClosestWall = w;
                indexOfClosestWall = i;
            }
        }
        if (minDistCoeff === Number.POSITIVE_INFINITY) {
            break;
        } else {
            used[indexOfClosestWall] = true;
            const bouncePoint = player.oldPos.add(v.scale(minDistCoeff));
            const d = bouncePoint.sub(player.zeroSpeedPos).norm();
            const tToStop = Math.sqrt(2 * d / player.decceleration);
            const tAtBounce = player.zeroSpeedTime - tToStop;
            const originalSpeed = player.speedAtTime(tAtBounce);
            const bouncedSpeed = reflect(originalSpeed, directionOfClosestWall);
            player.setSpeed(tAtBounce, bouncedSpeed);
            // wrt new zeroSpeedPos, relevant in next loop iteration, will soon be overwritten by player.posAtTime(t) for next frame
            player.oldPos = player.posAtTime(t - dt);
            positionVector(I("speedBefore"), bouncePoint, originalSpeed);
            positionVector(I("speedAfter"), bouncePoint, bouncedSpeed);
        }
    }
    if (nReflections > 0) console.log(`nReflections = ${nReflections}`);
}

function init() {
    player = new Player(new Point(arenaWidth/2, arenaHeight/2));
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("serverId")) {
        initServer(urlParams.get("serverId"));
    } else {
        console.error("No serverId in URL");
    }
    bounceLines = polygonToLines(I("borderPolygon"));
    window.requestAnimationFrame(frame);
}

window.onload = init;

