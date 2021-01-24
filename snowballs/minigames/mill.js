"use strict";

class Mill extends MiniGame {
    constructor(pos, gameState) {
        super(pos, gameState);
    }

    static gridColor = "#bbb";
    static gridLineWidth = 0.1;
    static stoneRadius = 0.3;
    static stoneDist = 0.8;
    static maxPosImprecision = 0.09;

    init() {
        const connector = (innerX, innerY) => ({
            type: "line",
            id: this.gameState.freshId(),
            parent: this.id,
            x1: innerX,
            y1: innerY,
            x2: innerX * 3,
            y2: innerY * 3,
            stroke: Mill.gridColor,
            "stroke-width": Mill.gridLineWidth
        });
        const ring = (radius) => ({
            type: "rect",
            id: this.gameState.freshId(),
            parent: this.id,
            x0: 0,
            y0: 0,
            x: -radius,
            y: -radius,
            width: 2 * radius,
            height: 2 * radius,
            stroke: Mill.gridColor,
            "stroke-width": Mill.gridLineWidth,
            fill: "transparent"
        });
        const m = [{
            type: "rect",
            id: this.id,
            parent: "objects",
            scale: 0.25,
            // absolute
            x0: this.pos.x,
            y0: this.pos.y,
            // relative to (x0, y0) and scale
            x: -5,
            y: -5,
            width: 10,
            height: 10,
            fill: "transparent"
        }, ring(1), ring(2), ring(3), 
           connector(-1, 0), connector(0, 1), connector(1, 0), connector(0, -1)
        ];
        const stones = (color, x) => {
            const stone = y => {
                m.push({
                    type: "circle",
                    id: this.gameState.freshId(),
                    parent: this.id,
                    x0: x + (Math.random() - 0.5) * 2 * Mill.maxPosImprecision,
                    y0: y + (Math.random() - 0.5) * 2 * Mill.maxPosImprecision,
                    cx: 0,
                    cy: 0,
                    r: Mill.stoneRadius,
                    fill: color
                });
            };
            stone(0);
            for (let i = 1; i <= 4; i++) {
                stone(i * Mill.stoneDist);
                stone(- i * Mill.stoneDist);
            }
        };
        stones("white", -4);
        stones("black", 4);
        this.gameState.events.publish(m);
    }
}
