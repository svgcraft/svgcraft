"use strict";

// to build new tools, extend this module, without using `new`,
// as described here: https://stackoverflow.com/a/28281845/
function default_tool(geom, dom, events, arena) {
    const tool = {
        // measured in player radii:
        pointerTriangleWidth: 0.4,
        pointerTriangleHeight: 0.4,
        attachGap: -0.04,
        detachGap: 0.1,

        playerToDom: function (player) {
            player.relTo ??= "worldPlayers";
            if (!player.g) {
                player.g = dom.svg("g");
                arena.ids.get(player.relTo).g.appendChild(player.g);
            }
            if (!player.circ) {
                player.circ = dom.svg("circle", {
                    cx: 0, // 0 relative to origin of surrounding g
                    cy: 0,
                    r: 1 // radius of player is always 1, but player size can be changed using player.scale
                });
                player.g.appendChild(player.circ);
            }
            player.circ.setAttribute("fill", player.color);
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
            player.g.appendChild(player.pointerTriangle);
            if (player === arena.myPlayer) this.activateEventListeners();
        },
        positionFor: function (player) {
            // use svg transform to rotate pointer triangle around mouse pointer position so that it points away from player center
        },
        deactivateFor: function (player) {
            if (player === arena.myPlayer) this.deactivateEventListeners();
        },
        handleEvent: function (e) { // handleEvent is the name required by browser's EventHandler interface
            switch (e.type) {
                case "mousemove": return this.hover(e); // TODO if a mouse button is down, it's mouse drag
            }
        },
        activateEventListeners: function () {
            arena.mainSvg.addEventListener("mousemove", this);
        },
        deactivateEventListeners: function () {
            arena.mainSvg.removeEventListener("mousemove", this);
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
            // degenerate trajectory (already at speed 0)
            events.publish({
                type: "trajectory",
                x0: mouse.x,
                y0: mouse.y,
                t0: e.timeStamp / 1000
            });
        },
        first_drag: function (e) {
        },
        continue_drag: function (e) {
        },
        end_drag: function (e) {
        },
        click: function (e) {}
    };
    arena.registerTool("default_tool", tool);
    tool.activateFor(arena.myPlayer);


    return tool;
}
