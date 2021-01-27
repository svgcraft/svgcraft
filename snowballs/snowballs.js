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
    constructor(initialPos, color, id) {
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
        this.id = id;
        
        this.snowballs = new Map();
        this.pointerAngle = 0;

        this.lastHitTime = Number.NEGATIVE_INFINITY;
        this.lastHitColor = null;
        this.minusPoints = 0;
        this.plusPoints = 0;

        this.tool = "navigation";

        this.tongsRadius = pointerRadius;
        // relative to pointerAngle
        this.maxTongAngle = Math.PI / 20;
        this.leftTongAngle = this.maxTongAngle;
        this.rightTongAngle = this.maxTongAngle;
        this.draggee = null;
        this.relDraggeePos = null;
        this.capturedBy = null;

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
    get decceleration() {
        return playerDecceleration;
    }
    state_upd() {
        const m = {
            type: "upd"
        };
        transferAttrsToObj(this, ["view", "tool", "maxTongAngle", "leftTongAngle", "rightTongAngle", "tongsRadius", "relDraggeePos"], m);
        if (this.draggee) m.draggee = this.draggee.id;
        return m;
    }
}

let snowballDecceleration = 4;

class Snowball extends DecceleratingObject {
    constructor(initialPos, id, playerId, birthTime) {
        super(initialPos);
        this.id = id; // a globally unique string id
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
const toolRadius = 0.25;
const toolDist = pointerRadius - headRadius - toolRadius; // distance between head and tools, and between tools
const toolDistAngle = Math.asin((toolDist/2 + toolRadius) / (headRadius + toolDist + toolRadius)) * 2;
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

// l: list of string or Point
function pathStr(l) {
    return l.map(e => typeof(e) === "string" ? e : e.x + " " + e.y).join(" ");
}

function isoscelesTriangle(baseMid, baseLength, rotation, height) {
    const tip = baseMid.add(Point.polar(height, rotation));
    const p1 = baseMid.add(Point.polar(baseLength/2, rotation + Math.PI/2));
    const p2 = baseMid.add(Point.polar(baseLength/2, rotation - Math.PI/2));
    return pathStr(["M", p1, "L", p2, "L", tip, "z"]);
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

function initMiscEvents(gameState) {
    I("arenaWrapper").addEventListener("wheel", e => {
        e.preventDefault();
        const zoomChange = Math.exp(e.deltaY * -0.001);
        gameState.events.publish({
            type: "upd",
            view: {
                x: e.clientX - (e.clientX - gameState.myPlayer.view.x) * zoomChange,
                y: e.clientY - (e.clientY - gameState.myPlayer.view.y) * zoomChange,
                scale: gameState.myPlayer.view.scale * zoomChange
            }
        });
    });
    function onResize() {
        const r = I("arenaWrapper").getBoundingClientRect();
        gameState.events.publish({ type: "upd", view: { w: r.width, h: r.height } } );
    }
    window.addEventListener("resize", onResize);
    onResize();
}

const styleAttrs = ["stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "fill", "fill-opacity", "text-anchor", "font-size"];
const positionAttrs = ["cx", "cy", "r", "rx", "ry", "d", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "textContent"];
const gAttrs = ["x0", "y0", "scale"];
const updatableSvgAttrs = styleAttrs.concat(positionAttrs);
const updatableAttrs = updatableSvgAttrs.concat(gAttrs);

function transferAttrsToDom(j, attrs, target) {
    for (const attr of attrs) {
        if (j[attr] !== undefined) {
            if (attr === "textContent") {
                target.textContent = j[attr];
            } else {
                target.setAttribute(attr, j[attr]);
            }
        }
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
        this.nextFreshId = 0;
        this.objects = new Map();
    }

    update(e) {
        const parent = I(e.parent);
        if (parent === undefined) {
            log.state(`Ignoring object because its parent ${e.parent} was not found`, e);
            return;
        }
        let o = this.objects.get(e.id);
        let d = I(e.id) ?? undefined;
        if ((o === undefined) != (d === undefined)) throw 'GameState.objects and DOM got out of sync';
        const needsG = e.type === "rect" || e.type === "circle";
        if (o === undefined) {
            o = { type: e.type, id: e.id, scale: 1, parent: e.parent };
            this.objects.set(o.id, o);
            if (needsG) {
                d = svg(e.type);
                const g = svg("g", { id: e.id }, [d]);
                parent.appendChild(g)
            } else {
                d = svg(e.type, { id: e.id });
                if (e.type === "text") {
                    d.style.pointerEvents = "none";
                    d.style.cursor = "default";
                }
                parent.appendChild(d);
            }
        } else {
            if (needsG) d = d.children[0];
        }
        transferAttrsToObj(e, updatableAttrs, o);
        transferAttrsToDom(o, updatableSvgAttrs, d);
        if (needsG) {
            d.parentNode.setAttribute("transform", `translate(${o.x0}, ${o.y0}) scale(${o.scale})`);
        }
    }

    absCoordsIn(x, y, id) {
        if (id === "objects") return new Point(x, y);
        const o = this.objects.get(id);
        return this.absCoordsIn(x * o.scale + o.x0, y * o.scale + o.y0, o.parent);
    }

    absCoords(o) {
        return this.absCoordsIn(o.x0, o.y0, o.parent);
    }

    absLengthIn(l, id) {
        if (id === "objects") return l;
        const o = this.objects.get(id);
        return this.absLengthIn(l * o.scale, o.parent);
    }

    freshId() {
        return `${this.myId}_${this.nextFreshId++}`;
    }

    get myPlayer() {
        return this.players.get(this.myId);
    }

    setPlayerSpeed(playerId, speed) {
        // Note: We don't use an event timestamp, otherwise we get non-linear time and can jump over walls
        this.players.get(playerId).setSpeed(this.lastT, speed);
    }

    setPlayerColor(playerId, color) {
        this.players.get(playerId).color = color;
        I("circ_" + playerId).setAttribute("fill", color);
        for (let i = 0; i < 4; i++) {
            for (const stop of I(`gradient${i}_${playerId}`).getElementsByTagName("stop")) {
                stop.setAttribute("stop-color", color);
            }
        }
        // TODO for modularity, this code should be in each tool
        I("pointerTriangle_" + playerId)?.setAttribute("fill", color);
        I("leftTongTriangle_" + playerId)?.setAttribute("fill", color);
        I("rightTongTriangle_" + playerId)?.setAttribute("fill", color);
    }

    encodeTransform() {
        return `translate(${this.myPlayer.view.x}px, ${this.myPlayer.view.y}px) scale(${this.myPlayer.view.scale})`;
    }
    
    setTransform() {
        I("arena").style.transform = this.encodeTransform();
    }

    adaptViewToPlayerPos() {
        const p = this.myPlayer;
        const v = {
            x: - (p.currentPos.x - p.view.w / p.view.scale / 2) * p.view.scale,
            y: - (p.currentPos.y - p.view.h / p.view.scale / 2) * p.view.scale,
        };
        this.events.publish({ type: "upd", view: v } );
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
        const player = new Player(playerStartPos, color, playerId);
        this.players.set(playerId, player);

        const circ = svg("circle", {
            id: "circ_" + playerId, 
            cx: player.currentPos.x, 
            cy: player.currentPos.y, 
            r: headRadius,
            fill: color
        }, []);
        I("players").appendChild(circ);

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
        I("players").appendChild(hitShade);

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
            I("players").appendChild(svg("polygon", { 
                id: `viewBound${i}_${playerId}`, 
                class: "viewBound", 
                fill: `url(#gradient${i}_${playerId})`,
                "pointer-events": "none"
            }));
        }

        const vid = document.createElement("video");
        vid.setAttribute("id", "video_" + playerId);
        vid.setAttribute("autoplay", "autoplay");
        vid.style.position = "absolute";
        vid.style.pointerEvents = "none"; // clicks go through down to the svg circle
        vid.style.clipPath = "url(#clipVideo)";
        vid.style.transform = "rotateY(180deg)";
        I("arenaWrapper").appendChild(vid);
    }

    deletePlayer(playerId) {
        const player = this.players.get(playerId);
        // it seems the 'closed' event might be triggered twice
        if (this.players.delete(playerId)) {
            window.uiEventsHandler.tools[player.tool].deactivateFor(playerId);
            I("circ_" + playerId).remove();
            I("hitShade_" + playerId).remove();
            I("video_" + playerId).remove();
            for (let snowball of player.snowballs) {
                I(snowball.id).remove();
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

    worldToPixelCoords(p) {
        return new Point(
            this.myPlayer.view.scale * p.x + this.myPlayer.view.x,
            this.myPlayer.view.scale * p.y + this.myPlayer.view.y
        );                
    }
    
    positionElem(elem, x, y, w, h) {
        const p = this.worldToPixelCoords(new Point(x, y));
        elem.style.left = p.x + "px";
        elem.style.top = p.y + "px";
        if (w) elem.style.width = (this.myPlayer.view.scale * w) + "px";
        if (h) elem.style.height = (this.myPlayer.view.scale * h) + "px";
    }
    
    positionPlayer(player) {
        positionCircle(I("circ_" + player.id), player.currentPos);
        window.uiEventsHandler.tools[player.tool].positionFor(player.id);
        this.positionElem(I("video_" + player.id), player.currentPos.x - headRadius, player.currentPos.y - headRadius, 2 * headRadius, 2 * headRadius);
        if (player.draggee && !(player.draggee instanceof Player)) {
            this.positionObj(player.draggee, player.currentPos.add(player.relDraggeePos));
        }
    }

    positionObj(o, absPos) {
        this.applyAbsCoordsRelatively(o.parent, (x, y) => {
            o.x0 = x;
            o.y0 = y;
            I(o.id).setAttribute("transform", `translate(${o.x0}, ${o.y0}) scale(${o.scale})`);
        })(absPos.x, absPos.y);
    }
    
    applyAbsCoordsRelatively(anchor, f) {
        if (anchor === "objects") {
            return f;
        } else {
            const anchorO = this.objects.get(anchor);
            return this.applyAbsCoordsRelatively(anchorO.parent, (x, y) => f((x - anchorO.x0)/anchorO.scale, (y - anchorO.y0)/anchorO.scale));
        }
    }

    addSnowball(snowball) {
        this.players.get(snowball.playerId).snowballs.set(snowball.id, snowball);
        const circ = svg("circle", {
            id: snowball.id, 
            cx: -1234,
            cy: -1234,
            r: snowballRadius,
            fill: "white"
        }, []);
        I("players").appendChild(circ);
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
        if (shooter.snowballs.delete(snowballId)) I(snowballId).remove();
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
                const dom = I(snowball.id);
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

            const transparency = (t - player.lastHitTime) / this.hitAnimationLength;
            const hitShade = I("hitShade_" + playerId);
            if (transparency <= 1) {
                positionCircle(hitShade, player.currentPos);
                hitShade.setAttribute("stroke-opacity", 1 - transparency);
                hitShade.setAttribute("stroke", player.lastHitColor);
            } else {
                hitShade.setAttribute("stroke-opacity", 0);
            }
            const truePos = player.posAtTime(t);
            player.oldPos = truePos;
        }

        for (let [playerId, player] of this.players) {
            if (player.capturedBy) {
                player.currentPos = player.capturedBy.currentPos.add(player.capturedBy.relDraggeePos);
            }
            this.positionPlayer(player);
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
        //if (nReflections > 0) console.log(`nReflections = ${nReflections}`);
    }
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

    setDataConn(dataConn, requestDump) {
        this.dataConn = dataConn;
        dataConn.on('open', () => {
            log.connection("Connection to " + dataConn.peer + " open");
            this.send(this.gameState.myPlayer.state_upd()); // TODO move more "trajectory" kitchen sink data here
            if (requestDump) this.send({ type: "getdump" });
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
            } else if (e.type === "getdump") {
                this.send(Array.from(this.gameState.objects.values()));
            } else {
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

class Events {
    constructor(playerPeers, gameState) {
        this.playerPeers = playerPeers;
        this.gameState = gameState;
    }
    publishSnowball(direction) {
        const player = this.gameState.players.get(this.gameState.myId);
        const snowball = new Snowball(player.posAtTime(this.gameState.lastT), this.gameState.freshId(), this.gameState.myId, this.gameState.lastT);
        snowball.setSpeed(this.gameState.lastT, direction.scaleToLength(snowballSpeed));
        this.publish(snowball.toJson());
    }
    publishActiveTool(toolname) {
        this.publish({
            type: "upd",
            id: this.gameState.myId,
            tool: toolname
        });
    }
    publish(e) {
        this.processEvent(this.gameState.myId, e);
        this.broadcastEvent(e);
    }
    get gameConnections() {
        // all PlayerPeers link to the same GameConnections object, TODO maybe there's a nicer way to access it?
        return this.playerPeers.values().next().value.gameConnections;
    }
    processEvent(sourceId, e) {
        if (Array.isArray(e)) {
            for (const x of e) this.processOneEvent(sourceId, x);
        } else {
            this.processOneEvent(sourceId, e);
        }
    }
    processOneEvent(sourceId, e) {
        const timeSeniority = sourceId === this.gameState.myId ? 0 : this.playerPeers.get(sourceId).timeSeniority;
        const player = this.gameState.players.get(sourceId);
        switch (e.type) {
            case "upd":
                if (e.view) {
                    floatifyAttrs(e.view, ['x', 'y', 'scale', 'w', 'h']);
                    transferAttrsToObj(e.view, ['x', 'y', 'scale', 'w', 'h'], player.view);
                    this.gameState.viewUpdate(sourceId);
                }
                if (e.tool) {
                    // TODO get rid of global variables
                    window.uiEventsHandler.tools[player.tool].deactivateFor(sourceId);
                    player.tool = e.tool;
                    window.uiEventsHandler.tools[player.tool].activateFor(sourceId);
                }
                player.leftTongAngle = e.leftTongAngle ?? player.leftTongAngle;
                player.rightTongAngle = e.rightTongAngle ?? player.rightTongAngle;
                player.tongsRadius = e.tongsRadius ?? player.tongsRadius;
                if (e.maxTongAngle !== undefined) {
                    player.maxTongAngle = e.maxTongAngle;
                    player.leftTongAngle = e.maxTongAngle;
                    player.rightTongAngle = e.maxTongAngle;
                }
                if (e.leftTongAngle !== undefined || e.rightTongAngle !== undefined || e.tongsRadius !== undefined || e.maxTongAngle !== undefined) {
                    window.uiEventsHandler.tools[player.tool].positionFor(sourceId);
                }
                if (e.draggee) {
                    const dr = this.gameState.players.get(e.draggee);
                    if (dr) {
                        dr.capturedBy = player;
                        player.draggee = dr;
                    } else {
                        player.draggee = this.gameState.objects.get(e.draggee);
                    }
                }
                if (e.draggee === null && player.draggee) {
                    if (player.draggee instanceof Player) player.draggee.capturedBy = null;
                    player.draggee = null;
                }
                if (e.relDraggeePos !== undefined) player.relDraggeePos = e.relDraggeePos;
                break;
            case "rect":
            case "line":
            case "circle":
            case "text":
                this.gameState.update(e);
                break;
            case "snowball":
                const snowball = Snowball.fromJson(e);
                snowball.playerId = sourceId;
                snowball.zeroSpeedTime -= timeSeniority;
                snowball.birthTime -= timeSeniority;
                this.gameState.addSnowball(snowball);
                break;
            case "hit":
                this.gameState.hit(e.shooter, sourceId/*source of event=target of ball*/, e.snowball);
                break;
            case "trajectory":
                player.zeroSpeedPos = new Point(parseFloat(e.x0), parseFloat(e.y0));
                player.zeroSpeedTime = e.t0 - timeSeniority;
                player.angle = e.angle;
                if (e.plusPoints !== undefined && e.plusPoints !== player.plusPoints) {
                    log.state(`setting ${sourceId}.plusPoints (currently ${player.plusPoints}) to ${e.plusPoints}`);
                    player.plusPoints = e.plusPoints;
                    this.gameState.updateRanking();
                }
                if (e.minusPoints !== undefined && e.minusPoints !== player.minusPoints) {
                    log.state(`setting ${sourceId}.minusPoints (currently ${player.minusPoints}) to ${e.minusPoints}`);
                    player.minusPoints = e.minusPoints;
                    this.gameState.updateRanking();
                }
                if (e.pointerAngle !== undefined) {
                    player.pointerAngle = e.pointerAngle;
                }
                if (e.color !== undefined) this.gameState.setPlayerColor(sourceId, e.color);
                if (e.peers !== undefined) this.gameConnections.connectToNewPeers(e.peers);
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

    connectToNewPeer(peerId, requestDump) {
        log.connection("Initiating connection to " + peerId);
        const dataConn = this.peer.connect(peerId, { 
            reliable: true,
            metadata: { type: "player" }
        });
        const pp = new PlayerPeer(peerId, this.gameState, this);
        pp.setDataConn(dataConn, requestDump);
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
        m.pointerAngle = player.pointerAngle;
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
    playerStartPos = new Point(-20, 5);
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

    initMiscEvents(gs);
    gs.adaptViewToPlayerPos();

    const videoRes = urlParams.get("videoRes") || 240;
    I("activateCamera").onclick = () => {
        I("activateCamera").remove();
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: videoRes, height: videoRes }
        }).then(stream => {
            I("video_" + myId).srcObject = stream;
            I("video_" + myId).muted = true; // we don't want to hear ourselves
            gco.mediaStream = stream;
        }).catch(err => {
            console.log("Error obtaining video:", err);
        }).then(() => {
            if (urlParams.has("friendId")) {
                gco.connectToNewPeer(urlParams.get("friendId"), true);
            }
        });
    }

    if (!urlParams.has("friendId")) {
        new Mill(new Point(-16, 5), gs).init();
        if (urlParams.has("letters")) {
            new LetterSoup(new Point(-26, 5), gs, urlParams.get("letters")).init();
        }
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
    init_uievents(gs);
}

window.onload = init;

