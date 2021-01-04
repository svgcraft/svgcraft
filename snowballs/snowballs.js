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
    constructor(initialPos) {
        this.zeroSpeedPos = initialPos;
        this.zeroSpeedTime = -1e10;
        this.angle = 0.12345;
    }
    get decceleration() {
        throw "not implemented";
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
            angle: this.angle,
            // note: in milliseconds, but rounded, so that comparisons will be reliable (we will use them as packet ids)
            sentT: Math.round(performance.now())
        };
    }
    // that: DecceleratingObject
    // determine if `this` hits `that` between time `t-dt` and `t`, 
    // where hitting means being at a distance less than `dist`
    hits(that, t, dt, dist) {
        // TODO consider intermediate time points too
        const finalDist = this.posAtTime(t).sub(that.posAtTime(t)).norm();
        return finalDist < dist;
    }
}

let playerDecceleration = 10;

class Player extends DecceleratingObject {
    // initialPos: Point
    constructor(initialPos, color) {
        super(initialPos);
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
        this.snowballs = new Map();
        this.shootingAngle = 0;

        this.lastHitTime = Number.NEGATIVE_INFINITY;
        this.lastHitColor = null;
        this.minusPoints = 0;
        this.plusPoints = 0;

        this.view = {
            // position of svg origin on the screen, in px
            x: 0,
            y: 0,
            // zoom level, in px per svg unit
            scale: 80,
            // width and height of viewport in px
            w: 1600,
            h: 900
        };
    }
    freshSnowballId() {
        return this.nextFreshSnowballId++;
    }
    get decceleration() {
        return playerDecceleration;
    }
}

let snowballDecceleration = 4;

class Snowball extends DecceleratingObject {
    constructor(initialPos, id, playerId, birthTime) {
        super(initialPos);
        this.id = id; // each player numbers the snowballs it throws 0, 1, 2, ...
        this.playerId = playerId;
        this.birthTime = birthTime;
    }
    get decceleration() {
        return snowballDecceleration;
    }
    toJson() {
        const res = this.trajectoryJson();
        res.type = "snowball";
        res.id = this.id;
        res.birthTime = this.birthTime;
        // playerId is implicit from connection
        return res;
    }
    // caller still needs to subtract timeSeniority and set playerId
    static fromJson(e) {
        const snowball = new Snowball();
        snowball.zeroSpeedPos = new Point(parseFloat(e.x0), parseFloat(e.y0));
        snowball.zeroSpeedTime = e.t0;
        snowball.angle = e.angle;
        snowball.id = e.id;
        snowball.birthTime = e.birthTime;
        return snowball;
    }
}

const headRadius = 0.5;
const snowballRadius = 0.13;
// "pointer" is the triangle pointing out of the head, whereas "cursor" is the mouse position
const pointerRadius = headRadius * 1.9;
const pointerBaseWidth = headRadius * 1.6;
const cursorRadius = 0.1;
const viewBoundaryWidth = 0.2;

let playerStartPos = null;

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

function isoscelesTriangle(baseMid, baseLength, rotation, height) {
    const tip = baseMid.add(Point.polar(height, rotation));
    const p1 = baseMid.add(Point.polar(baseLength/2, rotation + Math.PI/2));
    const p2 = baseMid.add(Point.polar(baseLength/2, rotation - Math.PI/2));
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${tip.x} ${tip.y} z`;
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

function initMouseMoveNavi(gameState) {
    I("arena").addEventListener("mousemove", e => {
        const mouse = gameState.eventToWorldCoords(e);
        const current = gameState.myPlayer.posAtTime(gameState.lastT);
        const d = current.sub(mouse);
        const targetZero = mouse.add(d.scaleToLength(pointerRadius));
        const move = targetZero.sub(current);
        const tToStop = Math.sqrt(2 * move.norm() / gameState.myPlayer.decceleration);
        gameState.myPlayer.zeroSpeedTime = gameState.lastT + tToStop;
        gameState.myPlayer.zeroSpeedPos = targetZero;
        gameState.myPlayer.shootingAngle = oppositeAngle(d.angle());
        gameState.myPlayer.angle = oppositeAngle(gameState.myPlayer.shootingAngle);
    });
    window.addEventListener("keydown", e => {
        if (e.key === "f" && gameState.showPointers) {
            gameState.events.publishSnowball(Point.polar(1, gameState.myPlayer.shootingAngle));
        } else if (e.key === "s") {
            gameState.events.publishShowPointers(!gameState.showPointers);
        }
    });
    I("arena").addEventListener("wheel", e => {
        e.preventDefault();
        const zoomChange = Math.exp(e.deltaY * -0.001);
        const xInPort = e.clientX;
        const yInPort = e.clientY;
        gameState.events.publish({
            type: "upd",
            id: gameState.myId,
            view: {
                x: xInPort - (xInPort - gameState.myPlayer.view.x) * zoomChange,
                y: yInPort - (yInPort - gameState.myPlayer.view.y) * zoomChange,
                scale: gameState.myPlayer.view.scale * zoomChange
            }
        });
    });
    function onResize() {
        const r = I("arenaWrapper").getBoundingClientRect();
        gameState.events.publish({ type: "upd", id: gameState.myId, view: { w: r.width, h: r.height } } );
    }
    window.addEventListener("resize", onResize);
    onResize();
    // create small disk on which mouse pointer is not shown
    const noCursor = svg("circle", {
        id: "noCursor",
        cx: -1234,
        cy: -1234,
        r: cursorRadius,
        "fill": "white",
        "fill-opacity": 0,
        "class": "pointer"
    }, []);
    noCursor.style.cursor = "none";
    I("arena").appendChild(noCursor);
    I("pointerTriangle_" + gameState.myId).style.cursor = "none";
}

class GameState {
    constructor(myId, bounceLines, events) {
        // we always aim towards the true position of the player aimTime seconds in the future
        this.aimTime = 0.3;
        this.hitAnimationLength = 0.3;
        this.lastT = null;
        this.players = new Map();
        this.myId = myId;
        // a list of [a, v] pairs, where a is the start point of the line segment,
        // and v is the vector pointing from a to the line segment's end point
        this.bounceLines = bounceLines;
        this.events = events;
    }

    get myPlayer() {
        return this.players.get(this.myId);
    }

    get showPointers() {
        return !I("arena").classList.contains("hidePointers");
    }
    set showPointers(b) {
        if (b) {
            I("arena").classList.remove("hidePointers");
        } else {
            I("arena").classList.add("hidePointers");
        }
    }

    setPlayerSpeed(playerId, speed) {
        // Note: We don't use an event timestamp, otherwise we get non-linear time and can jump over walls
        this.players.get(playerId).setSpeed(this.lastT, speed);
    }

    setPlayerColor(playerId, color) {
        this.players.get(playerId).color = color;
        I("circ_" + playerId).setAttribute("fill", color);
        I("pointerTriangle_" + playerId).setAttribute("fill", color);
        for (let i = 0; i < 4; i++) {
            for (const stop of I(`gradient${i}_${playerId}`).getElementsByTagName("stop")) {
                stop.setAttribute("stop-color", color);
            }
        }
    }

    encodeTransform() {
        return `translate(${this.myPlayer.view.x}px, ${this.myPlayer.view.y}px) scale(${this.myPlayer.view.scale})`;
    }
    
    setTransform() {
        I("arena").style.transform = this.encodeTransform();
    }

    viewUpdate(id) {
        if (id === this.myId) {
            this.setTransform();
        }
        const view = this.players.get(id).view;
        const x1 = - view.x  / view.scale;
        const x1i = x1 + viewBoundaryWidth;
        const x2 = (- view.x + view.w) / view.scale;
        const x2i = x2 - viewBoundaryWidth;
        const y1 = - view.y / view.scale;
        const y1i = y1 + viewBoundaryWidth;
        const y2 = (- view.y + view.h) / view.scale;
        const y2i = y2 - viewBoundaryWidth;
        I(`viewBound0_${id}`).setAttribute("points", `${x2},${y1} ${x2},${y2} ${x2i},${y2i} ${x2i},${y1i}`);
        I(`viewBound1_${id}`).setAttribute("points", `${x2},${y1} ${x1},${y1} ${x1i},${y1i} ${x2i},${y1i}`);
        I(`viewBound2_${id}`).setAttribute("points", `${x1},${y1} ${x1},${y2} ${x1i},${y2i} ${x1i},${y1i}`);
        I(`viewBound3_${id}`).setAttribute("points", `${x1},${y2} ${x2},${y2} ${x2i},${y2i} ${x1i},${y2i}`);
    }

    addPlayer(playerId, color) {
        const player = new Player(playerStartPos, color);
        this.players.set(playerId, player);

        const circ = svg("circle", {
            id: "circ_" + playerId, 
            cx: player.currentPos.x, 
            cy: player.currentPos.y, 
            r: headRadius,
            fill: color
        }, []);
        I("arena").appendChild(circ);

        const w = 0.2 * headRadius;
        const hitShade = svg("circle", {
            id: "hitShade_" + playerId, 
            cx: player.currentPos.x, 
            cy: player.currentPos.y, 
            r: headRadius + 1.5 * w,
            fill: "none",
            "stroke-width": w,
            "stroke": "black",
            "stroke-opacity": 0
        }, []);
        I("arena").appendChild(hitShade);

        const pointerTriangle = svg("path", {
            id: "pointerTriangle_" + playerId,
            d: isoscelesTriangle(player.currentPos, pointerBaseWidth, player.shootingAngle, pointerRadius),
            fill: color,
            class: "pointer"
        });
        I("arena").appendChild(pointerTriangle);

        for (let i = 0; i < 4; i++) {
            const flip = Math.floor((i + 1) % 4 / 2);
            const dontFlip = 1 - flip;
            const gradient = svg("linearGradient", {
                id: `gradient${i}_${playerId}`,
                gradientTransform: `rotate(${i % 2 * 90})`
            }, [
                svg("stop", { offset: "0%"  , "stop-color": color, "stop-opacity": flip * 0.7 }),
                svg("stop", { offset: "100%", "stop-color": color, "stop-opacity": dontFlip * 0.7 })
            ])
            I("arenaDefs").appendChild(gradient);
            I("arena").appendChild(svg("polygon", { id: `viewBound${i}_${playerId}`, fill: `url(#gradient${i}_${playerId})` }));
        }

        const vid = document.createElement("video");
        vid.setAttribute("id", "video_" + playerId);
        vid.setAttribute("autoplay", "autoplay");
        vid.style.position = "absolute";
        vid.style.clipPath = "url(#clipVideo)";
        vid.style.transform = "rotateY(180deg)";
        document.body.appendChild(vid);
    }

    deletePlayer(playerId) {
        const player = this.players.get(playerId);
        // it seems the 'closed' event might be triggered twice
        if (this.players.delete(playerId)) {
            I("circ_" + playerId).remove();
            I("hitShade_" + playerId).remove();
            I("video_" + playerId).remove();
            I("pointerTriangle_" + playerId).remove();
            for (let snowball of player.snowballs) {
                I("snowball_" + playerId + "_" + snowball.id).remove();
            }
            for (let i = 0; i < 4; i++) {
                I(`gradient${i}_${playerId}`).remove();
                I(`viewBound${i}_${playerId}`).remove();
            }
        }
    }

    eventToWorldCoords(e) {
        const xInPort = e.clientX - this.myPlayer.view.x;
        const yInPort = e.clientY - this.myPlayer.view.y;
        return new Point(xInPort / this.myPlayer.view.scale, yInPort / this.myPlayer.view.scale);
    }
    
    positionElem(elem, x, y, w, h) {
        elem.style.left = (this.myPlayer.view.scale * x + this.myPlayer.view.x) + "px";
        elem.style.top = (this.myPlayer.view.scale * y + this.myPlayer.view.y) + "px";
        if (w) elem.style.width = (this.myPlayer.view.scale * w) + "px";
        if (h) elem.style.height = (this.myPlayer.view.scale * h) + "px";
    }
    
    positionPlayer(playerId, player) {
        positionCircle(I("circ_" + playerId), player.currentPos);
        I("pointerTriangle_" + playerId).setAttribute("d", 
            isoscelesTriangle(player.currentPos, pointerBaseWidth, player.shootingAngle, pointerRadius));
        this.positionElem(I("video_" + playerId), player.currentPos.x - headRadius, player.currentPos.y - headRadius, 2 * headRadius, 2 * headRadius);
    }
    
    addSnowball(snowball) {
        this.players.get(snowball.playerId).snowballs.set(snowball.id, snowball);
        const circ = svg("circle", {
            id: "snowball_" + snowball.playerId + "_" + snowball.id, 
            cx: -1234,
            cy: -1234,
            r: snowballRadius,
            fill: "white"
        }, []);
        I("arena").appendChild(circ);
    }

    hit(shooterId, targetId, snowballId) {
        const shooter = this.players.get(shooterId);
        const target = this.players.get(targetId);
        target.lastHitTime = performance.now() / 1000;
        target.lastHitColor = shooter.color;
        target.minusPoints++;
        shooter.plusPoints++;
        // while the packet from the target peer that tells us that the target peer has been hit
        // was in flight, the snowball speed might have reached zero or hit a wall and therefore
        // might already have been removed
        if (shooter.snowballs.delete(snowballId)) I("snowball_" + shooterId + "_" + snowballId).remove();
        this.updateRanking();
    }

    updateRanking() {
        let a = Array.from(this.players.values());
        a.sort((p1, p2) => p2.plusPoints - p2.minusPoints - (p1.plusPoints - p1.minusPoints));
        for (let i = 0; i < 2 && i < a.length; i++) {
            I("rank" + i).textContent = `${i+1}: ${a[i].plusPoints - a[i].minusPoints} (${a[i].plusPoints}-${a[i].minusPoints})`;
            I("rank" + i).setAttribute("fill", a[i].color);
        }
    }

    frame(timestamp) {
        const t = timestamp / 1000;
        if (this.lastT === null) this.lastT = t;
        const dt = t - this.lastT;
        const myPlayer = this.players.get(this.myId);

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

            for (let snowball of player.snowballs.values()) {
                const p = snowball.posAtTime(t);
                const p0 = snowball.posAtTime(snowball.birthTime);
                const traveled = p.sub(p0);
                const v = snowball.speedAtTime(t).norm();
                const dom = I("snowball_" + snowball.playerId + "_" + snowball.id);
                positionCircle(dom, p);
                // we only compute whether a snowball hits ourselves, because each peer computes & broadcasts its own hits
                const hit = playerId !== this.myId && snowball.hits(myPlayer, t, dt, headRadius + snowballRadius);
                if (hit) {
                    this.events.publish({ type: "hit", shooter: playerId, snowball: snowball.id });
                }
                if (lineSegmentIntersectsPolygon(p0, traveled, this.bounceLines) || v < epsilon) {
                    if (!hit) { // if hit, publish already removed the snowball
                        player.snowballs.delete(snowball.id);
                        dom.remove();
                    }
                }
            }

            const truePos = player.posAtTime(t);
            this.positionPlayer(playerId, player);

            const transparency = (t - player.lastHitTime) / this.hitAnimationLength;
            const hitShade = I("hitShade_" + playerId);
            if (transparency <= 1) {
                positionCircle(hitShade, player.currentPos);
                hitShade.setAttribute("stroke-opacity", 1 - transparency);
                hitShade.setAttribute("stroke", player.lastHitColor);
            } else {
                hitShade.setAttribute("stroke-opacity", 0);
            }
            player.oldPos = truePos;
        }
        const pointerTip = myPlayer.currentPos.add(Point.polar(pointerRadius, myPlayer.shootingAngle));
        positionCircle(I("noCursor"), pointerTip);
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
        //if (nReflections > 0) console.log(`nReflections = ${nReflections}`);
    }
}

function makeControllerLink(myId) {
    const folder = `${window.location.protocol}//${window.location.host}${window.location.pathname.replace("/index.html", "")}`;
    return `${folder}/swipepad.html?connectTo=${myId}`;
}

class PlayerPeer {
    constructor(id, gameState, gameConnections) {
        this.id = id;
        this.dataConn = null;
        this.mediaConn = null;
        this.gameState = gameState;
        this.gameConnections = gameConnections;
        this.timeSeniority = null; // how many seconds before me did this player start its clock?
        this.unacked = new Set();
        this.minRTT = Number.POSITIVE_INFINITY;
        this.maxRTT = Number.NEGATIVE_INFINITY;
        this.avgRTT = null;
        this.fastAckCount = 0;
        this.totalAckCount = 0;
        this.lostPacketCount = 0;
        this.lastRTTMsg = "";
        this.lastTimeSeniorityMsg = "";
        gameState.addPlayer(id, "black");
    }

    setDataConn(dataConn) {
        this.dataConn = dataConn;
        dataConn.on('open', () => {
            log.connection("Connection to " + dataConn.peer + " open");
            // when someone new joins, stop shooting for a while to say hi ;)
            this.gameState.events.publishShowPointers(false);
        });
        dataConn.on('data', e => {
            log.data(`data received from ${dataConn.peer}`);
            log.data(e);
            if (e.sentT) { // presence of sentT means "please ack this"
                this.send({
                    type: "ack", 
                    originalSentT: e.sentT, 
                    receivedT: Math.round(performance.now()),
                    timeSeniority: this.timeSeniority?.toFixed(3)
                });
            }
            if (e.type === "ack") {
                const timeResponseReceived = performance.now();
                const rtt = timeResponseReceived - e.originalSentT;
                //nsole.log(`RTT to ${this.id}: ${rtt}ms`);
                const timeResponseSent = (e.originalSentT + timeResponseReceived) / 2;
                const ts = (e.receivedT - timeResponseSent) / 1000;
                let newTimeSeniority = null;
                if (this.timeSeniority === null) {
                    newTimeSeniority = ts;
                    this.minRTT = rtt;
                    this.fastAckCount = 1;
                } else if (rtt < this.minRTT * 1.1) {
                    this.minRTT = Math.min(rtt, this.minRTT);
                    newTimeSeniority = (this.timeSeniority * this.fastAckCount + ts) / (this.fastAckCount + 1); // weighted average
                    this.fastAckCount++;
                }
                this.maxRTT = Math.max(rtt, this.maxRTT);
                this.avgRTT = (this.avgRTT * this.totalAckCount + rtt) / (this.totalAckCount + 1); // weighted average
                this.totalAckCount++;
                const newRTTMsg = `RTT to ${this.id}: min ${Math.round(this.minRTT)}ms, avg ${Math.round(this.avgRTT)}ms, max ${Math.round(this.maxRTT)}ms, `;
                if (newRTTMsg !== this.lastRTTMsg) {
                    const packetLossMsg = `${this.lostPacketCount}/${this.totalAckCount+this.lostPacketCount} packets lost (` +
                        (100*this.lostPacketCount/(this.totalAckCount+this.lostPacketCount)).toFixed(2) + "%)";
                    log.connection(newRTTMsg + packetLossMsg);
                    this.lastRTTMsg = newRTTMsg;
                }
                if (newTimeSeniority !== null) {
                    const newTimeSeniorityMsg = `We think the clock of ${this.id} started ${newTimeSeniority.toFixed(3)}s earlier, ` +
                        `who thinks its clock started ${e.timeSeniority} earlier`;
                    if (newTimeSeniorityMsg != this.lastTimeSeniorityMsg) {
                        log.connection(newTimeSeniorityMsg);
                        this.lastTimeSeniorityMsg = newTimeSeniorityMsg;
                    }
                    this.timeSeniority = newTimeSeniority;
                }
                this.unacked.delete(e.originalSentT);
                for (let t of this.unacked) {
                    if (timeResponseReceived - t > 10000) {
                        this.unacked.delete(t);
                        this.lostPacketCount++;
                    }
                }
            } else if (e.type === "trajectory") {
                const player = this.gameState.players.get(this.id);
                player.zeroSpeedPos = new Point(parseFloat(e.x0), parseFloat(e.y0));
                player.zeroSpeedTime = e.t0 - this.timeSeniority;
                player.angle = e.angle;
                if (e.plusPoints !== player.plusPoints) {
                    log.state(`setting ${this.id}.plusPoints (currently ${player.plusPoints}) to ${e.plusPoints}`);
                    player.plusPoints = e.plusPoints;
                    this.gameState.updateRanking();
                }
                if (e.minusPoints !== player.minusPoints) {
                    log.state(`setting ${this.id}.minusPoints (currently ${player.minusPoints}) to ${e.minusPoints}`);
                    player.minusPoints = e.minusPoints;
                    this.gameState.updateRanking();
                }
                player.shootingAngle = e.shootingAngle;
                this.gameState.setPlayerColor(this.id, e.color);
                this.gameConnections.connectToNewPeers(e.peers);
            } else {
                // TODO refactor to handle all the above in `events` as well
                this.gameState.events.processEvent(this.id, e);
            }
        });
        dataConn.on('close', () => {
            log.connection(`Connection to ${dataConn.peer} closed`);
            if (this.mediaConn?.open) this.mediaConn.close();
            this.gameConnections.playerPeers.delete(this.id);
            this.gameState.deletePlayer(this.id);
        });
    }

    setMediaConn(mediaConn) {
        this.mediaConn = mediaConn;
        mediaConn.on('stream', stream => {
            I("video_" + mediaConn.peer).srcObject = stream;
        });
    }

    send(msg) {
        if (!this.dataConn) {
            // race condition between obtaining a dataConn and a mediaConn at initialization
            log.connection("PlayerPeer.dataConn not yet set");
            return;
        }
        if (msg.sentT) {
            this.unacked.add(msg.sentT);
        }
        sendMessage(this.dataConn, msg);
    }
}


function transferAttrsToDom(j, attrs, target) {
    for (const attr of attrs) {
        if (j[attr] !== undefined) target.setAttribute(attr, j[attr]);
    }
}

function transferAttrsToObj(j, attrs, target) {
    for (const attr of attrs) {
        if (j[attr] !== undefined) target[attr] = j[attr];
    }
}

function floatifyAttrs(o, attrs) {
    for (const attr of attrs) {
        if (o[attr] === null || o[attr] === undefined) continue;
        o[attr] = parseFloat(o[attr]);
    }
}

class Events {
    constructor(playerPeers, gameState) {
        this.playerPeers = playerPeers;
        this.gameState = gameState;
    }
    publishSnowball(direction) {
        const player = this.gameState.players.get(this.gameState.myId);
        const snowball = new Snowball(player.posAtTime(this.gameState.lastT), player.freshSnowballId(), this.gameState.myId, this.gameState.lastT);
        snowball.setSpeed(this.gameState.lastT, direction.scaleToLength(snowballSpeed));
        this.publish(snowball.toJson());
    }
    publishShowPointers(showPointers) {
        this.publish({ type: "upd", showPointers: showPointers });
    }
    publish(e) {
        this.processEvent(this.gameState.myId, e);
        this.broadcastEvent(e);
    }
    processEvent(sourceId, e) {
        switch (e.type) {
            case "upd":
                if (e.view) {
                    floatifyAttrs(e.view, ['x', 'y', 'scale', 'w', 'h']);
                    transferAttrsToObj(e.view, ['x', 'y', 'scale', 'w', 'h'], this.gameState.players.get(e.id).view);
                    this.gameState.viewUpdate(e.id);
                }
                if (e.showPointers !== undefined) {
                    this.gameState.showPointers = e.showPointers;
                }
                break;
            case "snowball":
                const snowball = Snowball.fromJson(e);
                snowball.playerId = sourceId;
                const timeSeniority = sourceId === this.gameState.myId ? 0 : this.playerPeers.get(sourceId).timeSeniority;
                snowball.zeroSpeedTime -= timeSeniority;
                snowball.birthTime -= timeSeniority;
                this.gameState.addSnowball(snowball);
                break;
            case "hit":
                this.gameState.hit(e.shooter, sourceId/*source of event=target of ball*/, e.snowball);
                break;
            default:
                throw `Unknown event type ${e.type} (or event type that should be handled elsewhere)`;
        }
    }
    broadcastEvent(e) {
        for (let playerPeer of this.playerPeers.values()) {
            playerPeer.send(e);
        }
    }
}

let maxPlayerSpeed = 16;
let snowballSpeed = 16;
let movementScale = 4;

class GameConnections {
    constructor(myId, gameState) {
        this.myId = myId;
        this.peer = new Peer(myId, {debug: 2});
        this.playerPeers = new Map();
        this.hasTouchpadPeer = false;
        this.gameState = gameState;
        this.mediaStream = undefined;

        setInterval(() => { this.broadcastTrajectory(); }, 678);

        this.peer.on('open', (id) => {
            log.connection("PeerJS server gave us ID " + id);
            log.connection("Controller link to use on your phone:", makeControllerLink(id));
            log.connection("Waiting for peers to connect");
        });
    
        this.peer.on('connection', dataConn => {
            switch (dataConn.metadata?.type) {
                case "player":
                    log.connection("Connected to player " + dataConn.peer);
                    let pp = null;
                    if (this.playerPeers.has(dataConn.peer)) {
                        pp = this.playerPeers.get(dataConn.peer); 
                    } else {
                        pp = new PlayerPeer(dataConn.peer, this.gameState, this);
                        this.playerPeers.set(dataConn.peer, pp);
                    }
                    pp.setDataConn(dataConn);
                    break;
                case "touchpad":
                    if (this.hasTouchpadPeer) {
                        log.connection("Rejecting touchpad connection because there already is one");
                        dataConn.close();
                    } else {
                        log.connection("Connected to touchpad " + dataConn.peer);
                        this.hasTouchpadPeer = true;
                        dataConn.on('open', () => {
                            log.connection("Connection to touchpad " + dataConn.peer + " open");
                        });
                        let lastThrowTime = Number.NEGATIVE_INFINITY; // TODO remove once we only react to swipe events
                        dataConn.on('data', e => {
                            log.data(`data received from ${dataConn.peer}`);
                            log.data(e);
                            const speed = new Point(e.speedX, e.speedY);
                            if (e.side === "left") {
                                const adjustedSpeed = speed.norm() > 16 ? speed.scaleToLength(maxPlayerSpeed) : speed;
                                this.gameState.setPlayerSpeed(this.myId, adjustedSpeed);
                                this.broadcastTrajectory();
                            }
                            if (e.side === "right") {
                                const rechargeTime = 0.3; // we need that little time to create a new snowball
                                if (this.gameState.lastT - lastThrowTime < rechargeTime || speed.norm() < 5) return;
                                lastThrowTime = this.gameState.lastT;
                                this.gameState.events.publishSnowball(speed);
                            }
                        });
                        dataConn.on('close', () => {
                            log.connection(`Connection to touchpad ${dataConn.peer} closed`);
                            this.hasTouchpadPeer = false;
                        });
                    }
                    break;
                case "swipepad":
                    log.connection("Connected to swipepad " + dataConn.peer);
                    dataConn.on('open', () => {
                        log.connection("Connection to swipepad " + dataConn.peer + " open");
                    });
                    dataConn.on('data', e => {
                        log.data(`data received from ${dataConn.peer}`);
                        log.data(e);
                        const dist = new Point(e.deltaX * movementScale, e.deltaY * movementScale);
                        const player = this.gameState.players.get(this.myId);
                        if (e.side === "left") {
                            const oldSpeed = player.speedAtTime(this.gameState.lastT);
                            const speed = dist.scale(1 / e.deltaT);
                            const newSpeed = oldSpeed.add(speed);
                            const adjustedSpeed = newSpeed.norm() > maxPlayerSpeed ? newSpeed.scaleToLength(maxPlayerSpeed) : newSpeed;
                            //nsole.log(oldSpeed.norm().toFixed(2), speed.norm().toFixed(2), adjustedSpeed.norm().toFixed(2));
                            this.gameState.setPlayerSpeed(this.myId, adjustedSpeed);
                            this.broadcastTrajectory();
                        }
                        if (e.side === "right") {
                            this.gameState.events.publishSnowball(dist);
                        }
                    });
                    dataConn.on('close', () => {
                        log.connection(`Connection to swipepad ${dataConn.peer} closed`);
                    });
                    break;                    
                default:
                    log.connection("Rejecting connection of unknown type " + dataConn.metadata?.type);
                    dataConn.close();
                    break;
            }
        });

        this.peer.on('call', mediaConn => {
            mediaConn.answer(this.mediaStream);
            let pp = null;
            if (this.playerPeers.has(mediaConn.peer)) {
                pp = this.playerPeers.get(mediaConn.peer); 
            } else {
                pp = new PlayerPeer(mediaConn.peer, this.gameState, this);
                this.playerPeers.set(mediaConn.peer, pp);
            }
            pp.setMediaConn(mediaConn);
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

    connectToNewPeer(peerId) {
        log.connection("Initiating connection to " + peerId);
        const dataConn = this.peer.connect(peerId, { 
            reliable: false,
            metadata: { type: "player" }
        });
        const pp = new PlayerPeer(peerId, this.gameState, this);
        pp.setDataConn(dataConn);
        if (this.mediaStream) {
            pp.setMediaConn(this.peer.call(peerId, this.mediaStream));
        }
        this.playerPeers.set(peerId, pp);
    }

    connectToNewPeers(peerIds) {
        for (let peerId of peerIds) {
            if (this.myId !== peerId && !this.playerPeers.has(peerId)) {
                this.connectToNewPeer(peerId);
            }
        }
    }

    broadcastTrajectory() {
        const player = this.gameState.players.get(this.myId);
        const m = player.trajectoryJson();
        // this is the kitchen sink message periodically providing all state managed by one player
        m.type = "trajectory";
        m.shootingAngle = player.shootingAngle;
        m.plusPoints = player.plusPoints;
        m.minusPoints = player.minusPoints;
        m.color = player.color;
        m.peers = Array.from(this.playerPeers.keys());
        this.broadcast(m);
    }

    broadcast(msg) {
        for (let playerPeer of this.playerPeers.values()) {
            playerPeer.send(msg);
        }
    }

    shutdown() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                return true;
            });
        }
        this.peer.destroy();
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

function pointsToPolygonStr(points) {
    return points.map(p => p.x + "," + p.y).join(' ');
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

function lineSegmentsIntersect(a, v, b, w) {
    const coeffs = lineIntersectionCoeffs(a, v, b, w);
    if (coeffs === null) {
        return false;
    } else {
        const [s, t] = coeffs;
        return 0 <= s && s <= 1 && 0 <= t && t <= 1;
    }
}

// Does the line segment going from a to a.add(v) intersect any of the line segment in lines?
function lineSegmentIntersectsPolygon(a, v, lines) {
    return lines.some(([b, w]) => lineSegmentsIntersect(a, v, b, w));
}

const colorNames = [ 
    "blue", 
    "burlywood", 
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
    playerStartPos = new Point(4, 5);
    const playerStartRadius = 5;
    const myId = urlParams.get("myId");
    const events = new Events();
    const gs = new GameState(myId, bounceLines, events);
    const color = urlParams.get("color") || randomColor();
    gs.addPlayer(myId, color);
    gs.players.get(myId).setSpeed(performance.now()/1000, Point.polar(playerStartRadius, Math.random() * 2 * Math.PI));
    const gco = new GameConnections(myId, gs);
    events.playerPeers = gco.playerPeers;
    events.gameState = gs;

    initMouseMoveNavi(gs);

    I("activateCamera").onclick = () => {
        I("activateCamera").remove();
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 240, height: 240 }
        }).then(stream => {
            I("video_" + myId).srcObject = stream;
            I("video_" + myId).muted = true; // we don't want to hear ourselves
            gco.mediaStream = stream;
        }).catch(err => {
            console.log("Error obtaining video:", err);
        }).then(() => {
            if (urlParams.has("friendId")) {
                gco.connectToNewPeer(urlParams.get("friendId"));
            }
        });
    }

    let handle = window.requestAnimationFrame(paint);
    function paint(timestamp) {
        gs.frame(timestamp);
        handle = window.requestAnimationFrame(paint);    
    }

    window.addEventListener("keypress", e => {
        if (e.key === "q") {
            gco.shutdown();
            window.cancelAnimationFrame(handle);
        }
    });

    gs.setTransform();
}

window.onload = init;

