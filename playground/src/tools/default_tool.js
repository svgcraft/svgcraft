"use strict";

// TODO: default_tool should be a no_move tool, and moving should only be added by a subclass

// to build new tools, extend this module, without using `new`,
// as described here: https://stackoverflow.com/a/28281845/
function default_tool(geom, dom, events, arena) {
    const tool = {
        // measured in player radii:
        playerRadius: 1,
        pointerTriangleWidth: 0.4,
        pointerTriangleHeight: 0.55,
        outerToolRadius: 1.6, // distance of center of player to outermost tip of tool
        defaultCursorDist: 1.75, // distance of center of player to cursor where player circle stops when moving towards cursor
        maxCursorDist: 1.9, // threshold cursor distance from center of player at which player starts to move

        state: "hover", // other possible values: "pan", "movetool"

        // Note: There are two kinds of events: 
        // - UI events as fired by the browser (these have listeners)
        // - application events exchanged between peers (these have subscribers)
        // For UI events, activating/deactivating event listeners is based on the user's current tool,
        // whereas for application events, all the subscribers are always active
        activeEventListeners: new Set(),
        addEventListener(dom, eventName, handler) {
            this.activeEventListeners.add([dom, eventName, handler]);
            dom.addEventListener(eventName, handler);
        },
        removeAllEventListeners() {
            for ([dom, eventName, handler] of this.activeEventListeners) {
                dom.removeEventListener(eventName, handler);
            }
        },

        applyStroke: function (elem) {
            elem.setAttribute("stroke", "rgb(70, 70, 70)");
            elem.setAttribute("stroke-width", 0.02);
        },

        playerToDom: function (player) {
            player.scale ??= 0.5;
            if (!player.circ) {
                /*
                const c1 = dom.svg("circle", { cx: 0, cy: 0, fill: "transparent", r: this.outerToolRadius });
                const c2 = dom.svg("circle", { cx: 0, cy: 0, fill: "transparent", r: this.defaultCursorDist });
                const c3 = dom.svg("circle", { cx: 0, cy: 0, fill: "transparent", r: this.maxCursorDist });
                this.applyStroke(c1);
                this.applyStroke(c2);
                this.applyStroke(c3);
                player.g.appendChild(c1);
                player.g.appendChild(c2);
                player.g.appendChild(c3);
                */

                player.circ = dom.svg("circle", {
                    cx: 0, // 0 relative to origin of surrounding g
                    cy: 0,
                    r: this.playerRadius // player size can be changed using player.scale
                });
                this.applyStroke(player.circ);
                player.g.appendChild(player.circ);
            }
            player.circ.setAttribute("fill", player.color);
            const baseMid = geom.Point.polar(this.outerToolRadius - this.pointerTriangleHeight, player.toolAngle);
            const t = geom.isosceles_triangle(baseMid, this.pointerTriangleWidth, player.toolAngle, this.pointerTriangleHeight);
            player.pointerTriangle.setAttribute("d", t);
            // const showTool = performance.now() / 1000 < 
            //    Math.max(player.lastMovementTime, player.zeroSpeedTime) + player.toolAutoHideDelay;
            const showTool = player.showTool;
            player.pointerTriangle.setAttribute("visibility", showTool ? "visible" : "hidden");
            player.g.setAttribute("transform", `translate(${player.currentPos.x}, ${player.currentPos.y}) scale(${player.scale})`);
        },

        activateFor: function (player) {
            player.relTo ??= "worldPlayers";
            player.scale ??= 0.5;
            player.showTool ??= true;
            player.lastMovementTime ??= -Infinity;
            player.toolAutoHideDelay ??= 3.0; // seconds
            if (!player.g) {
                player.g = dom.svg("g");
                arena.ids.get(player.relTo).g.appendChild(player.g);
            }
            player.toolAngle ??= 0.0;
            if (!player.pointerTriangle) {
                player.pointerTriangle = dom.svg("path", {
                    //d: set in playerToDom
                    fill: player.color
                });
                this.applyStroke(player.pointerTriangle);
                player.g.appendChild(player.pointerTriangle);
            }
            this.playerToDom(player);
            if (player === arena.myPlayer) {
                this.activateEventListeners();
                this.addEventListener(player.circ, "wheel", this.onPlayerCircleWheel.bind(this));
                this.addEventListener(player.pointerTriangle, "pointerdown", this.onTriangleMouseDown.bind(this));
            }
        },
        deactivateFor: function (player) {
            player.pointerTriangle.remove();
            player.pointerTriangle = undefined;
            if (player === arena.myPlayer) this.deactivateEventListeners();
        },
        activateEventListeners: function () {
            this.addEventListener(arena.arenaDiv, "pointermove", this.onMouseMove.bind(this));
            this.addEventListener(arena.arenaDiv, "pointerleave", this.onMouseLeave.bind(this));
            this.addEventListener(arena.arenaDiv, "pointerdown", this.onMouseDown.bind(this));
            this.addEventListener(window, "pointerup", this.onMouseUp.bind(this));
        },
        deactivateEventListeners: function () {
            this.removeAllEventListeners();
        },

        myPlayerToMouse: new geom.Point(0.123, 0.123),

        lastMouseEventWasMouseDown: false,
        draggee: null, // "map" or "myPlayer" or "tool" or null

        onMouseMove: function (e) {
            // tap events also trigger pointermove events, but we don't want these
            // if (this.draggee === null && e.pointerType !== "mouse") return;
            // e.pointerType seems to always return "mouse"...
            if (this.draggee === "map") {
                this.pan(e);
            } else if (this.draggee === "myPlayer") {
                if (arena.myPlayer.showTool) {
                    this.movecirc(e);
                } else {
                    this.movetool(e);
                }
            } else if (this.draggee === "tool") {
                this.movetool(e);
            } else {
                this.hover(e);
            }
            this.lastMouseEventWasMouseDown = false;
        },
        onMouseDown: function (e) {
            // we assume that this event starts a dragging gesture, even if it later turns out that it's a click
            const tNow = e.timeStamp / 1000;
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const current = arena.myPlayer.posAtTime(tNow);
            const d = current.sub(mouse);
            const r = arena.myPlayer.scale * this.playerRadius;
            if (d.norm() <= r) {
                this.draggee = "myPlayer";
                const mouse = arena.myPlayer.eventToRelCoords(e);
                this.myPlayerToMouse = mouse.sub(arena.myPlayer.zeroSpeedPos);
                // comment out line below to keep showing the cursor while dragging myPlayer to make it easier to 
                // understand how moving the cursor affects the toolAngle
                arena.arenaDiv.style.cursor = "none";
            } else {
                this.draggee = "map";
                this.mouseDownScreenPos = new geom.Point(e.screenX, e.screenY);
                this.mouseDownViewPos = new geom.Point(arena.myPlayer.view.x, arena.myPlayer.view.y);
                arena.arenaDiv.style.cursor = "none";
            }
            this.lastMouseEventWasMouseDown = true;
        },
        onTriangleMouseDown: function (e) {
            this.draggee = "tool";
            const mouse = arena.myPlayer.eventToRelCoords(e);
            this.myPlayerToMouse = mouse.sub(arena.myPlayer.zeroSpeedPos);
            arena.arenaDiv.style.cursor = "none";
            e.stopPropagation();
            this.lastMouseEventWasMouseDown = true;
        },
        onMouseUp: function (e) {
            // detect click
            if (this.lastMouseEventWasMouseDown) {
                events.publish({ type: "show_tool", value: !arena.myPlayer.showTool });
            }
            arena.arenaDiv.style.cursor = "default";
            this.draggee = null;
            this.lastMouseEventWasMouseDown = false;
        },
        onMouseLeave: function (e) {
        },
        onPlayerCircleWheel: function (e) {
            const scaleChange = Math.exp(e.deltaY * -0.001);
            events.publish({ type: "player_scale", scale: arena.myPlayer.scale * scaleChange });
        },
        hover: function (e) {
            const tNow = e.timeStamp / 1000;
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const current = arena.myPlayer.posAtTime(tNow);
            const d = mouse.sub(current);
            // only move player if mouse is outside a circle (of radius maxCursorDist) surrounding the player
            if (d.norm() >= this.maxCursorDist * arena.myPlayer.scale) {
                const targetZero = mouse.sub(d.scaleToLength(this.defaultCursorDist * arena.myPlayer.scale));
                const move = targetZero.sub(current);
                const tToStop = Math.sqrt(2 * move.norm() / arena.myPlayer.decceleration);
                events.publish({
                    type: "trajectory",
                    x0: targetZero.x,
                    y0: targetZero.y,
                    t0: tNow + tToStop,
                    angle: d.angle()
                });
            }
            // Only change tool angle if cursor is not too close to center of player circle (too fidgety otherwise).
            // Commented out because when starting dragging inside the small circle on the opposite side of the
            // pointer triangle, there's a jump at the beginning of the dragging.
            // if (d.norm() >= this.playerRadius / 3.0 * arena.myPlayer.scale) {
            events.publish({
                type: "tool_angle",
                t: tNow,
                angle: d.angle()
            });
        },
        pan: function(e) {
            const r = arena.arenaDiv.getBoundingClientRect();
            const unitsPerPx = arena.myPlayer.view.unitsPerWidth / r.width;
            const screenPos = new geom.Point(e.screenX, e.screenY);
            const d = screenPos.sub(this.mouseDownScreenPos).scale(unitsPerPx);
            const viewPos = this.mouseDownViewPos.sub(d);
            events.publish([{
                type: "pan",
                // TODO: use view id, so that several players can share same view
                x: viewPos.x,
                y: viewPos.y
            }]);
        },
        movecirc: function(e) {
            const tNow = e.timeStamp / 1000;
            const newMouse = arena.myPlayer.eventToRelCoords(e);
            const oldCenter = arena.myPlayer.posAtTime(tNow);
            const oldAngle = arena.myPlayer.toolAngle;
            const centerToMouseDist = this.myPlayerToMouse.norm();
            const tipOfTool = oldCenter.add(geom.Point.polar(this.outerToolRadius * arena.myPlayer.scale, oldAngle));
            const d = tipOfTool.sub(newMouse);
            const newCenter = newMouse.sub(d.scaleToLength(centerToMouseDist));
            events.publish([
                { // degenerate trajectory (already at speed 0)
                    type: "trajectory",
                    x0: newCenter.x,
                    y0: newCenter.y,
                    t0: tNow
                }, {
                    type: "tool_angle",
                    angle: d.angle(),
                    t: tNow
                }
            ]);
        },
        movetool: function(e) {
            const tNow = e.timeStamp / 1000;
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const center = mouse.sub(this.myPlayerToMouse);
            // degenerate trajectory (already at speed 0)
            events.publish({
                type: "trajectory",
                x0: center.x,
                y0: center.y,
                t0: tNow
            });
        },
    };
    arena.registerTool("default_tool", tool);
    tool.activateFor(arena.myPlayer);

    // Application-level event handlers are generally not overridable by subclasses,
    // except if they call methods of tool, which can be overridden.
    // Extending a handler, however, is always possible, simply by subscribing another handler.
    // And as another option, a subclass can decide to simply not emit the event in question,
    // but emit an event of a different type with a new handler.
    function onEvent(e, sourceId) {
        // TODO support subscribing by event type, and maybe pass player as argument (but where's player map?)
        const player = sourceId ? arena.ids.get(sourceId) : arena.myPlayer;
        if (e.type === "trajectory") {
            player.zeroSpeedPos = new geom.Point(parseFloat(e.x0), parseFloat(e.y0));
            player.zeroSpeedTime = e.t0; // TODO substract timeSeniority
            player.movementAngle = e.angle;
        } else if (e.type === "tool_angle") {
            player.toolAngle = e.angle;
            player.lastMovementTime = e.t; // TODO substract timeSeniority
        } else if (e.type === "player_scale") {
            player.scale = e.scale;
        } else if (e.type === "show_tool") {
            player.showTool = e.value;
        } else if (e.type === "pan") {
            arena.myPlayer.view.x = parseFloat(e.x);
            arena.myPlayer.view.y = parseFloat(e.y);
            // TODO only touch DOM in frame(), just add arena.myPlayer.view to list of updates to make
            arena.viewToDom(arena.myPlayer.view);
        }
    }
    events.subscribe(onEvent);

    return tool;
}
