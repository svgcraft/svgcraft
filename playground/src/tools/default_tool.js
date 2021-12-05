"use strict";

// TODO: default_tool should be a no_move tool, and moving should only be added by a subclass

// to build new tools, extend this module, without using `new`,
// as described here: https://stackoverflow.com/a/28281845/
function default_tool(geom, dom, events, arena) {
    const tool = {
        // measured in player radii:
        cursorTriangleWidth: 0.16,
        cursorTriangleHeight: 0.2,
        attachGap: -0.02,
        detachGap: 0.05,

        state: "hover", // other possible values: "pan", "drag"

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

        // whether or not to show a circle with a picture or video of the player (or only a cursor)
        get showAvatar() {
            return true;
        },

        applyStroke: function (elem, scale) {
            elem.setAttribute("stroke", "rgb(70, 70, 70)");
            elem.setAttribute("stroke-width", 0.01 / scale);
        },

        playerToDom: function (player) {
            player.scale ??= 0.5;
            if (this.showAvatar) {
                if (!player.circ) {
                    player.circ = dom.svg("circle", {
                        cx: 0, // 0 relative to origin of surrounding g
                        cy: 0,
                        r: 1 // radius of player is always 1, but player size can be changed using player.scale
                    });
                    this.applyStroke(player.circ, player.scale);
                    player.g.appendChild(player.circ);
                }
                player.circ.setAttribute("fill", player.color);
            }
            const baseMid = player.cursorPos.sub(geom.Point.polar(this.cursorTriangleHeight, player.cursorAngle));
            const t = geom.isosceles_triangle(baseMid, this.cursorTriangleWidth, player.cursorAngle, this.cursorTriangleHeight);
            player.cursorTriangle.setAttribute("d", t);
            player.cursorTriangle.setAttribute("visibility", player.showCursor ? "visible" : "hidden");
            player.cursorTriangleBorder.setAttribute("d", t);
            player.cursorTriangleBorder.setAttribute("visibility", player.showCursor ? "visible" : "hidden");
            /*
            if (this.isPlayerCursorAttached(player, TODO_obtain_frame_time)) {
                // TODO hide black line between cursor and avatar
            } else {
                // TODO show black line between cursor and avatar
            }
            */
            player.g.setAttribute("transform", `translate(${player.currentPos.x}, ${player.currentPos.y}) scale(${player.scale})`);
        },

        activateFor: function (player) {
            player.relTo ??= "worldPlayers";
            player.scale ??= 0.5;
            player.showCursor ??= false;
            if (!player.g) {
                player.g = dom.svg("g");
                arena.ids.get(player.relTo).g.appendChild(player.g);
            }
            player.cursorAngle ??= 0.0;
            player.cursorPos ??= player.currentPos;
            // cursorTriangleBorder goes before (under) player.g so that its baseline is covered by the player circle
            if (!player.cursorTriangleBorder) {
                player.cursorTriangleBorder = dom.svg("path", {
                    //d: set in playerToDom
                    fill: "none"
                });
                // TODO less hardcoding, 1 means don't scale because we're not in scaled player.g, 
                // /2 means double stroke width because half of it is covered by cursorTriangle fill
                this.applyStroke(player.cursorTriangleBorder, 1.0 / 2);
                arena.ids.get(player.relTo).g.insertBefore(player.cursorTriangleBorder, player.g);
            }
            // cursorTriangle goes after (above) player.g so that it covers the border of the circle
            if (!player.cursorTriangle) {
                player.cursorTriangle = dom.svg("path", {
                    //d: set in playerToDom
                    fill: player.color
                });
                arena.ids.get(player.relTo).g.appendChild(player.cursorTriangle);
            }
            this.playerToDom(player);
            if (player === arena.myPlayer) {
                this.activateEventListeners();
            }
        },
        deactivateFor: function (player) {
            player.cursorTriangle.remove();
            player.cursorTriangle = undefined;
            if (player === arena.myPlayer) this.deactivateEventListeners();
        },
        activateEventListeners: function () {
            this.addEventListener(arena.arenaDiv, "mousemove", this.onMouseMove.bind(this));
            this.addEventListener(arena.arenaDiv, "mouseleave", this.onMouseLeave.bind(this));
            this.addEventListener(arena.arenaDiv, "mousedown", this.onMouseDown.bind(this));
            this.addEventListener(window, "mouseup", this.onMouseUp.bind(this));
        },
        deactivateEventListeners: function () {
            this.removeAllEventListeners();
        },

        onMouseMove: function (e) {
            this[this.state](e);
        },
        onMouseDown: function (e) {
            const tNow = e.timeStamp / 1000;
            if (arena.myPlayer.zeroSpeedTime > tNow) {
                this.state = "pan";
                this.mouseDownScreenPos = new geom.Point(e.screenX, e.screenY);
                this.mouseDownViewPos = new geom.Point(arena.myPlayer.view.x, arena.myPlayer.view.y);
                arena.arenaDiv.style.cursor = "grabbing";
            } else {
                this.state = "drag";
                const mouse = arena.myPlayer.eventToRelCoords(e);
                const current = arena.myPlayer.posAtTime(tNow);
                const d = current.sub(mouse);
                events.publish([{
                    type: "cursor",
                    x: mouse.x,
                    y: mouse.y,
                    angle: geom.oppositeAngle(d.angle()),
                }]);
                arena.arenaDiv.style.cursor = "none";
            }
        },
        onMouseUp: function (e) {
            this.state = "hover";
            events.publish({ type: "hidecursor" });
            arena.arenaDiv.style.cursor = "default";
        },
        onMouseLeave: function (e) {
            events.publish({ type: "hidecursor" });
        },
        isPlayerCursorAttached: function (player, time) {
            return player.zeroSpeedTime <= time;
        },
        hover: function (e) {
            const tNow = e.timeStamp / 1000;
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const current = arena.myPlayer.posAtTime(tNow);
            const d = current.sub(mouse);
            const headRadius = 1; // hardcoded, actual scaling is done using player.scale
            const finalPlayerDistToMouse = arena.myPlayer.scale * headRadius + tool.attachGap + this.cursorTriangleHeight;
            if (d.norm() >= finalPlayerDistToMouse) {
                // cursor detached from avatar, angle can change
                const targetZero = mouse.add(d.scaleToLength(finalPlayerDistToMouse));
                const move = targetZero.sub(current);
                const tToStop = Math.sqrt(2 * move.norm() / arena.myPlayer.decceleration);
                events.publish([{
                    type: "trajectory",
                    x0: targetZero.x,
                    y0: targetZero.y,
                    t0: tNow + tToStop,
                    angle: d.angle()
                }]);
            }
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
        drag: function(e) {
            const tNow = e.timeStamp / 1000;
            const mouse = arena.myPlayer.eventToRelCoords(e);
            // cursor remains attached to avatar, angle does not change
            const headRadius = 1; // hardcoded, actual scaling is done using player.scale
            const finalPlayerDistToMouse = arena.myPlayer.scale * headRadius + tool.attachGap + this.cursorTriangleHeight;
            const center = mouse.sub(geom.Point.polar(finalPlayerDistToMouse, arena.myPlayer.cursorAngle));
            // degenerate trajectory (already at speed 0)
            events.publish([{
                type: "trajectory",
                x0: center.x,
                y0: center.y,
                t0: tNow
            }, {
                type: "cursor",
                x: mouse.x,
                y: mouse.y,
                angle: arena.myPlayer.cursorAngle
            }]);
        },
        first_drag: function (e) {
        },
        continue_drag: function (e) {
        },
        end_drag: function (e) {
        },
        click: function (e) {},

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
            player.zeroSpeedTime = e.t0; // TODO substract timeSeniority;
            player.angle = e.angle;
        } else if (e.type === "cursor") {
            player.cursorPos = new geom.Point(parseFloat(e.x), parseFloat(e.y));
            player.cursorAngle = e.angle;
            player.showCursor = true;
        } else if (e.type === "hidecursor") {
            player.showCursor = false;
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
