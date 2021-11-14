"use strict";

// TODO: default_tool should be a no_move tool, and moving should only be added by a subclass

// to build new tools, extend this module, without using `new`,
// as described here: https://stackoverflow.com/a/28281845/
function default_tool(geom, dom, events, arena) {
    const tool = {
        // measured in player radii:
        pointerTriangleWidth: 0.4,
        pointerTriangleHeight: 0.4,
        attachGap: -0.04,
        detachGap: 0.1,

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

        myPlayerCenterToCursor: function() {
            const gap = arena.myPlayer.isPointerAttached ? tool.attachGap : tool.detachGap;
            const headRadius = 1; // hardcoded, actual scaling is done using player.scale
            const r = headRadius + gap + this.pointerTriangleHeight;
            return geom.Point.polar(r * arena.myPlayer.scale, arena.myPlayer.pointerAngle);
        },
    
        cursor: "none", // CSS cursor attribute, "none" means everything is rendered in svg

        applyStroke: function (elem) {
            elem.setAttribute("stroke", "black");
            elem.setAttribute("stroke-width", 0.02);
        },

        playerToDom: function (player) {
            player.relTo ??= "worldPlayers";
            if (!player.g) {
                player.g = dom.svg("g");
                arena.ids.get(player.relTo).g.appendChild(player.g);
            }
            if (this.showAvatar) {
                if (!player.circ) {
                    player.circ = dom.svg("circle", {
                        cx: 0, // 0 relative to origin of surrounding g
                        cy: 0,
                        r: 1 // radius of player is always 1, but player size can be changed using player.scale
                    });
                    this.applyStroke(player.circ);
                    player.g.appendChild(player.circ);
                }
                player.circ.setAttribute("fill", player.color);
            }
            player.scale ??= 0.5;
            player.g.setAttribute("transform", `translate(${player.currentPos.x}, ${player.currentPos.y}) scale(${player.scale})`);
        },

        activateFor: function (player) {
            this.playerToDom(player);
            player.isPointerAttached ??= true;
            player.pointerAngle ??= 0.0;
            const gap = player.isPointerAttached ? this.attachGap : this.detachGap;
            const headRadius = 1; // hardcoded, actual scaling is done using player.scale
            const baseMid = geom.Point.polar(headRadius + gap, player.pointerAngle);
            player.pointerTriangle = dom.svg("path", {
                d: geom.isosceles_triangle(baseMid, this.pointerTriangleWidth, player.pointerAngle, this.pointerTriangleHeight),
                fill: player.color
            });
            this.applyStroke(player.pointerTriangle);
            player.g.insertBefore(player.pointerTriangle, player.circ);
            if (player === arena.myPlayer) {
                arena.arenaDiv.style.cursor = this.cursor;
                this.activateEventListeners();
            }
        },
        deactivateFor: function (player) {
            player.pointerTriangle.remove();
            player.pointerTriangle = undefined;
            if (player === arena.myPlayer) this.deactivateEventListeners();
        },
        activateEventListeners: function () {
            this.addEventListener(arena.arenaDiv, "mousemove", this.hover.bind(this));
        },
        deactivateEventListeners: function () {
            this.removeAllEventListeners();
        },
        pointerdown: function (e) {
        },
        hover: function (e) {
            if (arena.myPlayer.isPointerAttached) {
                this.hoverWithFixedPointerAngle(e);
            } else {
                this.hoverWithFlexiblePointerAngle(e);
            }
        },
        hoverWithFlexiblePointerAngle: function (e) {
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const current = arena.myPlayer.posAtTime(e.timeStamp / 1000);
            const d = current.sub(mouse);
            const targetZero = mouse.add(d.scaleToLength(this.playerDistToMouse));
            const move = targetZero.sub(current);
            const tToStop = Math.sqrt(2 * move.norm() / arena.myPlayer.decceleration);
            events.publish({
                type: "trajectory",
                x0: targetZero.x,
                y0: targetZero.y,
                t0: e.timeStamp / 1000 + tToStop,
                angle: d.angle(),
                pointerAngle: oppositeAngle(d.angle())
            });
        },
        hoverWithFixedPointerAngle: function (e) {
            const mouse = arena.myPlayer.eventToRelCoords(e);
            const center = mouse.sub(this.myPlayerCenterToCursor());
            // degenerate trajectory (already at speed 0)
            events.publish({
                type: "trajectory",
                x0: center.x,
                y0: center.y,
                t0: e.timeStamp / 1000
            });
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
        if (e.type === "trajectory") {
            const player = sourceId ? arena.ids.get(sourceId) : arena.myPlayer;
            player.zeroSpeedPos = new geom.Point(parseFloat(e.x0), parseFloat(e.y0));
            player.zeroSpeedTime = e.t0; // TODO substract timeSeniority;
            player.angle = e.angle;
        }
    }
    events.subscribe(onEvent);

    return tool;
}
