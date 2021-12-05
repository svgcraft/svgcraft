"use strict";

// TODO: default_tool should be a no_move tool, and moving should only be added by a subclass

// to build new tools, extend this module, without using `new`,
// as described here: https://stackoverflow.com/a/28281845/
function default_tool(geom, dom, events, arena) {
    const tool = {
        // measured in player radii:
        pointerTriangleWidth: 0.16,
        pointerTriangleHeight: 0.2,
        attachGap: -0.02,
        detachGap: 0.05,

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
            const headRadius = 1; // hardcoded, actual scaling is done using player.scale
            const baseMid = player.currentPos.add(geom.Point.polar(player.scale * headRadius + this.attachGap, player.pointerAngle));
            const t = geom.isosceles_triangle(baseMid, this.pointerTriangleWidth, player.pointerAngle, this.pointerTriangleHeight);
            player.pointerTriangle.setAttribute("d", t);
            player.pointerTriangle.setAttribute("visibility", player.showPointerTriangle ? "visible" : "hidden");
            player.pointerTriangleBorder.setAttribute("d", t);
            player.pointerTriangleBorder.setAttribute("visibility", player.showPointerTriangle ? "visible" : "hidden");
            player.g.setAttribute("transform", `translate(${player.currentPos.x}, ${player.currentPos.y}) scale(${player.scale})`);
        },

        activateFor: function (player) {
            player.relTo ??= "worldPlayers";
            player.scale ??= 0.5;
            player.showPointerTriangle ??= false;
            if (!player.g) {
                player.g = dom.svg("g");
                arena.ids.get(player.relTo).g.appendChild(player.g);
            }
            player.pointerAngle ??= 0.0;
            // pointerTriangleBorder goes before (under) player.g so that its baseline is covered by the player circle
            if (!player.pointerTriangleBorder) {
                player.pointerTriangleBorder = dom.svg("path", {
                    //d: set in playerToDom
                    fill: "none"
                });
                // TODO less hardcoding, 1 means don't scale because we're not in scaled player.g, 
                // /2 means double stroke width because half of it is covered by pointerTriangle fill
                this.applyStroke(player.pointerTriangleBorder, 1.0 / 2);
                arena.ids.get(player.relTo).g.insertBefore(player.pointerTriangleBorder, player.g);
            }
            // pointerTriangle goes after (above) player.g so that it covers the border of the circle
            if (!player.pointerTriangle) {
                player.pointerTriangle = dom.svg("path", {
                    //d: set in playerToDom
                    fill: player.color
                });
                arena.ids.get(player.relTo).g.appendChild(player.pointerTriangle);
            }
            this.playerToDom(player);
            if (player === arena.myPlayer) {
                this.activateEventListeners();
            }
        },
        deactivateFor: function (player) {
            player.pointerTriangle.remove();
            player.pointerTriangle = undefined;
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

        myPlayerToMouse: new geom.Point(0.123, 0.123),

        isPanning: false, // means mouse is down and user is moving the map around
        isToolInAction: false, // means a click to start using the tool was made, but no click to end using tool was made yet
        lastMouseEventWasMouseDown: false,

        onMouseMove: function (e) {
            if (this.isPanning) {
                this.pan(e);
            } else {
                if (this.isToolInAction) {
                    this.movetool(e);
                } else {
                    this.hover(e);
                }
            }
            this.lastMouseEventWasMouseDown = false;
        },
        onMouseDown: function (e) {
            // we assume that this event starts a panning gesture, even if it later turns out that it's a click
            this.isPanning = true;
            this.mouseDownScreenPos = new geom.Point(e.screenX, e.screenY);
            this.mouseDownViewPos = new geom.Point(arena.myPlayer.view.x, arena.myPlayer.view.y);
            arena.arenaDiv.style.cursor = "none";
            this.lastMouseEventWasMouseDown = true;
        },
        onMouseUp: function (e) {
            if (this.lastMouseEventWasMouseDown) {
                // It's a true click.
                // Note: browsers also consider a mousedown-mousemove-mouseup sequence as a click,
                // as long as the mousedown and mouseup are on the same element, but we don't want these clicks.
                if (this.isToolInAction) {
                    this.isToolInAction = false;
                    events.publish({ type: "end_pointing" });
                    arena.arenaDiv.style.cursor = "default";
                } else {
                    this.isToolInAction = true;
                    const mouse = arena.myPlayer.eventToRelCoords(e);
                    this.myPlayerToMouse = mouse.sub(arena.myPlayer.zeroSpeedPos);
                    arena.arenaDiv.style.cursor = "none";
                    events.publish({
                        type: "start_pointing",
                        angle: this.myPlayerToMouse.angle(),
                    });
                }    
            } else {
                // It's the end of a panning with non-zero movement
                arena.arenaDiv.style.cursor = "default";
            }
            // end panning (even if there was zero movement)
            this.isPanning = false;
            this.lastMouseEventWasMouseDown = false;
        },
        onMouseLeave: function (e) {
        },
        hover: function (e) {
            const tNow = e.timeStamp / 1000;
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const current = arena.myPlayer.posAtTime(tNow);
            const d = current.sub(mouse);
            const headRadius = 1; // hardcoded, actual scaling is done using player.scale
            const finalPlayerDistToMouse = arena.myPlayer.scale * headRadius + tool.attachGap + this.pointerTriangleHeight;
            // only move if mouse is outside a circle (of radius finalPlayerDistToMouse) surrounding the player
            if (d.norm() >= finalPlayerDistToMouse) {
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
            player.zeroSpeedTime = e.t0; // TODO substract timeSeniority;
            player.angle = e.angle;
        } else if (e.type === "start_pointing") {
            player.pointerAngle = e.angle;
            player.showPointerTriangle = true;
        } else if (e.type === "end_pointing") {
            player.showPointerTriangle = false;
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
