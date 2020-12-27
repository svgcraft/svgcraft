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

class DecceleratingObject {
    // initialPos: Point
    // decceleration: float, in svg position units per sec^2
    constructor(initialPos, decceleration) {
        this.zeroSpeedPos = initialPos;
        this.zeroSpeedTime = -1e10;
        this.angle = 0.12345;
        this.decceleration = decceleration;
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
    trajectoryJson() {
        return {
            x0: this.zeroSpeedPos.x,
            y0: this.zeroSpeedPos.y,
            t0: this.zeroSpeedTime,
            angle: this.angle
        };
    }
}

class Player extends DecceleratingObject {
    // initialPos: Point
    constructor(initialPos, color) {
        super(initialPos, 12);
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
        this.color = color;
        this.nextFreshSnowballId = 0;
    }
    freshSnowballId() {
        return this.nextFreshSnowballId++;
    }
}

class Snowball extends DecceleratingObject {
    constructor(initialPos, id, playerId) {
        super(initialPos, 8);
        this.id = id; // each player numbers the snowballs it throws 0, 1, 2, ...
        this.playerId = playerId;
    }
}

const headRadius = 0.5;
const snowballRadius = 0.13;
const arenaWidth = 16;
const arenaHeight = 9;

function positionCircle(dom, pos, radius) {
    dom.setAttribute("cx", pos.x);
    dom.setAttribute("cy", pos.y);
    if (radius !== undefined) {
        dom.setAttribute("r", radius);
    }
}

function positionVector(dom, start, direction) {
    dom.setAttribute("x1", start.x);
    dom.setAttribute("y1", start.y);
    const target = start.add(direction);
    dom.setAttribute("x2", target.x);
    dom.setAttribute("y2", target.y);
}

function svg(tag, attrs, children, allowedAttrs) {
    const res = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
        for (const attrName in attrs) {
            if (!allowedAttrs || allowedAttrs.includes(attrName)) res.setAttribute(attrName, attrs[attrName]);
        }
    }
    if (children) {
        for (const child of children) {
            res.appendChild(child);
        }
    }
    return res;
}

class GameState {
    constructor(myId, bounceLines) {
        // we always aim towards the true position of the player aimTime seconds in the future
        this.aimTime = 0.3;
        this.lastT = null;
        this.players = new Map();
        this.snowballs = new Set();
        this.myId = myId;
        // a list of [a, v] pairs, where a is the start point of the line segment,
        // and v is the vector pointing from a to the line segment's end point
        this.bounceLines = bounceLines;
    }

    setPlayerSpeed(playerId, speed) {
        // Note: We don't use an event timestamp, otherwise we get non-linear time and can jump over walls
        this.players.get(playerId).setSpeed(this.lastT, speed);
    }

    setPlayerColor(playerId, color) {
        this.players.get(playerId).color = color;
        I("circ_" + playerId).setAttribute("fill", color);
    }

    addPlayer(playerId, color) {
        const player = new Player(new Point(arenaWidth/2, arenaHeight/2), color);
        this.players.set(playerId, player);
        const circ = svg("circle", {
            id: "circ_" + playerId, 
            cx: player.currentPos.x, 
            cy: player.currentPos.y, 
            r: headRadius,
            fill: color
        }, []);
        I("arena").appendChild(circ);
    }

    addSnowball(snowball) {
        this.snowballs.add(snowball);
        const circ = svg("circle", {
            id: "snowball_" + snowball.playerId + "_" + snowball.id, 
            cx: -1234,
            cy: -1234,
            r: snowballRadius,
            fill: "white"
        }, []);
        I("arena").appendChild(circ);
    }

    frame(timestamp) {
        const t = timestamp / 1000;
        if (this.lastT === null) this.lastT = t;
        const dt = t - this.lastT;

        for (let [playerId, player] of this.players) {
            this.reflections(t, dt, player);
            const aimPos = player.posAtTime(t + this.aimTime);

            const move = aimPos.sub(player.currentPos);
            // average speed while doing the move:
            const avgV = move.scale(1 / this.aimTime);
            // our speed should linearly decrease, and avgV is the speed we should have
            // in aimTime/2 from now
            const speedDelta = this.aimTime / 2 * player.decceleration; // (constant)
            const initialV = speedDelta > avgV.norm() ? avgV.scale(2) // no justification from physics, just to make breaking look smoother
                : avgV.scale((avgV.norm() + speedDelta) / avgV.norm()); // more correct
            player.currentPos = player.currentPos.add(initialV.scale(dt));

            const truePos = player.posAtTime(t);
            positionCircle(I("circ_" + playerId), player.currentPos);
            player.oldPos = truePos;
        }
        for (let snowball of this.snowballs) {
            const p = snowball.posAtTime(t);
            const v = snowball.speedAtTime(t).norm();
            const dom = I("snowball_" + snowball.playerId + "_" + snowball.id);
            const d = 0.7;
            if (p.x < -d || p.y < -d || p.x > arenaWidth + d || p.y > arenaHeight + d || v < epsilon) {
                this.snowballs.delete(snowball);
                dom.remove();
            } else {
                positionCircle(dom, p);
            }
        }
        this.lastT = t;
    }

    reflections(t, dt, player) {
        const used = this.bounceLines.map(line => false);
        // more than 2 reflections in the same frame is considered very unlikely, upper
        // bound of 10 just to avoid infinite loops in case of insane conditions
        let nReflections = 0;
        for (; nReflections < 10; nReflections++) {
            const newPos = player.posAtTime(t);
            const v = newPos.sub(player.oldPos);
            let minDistCoeff = Number.POSITIVE_INFINITY;
            let directionOfClosestWall = null;
            let indexOfClosestWall = null;
            for (let i = 0; i < this.bounceLines.length; i++) {
                if (used[i]) continue;
                const [q, w] = this.bounceLines[i];
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
}

function makeControllerLink(myId) {
    const folder = `${window.location.protocol}//${window.location.host}${window.location.pathname.replace("/index.html", "")}`;
    return `${folder}/touchpad.html?connectTo=${myId}`;
}

class PlayerPeer {
    constructor(id, conn, gameState) {
        this.id = id;
        this.conn = conn;
        this.gameState = gameState;
        this.timeSeniority = null; // how many seconds before me did this player start its clock?
        let timeRequestSent = null;
        conn.on('open', () => {
            log.connection("Connection to " + conn.peer + " open");
            timeRequestSent = performance.now() / 1000;
            sendMessage(conn, { type: "gettime" } );
            sendMessage(conn, { type: "setcolor", color: gameState.players.get(gameState.myId).color });
            gameState.addPlayer(id, "red");
        });
        conn.on('data', e => {
            log.data(`data received from ${conn.peer}`);
            log.data(e);
            if (e.type === "gettime") {
                sendMessage(conn, { type: "time", timestamp: performance.now() / 1000 });
            } else if (e.type === "time") {
                const timeResponseReceived = performance.now() / 1000;
                const timeResponseSent = (timeRequestSent + timeResponseReceived) / 2;
                this.timeSeniority = e.timestamp - timeResponseSent;
                log.connection(`RTT to ${this.id}: ${timeResponseReceived - timeRequestSent}s, clock started ${this.timeSeniority}s earlier`);
            } else if (e.type === "trajectory") {
                const player = gameState.players.get(id);
                player.zeroSpeedPos = new Point(parseFloat(e.x0), parseFloat(e.y0));
                player.zeroSpeedTime = e.t0 - this.timeSeniority;
                player.angle = e.angle;
            } else if (e.type === "snowball") {
                const snowball = new Snowball();
                snowball.zeroSpeedPos = new Point(parseFloat(e.x0), parseFloat(e.y0));
                snowball.zeroSpeedTime = e.t0 - this.timeSeniority;
                snowball.angle = e.angle;
                snowball.id = e.id;
                snowball.playerId = this.id;
                gameState.addSnowball(snowball);
            } else if (e.type === "setcolor") {
                gameState.setPlayerColor(id, e.color);
            } else {
                log.connection("unknown message type: " + e.type);
            }
        });
        conn.on('close', () => {
            log.connection(`Connection to ${conn.peer} closed`);
        });
    }
}

class TouchpadPeer {
    constructor(conn) {
        this.conn = conn;
        this.onLeftInput = () => {};
        this.onRightInput = () => {};
        conn.on('open', () => {
            log.connection("Connection to touchpad " + conn.peer + " open");
        });
        conn.on('data', e => {
            log.data(`data received from ${conn.peer}`);
            log.data(e);
            if (e.side === "left") this.onLeftInput(e);
            if (e.side === "right") this.onRightInput(e);
        });
        conn.on('close', () => {
            log.connection(`Connection to touchpad ${conn.peer} closed`);
        });
    }
}

class GameConnections {
    constructor(myId, friendId, gameState) {
        this.myId = myId;
        this.peer = new Peer(myId, {debug: 2});
        this.playerPeers = new Map();
        this.touchpadPeer = null;
        this.gameState = gameState;

        this.peer.on('open', (id) => {
            log.connection("PeerJS server gave us ID " + id);
            log.connection("Controller link to use on your phone:", makeControllerLink(id));
            if (friendId) {
                const conn = this.peer.connect(friendId, { 
                    reliable: true,
                    metadata: { type: "player" }
                });
                this.playerPeers.set(friendId, new PlayerPeer(friendId, conn, gameState));
            }
            log.connection("Waiting for peers to connect");
        });
    
        this.peer.on('connection', (conn) => {
            switch (conn.metadata?.type) {
                case "player":
                    log.connection("Connected to player " + conn.peer);
                    this.playerPeers.set(conn.peer, new PlayerPeer(conn.peer, conn, gameState));
                    break;
                case "touchpad":
                    if (this.touchpadPeer) {
                        log.connection("Rejecting touchpad connection because there already is one");
                        conn.close();
                    } else {
                        log.connection("Connected to touchpad " + conn.peer);
                        this.touchpadPeer = new TouchpadPeer(conn);
                        this.touchpadPeer.onLeftInput = e => {
                            this.gameState.setPlayerSpeed(this.myId, new Point(e.speedX, e.speedY));
                            this.broadcastTrajectory();
                        };
                        this.touchpadPeer.onRightInput = e => {
                            const player = gameState.players.get(this.myId);
                            const snowball = new Snowball(player.posAtTime(gameState.lastT), player.freshSnowballId(), this.myId);
                            snowball.setSpeed(gameState.lastT, new Point(e.speedX, e.speedY));
                            gameState.addSnowball(snowball);
                            this.broadcastSnowball(snowball);
                        }
                    }
                    break;
                default:
                    log.connection("Rejecting connection of unknown type " + conn.metadata?.type);
                    conn.close();
                    break;
            }
        });
    
        this.peer.on('disconnected', () => {
            log.connection("disconnected from PeerJS server");
        });
    
        this.peer.on('close', () => {
            log.connection('Connection to PeerJS server closed');
        });
    
        this.peer.on('error', (err) => {
            log.connection(err);
        });
    }

    broadcastTrajectory() {
        const player = this.gameState.players.get(this.myId);
        const m = player.trajectoryJson();
        m.type = "trajectory";
        this.broadcast(m);
    }

    broadcastSnowball(snowball) {
        const m = snowball.trajectoryJson();
        m.type = "snowball";
        m.id = snowball.id;
        this.broadcast(m);
    }

    broadcast(msg) {
        for (let playerPeer of this.playerPeers.values()) {
            sendMessage(playerPeer.conn, msg);
        }
    }
}

function genArray(len, f) {
    return Array.from(Array(len).keys(), f);
}

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

const colorNames = [ 
    "blue", 
    "burlywood", 
    "coral", 
    "crimson",
    "hotpink",
    "lawngreen",
    "orange",
    "purple",
    "red",
    "teal",
    "turquoise",
    "yellow"
];

function randomColor() {
    return colorNames[Math.floor(Math.random() * colorNames.length)];
}

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has("myId")) {
        console.error("No myId in URL");
        return;
    }
    const bounceLines = polygonToLines(I("borderPolygon"));
    const myId = urlParams.get("myId");
    const gs = new GameState(myId, bounceLines);
    const color = urlParams.get("color") || randomColor();
    gs.addPlayer(myId, color);

    new GameConnections(myId, urlParams.get("friendId"), gs);

    function paint(timestamp) {
        gs.frame(timestamp);
        window.requestAnimationFrame(paint);    
    }
    window.requestAnimationFrame(paint);
}

window.onload = init;

