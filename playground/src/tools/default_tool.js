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

        activateFor: function (player) {
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
        },
        positionFor: function (player) {
            // use svg transform to rotate pointer triangle around mouse pointer position so that it points away from player center
        },
        deactivateFor: function (player) {
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
            const mouse = arena.eventToWorldCoords(e);
            const current = arena.myPlayer.posAtTime(arena.lastT);
            const d = current.sub(mouse);
            const targetZero = mouse.add(d.scaleToLength(this.playerDistToMouse));
            const move = targetZero.sub(current);
            const tToStop = Math.sqrt(2 * move.norm() / arena.myPlayer.decceleration);
            events.publish({
                type: "trajectory",
                x0: targetZero.x,
                y0: targetZero.y,
                t0: arena.lastT + tToStop,
                angle: d.angle(),
                // when bouncing on a wall, angle changes, while pointerAngle remains
                pointerAngle: oppositeAngle(d.angle())
            });
        },
        hoverWithFixedPointerAngle: function (e) {
            const mouse = arena.eventToWorldCoords(e);
            const targetZero = mouse.sub(Point.polar(this.playerDistToMouse, arena.myPlayer.pointerAngle));
            const current = arena.myPlayer.posAtTime(arena.lastT);
            const move = targetZero.sub(current);
            const tToStop = Math.sqrt(2 * move.norm() / arena.myPlayer.decceleration);
            events.publish({
                type: "trajectory",
                x0: targetZero.x,
                y0: targetZero.y,
                t0: arena.lastT + tToStop
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
