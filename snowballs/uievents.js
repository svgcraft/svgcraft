"use strict";

class Tool {
    constructor(gameState) {
        this.gameState = gameState;
    }
    static iconColor = "#E75A70";
    // can be dynamically computed depending on player position
    get enabled() {
        return false;
    }
    // probably constant, measured from center of player
    get playerDistToMouse() {
        return pointerRadius;
    }
    get iconSvg() {
        throw "should be implemented by subclass";
    }
    activateFor(playerId) {
        throw "should be implemented by subclass";
    }
    positionFor(playerId) {
        throw "should be implemented by subclass";
    }
    deactivateFor(playerId) {
        throw "should be implemented by subclass";
    }
    pointerdown(e) {
        throw "should be implemented by subclass";
    }
    hover(e) {
        const mouse = this.gameState.eventToWorldCoords(e);
        const current = this.gameState.myPlayer.posAtTime(this.gameState.lastT);
        const d = current.sub(mouse);
        const targetZero = mouse.add(d.scaleToLength(this.playerDistToMouse));
        const move = targetZero.sub(current);
        const tToStop = Math.sqrt(2 * move.norm() / this.gameState.myPlayer.decceleration);
        this.gameState.events.publish({
            type: "trajectory",
            x0: targetZero.x,
            y0: targetZero.y,
            t0: this.gameState.lastT + tToStop,
            angle: d.angle(),
            // when bouncing on a wall, angle changes, while pointerAngle remains
            pointerAngle: oppositeAngle(d.angle())
        });
    }
    first_drag(e) {
        throw "should be implemented by subclass";
    }
    continue_drag(e) {
        throw "should be implemented by subclass";
    }
    end_drag(e) {
        throw "should be implemented by subclass";
    }
    click(e) {}
    keydown(e) {
        if (e.key === "b") {
            I("arena").classList.toggle("hideViewBounds");
        }
    }
}

class ToolSelectionTool extends Tool {
    constructor(gameState) {
        super(gameState);
    }
    activateFor(playerId) {}
    positionFor(playerId) {}
    deactivateFor(playerId) {}
    pointerdown(e) {}
    hover(e) {}
    first_drag(e) {}
    continue_drag(e) {}
    end_drag(e) {}
}

class NavigationTool extends Tool {
    constructor(gameState) {
        super(gameState);
        // e.clientX/Y of last mouse event
        this.last_clientX = null;
        this.last_clientY = null;
    }
    get enabled() {
        return true;
    }
    get iconSvg() {
        return svg("g", { transform: `scale(${1/70}) translate(-15, -15)`}, [
            svg("path", {
                "d": "M 6 15 L 24 15",
                "stroke": Tool.iconColor,
                "stroke-width": 3,
                "marker-start": "url(#red_arrowhead)",
                "marker-end": "url(#red_arrowhead)"
            }),
            svg("path", {
                "d": "M 15 6 L 15 24",
                "stroke": Tool.iconColor,
                "stroke-width": 3,
                "marker-start": "url(#red_arrowhead)",
                "marker-end": "url(#red_arrowhead)"
            }),
        ]);
    }
    activateFor(playerId) {}
    positionFor(playerId) {}
    deactivateFor(playerId) {}
    pointerdown(e) {
        this.last_clientX = e.clientX;
        this.last_clientY = e.clientY;
    }
    first_drag(e) {
        this.move_impl(e);
    }
    continue_drag(e) {
        this.move_impl(e);
    }
    end_drag(e) {}
    move_impl(e) {
        const dx = e.clientX - this.last_clientX;
        const dy = e.clientY - this.last_clientY;
        this.last_clientX = e.clientX;
        this.last_clientY = e.clientY;
        this.gameState.events.publish({
            type: "upd",
            view: {x: this.gameState.myPlayer.view.x + dx, y: this.gameState.myPlayer.view.y + dy}
        }, true);
    }
}

class SnowballTool extends NavigationTool {
    constructor(gameState) {
        super(gameState);
    }
    get playerDistToMouse() {
        return pointerRadius;
    }
    get iconSvg() {
        return svg("circle", {
            cx: 0,
            cy: 0,
            r: snowballRadius,
            fill: "white"
        });
    }
    activateFor(playerId) {
        const player = this.gameState.players.get(playerId);
        const pointerTriangle = svg("path", {
            id: "pointerTriangle_" + playerId,
            d: isoscelesTriangle(player.currentPos, pointerBaseWidth, player.pointerAngle, pointerRadius),
            fill: player.color,
            class: "pointer"
        });
        I("players").appendChild(pointerTriangle);
        if (playerId === this.gameState.myId) {
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
            I("players").appendChild(noCursor);
        }
    }
    positionFor(playerId) {
        const player = this.gameState.players.get(playerId);
        I("pointerTriangle_" + playerId).setAttribute("d", 
            isoscelesTriangle(player.currentPos, pointerBaseWidth, player.pointerAngle, pointerRadius));
        if (playerId === this.gameState.myId) {
            const pointerTip = player.currentPos.add(Point.polar(pointerRadius, player.pointerAngle));
            positionCircle(I("noCursor"), pointerTip);
        }
    }
    deactivateFor(playerId) {
        I("pointerTriangle_" + playerId).remove();
        if (playerId === this.gameState.myId) {
            I("noCursor").remove();
        }
    }
    keydown(e) {
        if (e.key === "f") {
            this.gameState.events.publishSnowball(Point.polar(1, this.gameState.myPlayer.pointerAngle));
        } else {
            super.keydown(e);
        }
    }
}

class TongsTool extends NavigationTool {
    constructor(gameState) {
        super(gameState);
    }
    static minTongAngle = Math.PI / 360;
    static tongsBaseWidth = 0.4;
    get playerDistToMouse() {
        const maxDraggeeRadius = Math.tan(this.gameState.myPlayer.maxTongAngle) * this.gameState.myPlayer.tongsRadius;
        const maxDraggeeDist = this.gameState.myPlayer.tongsRadius / Math.cos(this.gameState.myPlayer.maxTongAngle);
        return maxDraggeeDist - maxDraggeeRadius;
    }
    get iconSvg() {
        return svg("polyline", {
            points: "-0.125,-0.125 0.125,0 -0.125,0.125",
            fill: "none",
            "stroke": Tool.iconColor,
            "stroke-width": 0.04
        });
    }
    activateFor(playerId) {
        const player = this.gameState.players.get(playerId);
        const leftTongTriangle = svg("path", {
            id: "leftTongTriangle_" + playerId,
            fill: player.color
        });
        I("players").appendChild(leftTongTriangle);
        const rightTongTriangle = svg("path", {
            id: "rightTongTriangle_" + playerId,
            fill: player.color
        });
        I("players").appendChild(rightTongTriangle);
        if (playerId === this.gameState.myId) {
            // create small disk on which mouse pointer is not shown,
            // move it around with tip of left tong, no need for one on
            // the right because only relevant when both tips are at the same pos (closed tongs)
            const leftNoCursor = svg("circle", {
                id: "leftNoCursor",
                r: cursorRadius,
                "fill": "white",
                "fill-opacity": 0,
            });
            leftNoCursor.style.cursor = "none";
            I("players").appendChild(leftNoCursor);
        }
        this.positionFor(playerId);
    }
    positionFor(playerId) {
        const player = this.gameState.players.get(playerId);
        const leftTip = player.currentPos.add(Point.polar(player.tongsRadius, player.pointerAngle + player.leftTongAngle));
        const leftBase = player.currentPos.add(Point.polar(TongsTool.tongsBaseWidth, player.pointerAngle + player.leftTongAngle + Math.PI / 2));
        I("leftTongTriangle_" + playerId).setAttribute("d", pathStr(["M", player.currentPos, "L", leftTip, "L", leftBase, "z"]));
        const rightTip = player.currentPos.add(Point.polar(player.tongsRadius, player.pointerAngle - player.rightTongAngle));
        const rightBase = player.currentPos.add(Point.polar(TongsTool.tongsBaseWidth, player.pointerAngle - player.leftTongAngle - Math.PI / 2));
        I("rightTongTriangle_" + playerId).setAttribute("d", pathStr(["M", player.currentPos, "L", rightTip, "L", rightBase, "z"]));
        if (playerId === this.gameState.myId) {
            positionCircle(I("leftNoCursor"), leftTip);
        }
    }
    deactivateFor(playerId) {
        I("leftTongTriangle_" + playerId).remove();
        I("rightTongTriangle_" + playerId).remove();
        if (playerId === this.gameState.myId) {
            I("leftNoCursor").remove();
        }
    }
    pointerdown(e) {
        this.grab(this.gameState.objects.get(e.target.parentNode.id)); // circle is in a g
        super.pointerdown(e);
    }
    grab(o) {
        // default: don't grab o, just close tongs into the empty
        let m = { type: "upd", leftTongAngle: TongsTool.minTongAngle, rightTongAngle: TongsTool.minTongAngle };
        if (o?.type === "circle") {
            const draggeeRadius = this.gameState.absLengthIn(o.r, o.id);
            const toDraggee = this.gameState.absCoords(o).sub(this.gameState.myPlayer.currentPos);
            const draggeeDist = toDraggee.norm();
            const halfRadialDraggeeWidth = Math.asin(draggeeRadius / draggeeDist);
            const leftTangentAngle = toDraggee.angle() + halfRadialDraggeeWidth;
            const rightTangentAngle = toDraggee.angle() - halfRadialDraggeeWidth;
            if (draggeeDist >= headRadius + draggeeRadius &&
                normalizeAngle(this.gameState.myPlayer.pointerAngle + this.gameState.myPlayer.leftTongAngle - leftTangentAngle) >= 0 &&
                normalizeAngle(rightTangentAngle - (this.gameState.myPlayer.pointerAngle - this.gameState.myPlayer.rightTongAngle)) >= 0) {
                // grab o
                m = { 
                    type: "upd", 
                    leftTongAngle: normalizeAngle(leftTangentAngle - this.gameState.myPlayer.pointerAngle),
                    rightTongAngle: normalizeAngle(this.gameState.myPlayer.pointerAngle - rightTangentAngle),
                    draggee: o.id,
                    relDraggeePos: this.gameState.absCoords(o).sub(this.gameState.myPlayer.posAtTime(this.gameState.lastT))
                };
            }
        }
        this.gameState.events.publish(m);
    }
    ungrab() {
        this.gameState.events.publish({ 
            type: "upd", 
            draggee: null, 
            leftTongAngle: this.gameState.myPlayer.maxTongAngle,
            rightTongAngle: this.gameState.myPlayer.maxTongAngle
        });
    }
    click(e) {
        this.ungrab();
    }
    end_drag(e) {
        this.ungrab();
        super.end_drag(e);
    }
    moveObjWithoutChangingPointerAngle(e) {
        const mouse = this.gameState.eventToWorldCoords(e);
        const targetZero = mouse.sub(Point.polar(this.playerDistToMouse, this.gameState.myPlayer.pointerAngle));
        const current = this.gameState.myPlayer.posAtTime(this.gameState.lastT);
        const move = targetZero.sub(current);
        const tToStop = Math.sqrt(2 * move.norm() / this.gameState.myPlayer.decceleration);
        this.gameState.events.publish({
            type: "trajectory",
            x0: targetZero.x,
            y0: targetZero.y,
            t0: this.gameState.lastT + tToStop
        });
    }
    move_impl(e) {
        if (this.gameState.myPlayer.draggee) {
            this.moveObjWithoutChangingPointerAngle(e);
        } else {
            super.move_impl(e);
        }
    }
    keydown(e) {
        if (!this.gameState.myPlayer.draggee) {
            switch (e.key) {
            case "d":
                this.gameState.events.publish({ type: "upd", tongsRadius: this.gameState.myPlayer.tongsRadius * 1.1 });
                break;
            case "a":
                this.gameState.events.publish({ type: "upd", tongsRadius: this.gameState.myPlayer.tongsRadius / 1.1 });
                break;
            case "w":
                this.gameState.events.publish({ type: "upd", maxTongAngle: this.gameState.myPlayer.maxTongAngle * 1.1 });
                break;
            case "s":
                this.gameState.events.publish({ type: "upd", maxTongAngle: this.gameState.myPlayer.maxTongAngle / 1.1 });
                break;
            }
        }
        super.keydown(e);
    }
}

class PointingTool extends Tool {
    constructor(gameState) {
        super(gameState);
        this.avatarPosBeforeLastJump = null;
    }
    pointerdown(e) {
        this.avatarPosBeforeLastJump = app.myAvatar.pos;
        this.gameState.events.publish({
            type: "upd",
            pos: event_to_world_coords(e),
            animate: 'line'
        });
    }
    first_drag(e) {
        this.gameState.events.publish({
            type: "upd",
            pos: event_to_world_coords(e),
            pointer: event_to_world_coords(e).sub(this.avatarPosBeforeLastJump).angle() / Math.PI * 180
        });
    }
    continue_drag(e) {
        this.gameState.events.publish({
            type: "upd",
            pos: event_to_world_coords(e),
        });
    }
    end_drag(e) {
        this.gameState.events.publish({
            type: "upd",
            pointer: "none"
        });
    }
}

class ShapeTool extends Tool {
    constructor(gameState) {
        super(gameState);
        // world coordinates of the last pointerdown event
        this.pointerDownPos = null;
    }
    pointerdown(e) {
        this.pointerDownPos = event_to_world_coords(e);
        super.pointerdown(e);
    }
    first_drag(e) {
        const p = event_to_world_coords(e);
        if (selectedElemId) {
            this.gameState.events.publish({
                type: "deselect",
                what: [selectedElemId]
            });
            selectedElemId = null;
        }
        this.move_avatar_to_shape_corner(p);
        const s = create_shape(this.gameState.myPlayer.tool, this.pointerDownPos, p);
        s.action = 'new';
        if (this.gameState.myPlayer.tool === 'rectangle') {
            s.tag = 'rect';
        } else {
            s.tag = 'path';
        }
        s.id = app.gen_elem_id(s.tag);
        // s.stroke = I("pick-stroke-color").style.backgroundColor;
        s.fill = I("pick-fill-color").style.backgroundColor;
        this.gameState.events.publish(s);
        selectedElemId = s.id;
        this.gameState.events.publish({
            type: "select",
            what: [selectedElemId]
        });
    }
    continue_drag(e) {
        const p = event_to_world_coords(e);
        this.move_avatar_to_shape_corner(p);
        const s = create_shape(this.gameState.myPlayer.tool, this.pointerDownPos, p);
        s.action = 'upd';
        s.id = selectedElemId;
        this.gameState.events.publish(s);
    }
    end_drag(e) {
        this.gameState.events.publish({
            type: "upd",
            pointer: "none"
        });
    }
    // "private"
    move_avatar_to_shape_corner(p) {
        const d = p.distanceTo(this.pointerDownPos) + Avatar.pointerRadius;
        const alpha = p.sub(this.pointerDownPos).angle();
        this.gameState.events.publish({
            type: "upd",
            pos: this.pointerDownPos.add(Point.polar(d, alpha)),
            pointer: alpha / Math.PI * 180 + 180
        });
    }
}

// TODO merge with ShapeTool
class BlobTool extends Tool {
    constructor(gameState) {
        super(gameState);
        this.allPoints = null;
    }
    pointerdown(e) {
        this.allPoints = [event_to_world_coords(e)];
        super.pointerdown(e);
    }
    first_drag(e) {
        const p = event_to_world_coords(e);
        if (selectedElemId) {
            this.gameState.events.publish({
                type: "deselect",
                what: [selectedElemId]
            });
            selectedElemId = null;
        }
        this.move_avatar_to_shape_corner(p);
        this.allPoints.push(p);
        const s = points_to_path(this.allPoints);
        s.action = 'new';
        s.tag = 'path';
        s.id = app.gen_elem_id(s.tag);
        s.fill = 'transparent';
        s.stroke = app.myAvatar.color;
        s["stroke-width"] = 2;
        this.gameState.events.publish(s);
        selectedElemId = s.id;
        this.gameState.events.publish({
            type: "select",
            what: [selectedElemId]
        });
    }
    continue_drag(e) {
        const p = event_to_world_coords(e);
        this.move_avatar_to_shape_corner(p);
        this.allPoints.push(p);
        const s = points_to_path(this.filter_points());
        s.action = 'upd';
        s.id = selectedElemId;
        this.gameState.events.publish(s);
    }
    end_drag(e) {
        this.gameState.events.publish([{
            type: "upd",
            pointer: "none"
        }, {
            type: 'upd',
            id: selectedElemId,
            "stroke-width": 0,
            "fill": I("pick-fill-color").style.backgroundColor
        }]);
        this.allPoints = null;
    }
    // "private"
    // removes points which are old && useless from allPoints, and returns an
    // even more filtered list where all useless points were removed
    filter_points() {
        const keep = Array(this.allPoints.length).fill(true);
        var best = null;
        do {
            best = null;
            var lowestDist = handle_radius(); // don't remove points with a dist larger than this
            var prev = 0; // point 0 is always kept
            var cur = 1;
            while (cur < this.allPoints.length && !keep[cur]) cur++;
            var next = cur + 1;
            while (next < this.allPoints.length && !keep[next]) next++;
            while (next < this.allPoints.length) {
                // prev,cur,next are three points with keep[..] == true
                const dist = dist_from_line(this.allPoints[cur], this.allPoints[prev], this.allPoints[next]);
                if (dist < lowestDist) {
                    lowestDist = dist;
                    best = cur;
                }
                prev = cur;
                cur = next;
                do { next++; } while (next < this.allPoints.length && !keep[next]);
            }
            if (best !== null) keep[best] = false;
        } while (best !== null);
        const res = [];
        const upd = [];
        for (let i = 0; i < this.allPoints.length; i++) {
            if (keep[i] || this.allPoints.length - i <= 100) { // keep last 100 points no matter what
                upd.push(this.allPoints[i]);
            }
            if (keep[i]) {
                res.push(this.allPoints[i]);
            }
        }
        this.allPoints = upd;
        return res;
    }
    move_avatar_to_shape_corner(p) {
        // last point might be too noisy, go back a bit further:
        let i = this.allPoints.length-1;
        while (i > 0 && p.distanceTo(this.allPoints[i]) < 2 * Avatar.radius) i--; // TODO respect scale
        const prev = this.allPoints[i];
        const d = p.distanceTo(prev) + Avatar.pointerRadius;
        const alpha = p.sub(prev).angle();
        this.gameState.events.publish({
            type: "upd",
            pos: prev.add(Point.polar(d, alpha)),
            pointer: alpha / Math.PI * 180 + 180
        });
    }
}

var selectedElemId = null;

// We use the term "pointer" to refer to the mouse pointer on desktop, and the finger on touchscreens,
// even though touchscreen support is not yet implemented
class UiEvents {
    constructor(gameState) {
        this.gameState = gameState;
        this.pointerState = "UP";
        this.tools = {
            navigation: new NavigationTool(gameState),
            snowball: new SnowballTool(gameState),
            tongs: new TongsTool(gameState),
            pointing: new PointingTool(gameState),
            rectangle: new ShapeTool(gameState),
            triangle: new ShapeTool(gameState),
            square: new ShapeTool(gameState),
            blob: new BlobTool(gameState),
            toolSelection: new ToolSelectionTool(gameState)
        };
        this._draggee = null; // can be null, "handle" or "tool"
        this.onadjustcorner = null;
    }
    get draggee() {
        return this._draggee;
    }
    set draggee(v) {
        log.debug("draggee:", v);
        this._draggee = v;
    }
    pointerdown_on_map(e) {
        this.tools[this.gameState.myPlayer.tool].pointerdown(e);
        this.draggee = "tool";
        this.pointerdown_common(e);
    }
    // elem: DOM SVG element being edited
    // cornerPos: original world coordinates of the corner being edited
    // geomUpdater: function which takes a Point with the new corner coordinates
    //              and returns a JSON action to update elem
    pointerdown_on_corner_handle(elem, cornerPos, geomUpdater) {
        return (e) => {
            const p = event_to_world_coords(e);
            const mouseDownPosWithinHandle = p.sub(cornerPos);
            const alpha = mouseDownPosWithinHandle.angle();
            const avatarOffset = Point.polar(Avatar.pointerRadius, alpha);
            this.gameState.events.publish({
                type: "upd",
                pos: p.add(avatarOffset),
                animate: 'jump'
            });
            this.onadjustcorner = (e) => {
                const p = event_to_world_coords(e);
                this.gameState.events.publish([{
                    type: "upd",
                    pos: p.add(avatarOffset),
                    pointer: alpha / Math.PI * 180 + 180
                }, geomUpdater(p.sub(mouseDownPosWithinHandle))]);
            };
            this.draggee = "handle";
            this.pointerdown_common(e);
            e.stopPropagation();
        };
    }
    pointerdown_common(e) {
        this.pointerState = "DOWN";
        set_corner_handle_cursor("none");
        //set_cursor("none");
    }
    pointerhover(e) {
        if (this.pointerState !== "UP") return;
        this.tools[this.gameState.myPlayer.tool].hover(e);
    }
    pointerdrag(e) {
        if (this.pointerState === "UP") return; // mousedown happened somewhere else
        switch (this.draggee) {
        case "tool":
            switch (this.pointerState) {
            case "DOWN":
                this.tools[this.gameState.myPlayer.tool].first_drag(e);
                this.pointerState = "DRAGGING";
                break;
            case "DRAGGING":
                this.tools[this.gameState.myPlayer.tool].continue_drag(e);
                break;
            }
            break;
        case "handle":
            this.onadjustcorner(e);
            break;
        }
    }
    pointerup(e) {
        if (this.pointerState === "UP") return; // mousedown happened somewhere else
        switch (this.draggee) {
        case "tool":
            if (this.pointerState === "DRAGGING") this.tools[this.gameState.myPlayer.tool].end_drag(e);
            if (this.pointerState === "DOWN") this.tools[this.gameState.myPlayer.tool].click(e);
            break;
        case "handle":
            this.gameState.events.publish({
                type: "upd",
                pointer: "none"
            });
            this.onadjustcorner = null;
            break;
        }
        this.pointerState = "UP";
        set_corner_handle_cursor("move");
    }
    keydown(e) {
        if (e.repeat) return;
        this.tools[this.gameState.myPlayer.tool].keydown(e);
    }
    showTools() {
        const ts = Object.entries(this.tools).filter(([toolname, tool]) => tool.enabled);
        let toolAngle = this.gameState.myPlayer.pointerAngle + toolDistAngle;
        for (const [toolname, tool] of ts) {
            const p = this.gameState.myPlayer.zeroSpeedPos.add(Point.polar(headRadius + toolDist + toolRadius, toolAngle));
            const g = svg("g", { id: toolname + "-tool", transform: `translate(${p.x}, ${p.y})` }, [
                svg("circle", { cx: 0, cy: 0, r: toolRadius, fill: "#555" }),
                tool.iconSvg
            ]);
            g.onclick = e => {
                this.gameState.events.publishActiveTool(toolname);
                this.hideTools();
            };
            g.style.cursor = "pointer";
            I("players").appendChild(g);
            toolAngle += toolDistAngle;
        }
    }
    hideTools() {
        for (const toolname of Object.keys(this.tools)) {
            const d = I(toolname + '-tool');
            if (d) d.remove();
        }
    }
    contextmenu(e) {
        if (this.gameState.myPlayer.tool === "toolSelection") {
            this.hideTools();
            this.gameState.events.publishActiveTool(this.lastActiveTool);
        } else {
            this.lastActiveTool = this.gameState.myPlayer.tool;
            this.showTools();
            this.gameState.events.publishActiveTool("toolSelection");
        }
    }
}

function set_corner_handle_cursor(name) {
    const l = I("arena").classList;
    for (const c of l) {
        if (c.startsWith("set_corner_handle_cursors_to_")) {
            l.remove(c);
        }
    }
    l.add("set_corner_handle_cursors_to_" + name);
}

function shape_contextmenu(e) {
    const elem = e.target;
    const clickedElemId = elem.getAttribute("id");
    const previouslySelected = selectedElemId;
    var m = [];

    // in any case, deselect whatever's currently selected
    if (previouslySelected) {
        m.push({
            type: "deselect",
            what: [previouslySelected]
        });
        selectedElemId = null;
    }

    // if a different element than the previously selected one was clicked, select it,
    // else only the above deselect is needed
    if (previouslySelected !== clickedElemId) {
        selectedElemId = clickedElemId;
        const c = I(selectedElemId).getAttribute("fill");
        if (!c.startsWith('url')) I("pick-fill-color").style.backgroundColor = c;
        m.push({
            type: "select",
            what: [selectedElemId]
        });
    }

    this.gameState.events.publish(m);
}

function background_contextmenu(e) {
    if (selectedElemId) {
        this.gameState.events.publish({
            type: "deselect",
            what: [selectedElemId]
        });
        selectedElemId = null;
    }
    const c = I("BackgroundRect").getAttribute("fill");
    if (!c.startsWith('url')) I("pick-fill-color").style.backgroundColor = c;
}

const MOUSEBUTTONS_LEFT = 1;

function mousedown_corner_handle(elem, cornerPos, geomUpdater) {
    return window.uiEventsHandler.pointerdown_on_corner_handle(elem, cornerPos, geomUpdater);
}

let cursor_debug = false;

function set_cursor(name) {
    if (cursor_debug && name === "none") name = "crosshair";
    I("arena").style.cursor = name;
}

function init_uievents(gameState) {
    window.uiEventsHandler = new UiEvents(gameState);
    I("arenaWrapper").onpointerdown = e => {
        if (e.buttons !== MOUSEBUTTONS_LEFT) return;
        window.uiEventsHandler.pointerdown_on_map(e);
    };
    window.addEventListener('pointermove', e => {
        if (e.buttons === MOUSEBUTTONS_LEFT) {
            window.uiEventsHandler.pointerdrag(e);
        } else if (e.buttons === 0) {
            window.uiEventsHandler.pointerhover(e);
        }
    });
    // TODO what if multiple mouse buttons are pressed?
    window.addEventListener('pointerup', e => {
        window.uiEventsHandler.pointerup(e);
    });
    // never show the browser's context menu (also prevents the browser context menu on long taps)
    window.addEventListener('contextmenu', e => {
        e.preventDefault();
        window.uiEventsHandler.contextmenu(e);
    });
    window.addEventListener("keydown", e => {
        window.uiEventsHandler.keydown(e);
    });
    // I("BackgroundRect").oncontextmenu = background_contextmenu;
    set_corner_handle_cursor("move");
}
