"use strict";

class LetterSoup extends MiniGame {
    constructor(pos, gameState, letters) {
        super(pos, gameState);
        this.letters = letters;
        this.circleColor = "yellow";
        this.circleRadius = 0.3;
        this.maxSpread = 3;
        this.fontSize = 0.5;
    }

    init() {
        const m = [];
        for (const letter of this.letters) {
            const circleId = this.gameState.freshId();
            m.push({
                type: "circle",
                id: circleId,
                parent: "objects",
                x0: this.pos.x + (Math.random() - 0.5) * 2 * this.maxSpread,
                y0: this.pos.y + (Math.random() - 0.5) * 2 * this.maxSpread,
                cx: 0,
                cy: 0,
                r: this.circleRadius,
                fill: this.circleColor,
            });
            m.push({
                type: "text",
                id: this.gameState.freshId(),
                parent: circleId,
                "text-anchor": "middle",
                "font-size": this.fontSize,
                textContent: letter,
                x: 0,
                y: this.circleRadius/2
            });
        };
        this.gameState.events.publish(m);
    }
}
