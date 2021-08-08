"use strict";

function lettersoup(dom, events, arena) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("lettersoup")) {
        const letters = urlParams.get("letters");
        const circleColor = "yellow";
        const circleRadius = 0.3;
        const maxSpread = 3;
        const fontSize = 0.5;

        const m = [];
        for (var i = 0; i < letters.length; i++) {
            m.push({
                type: "circle",
                id: `lettersoup_circle_${i}`,
                parent: "objects",
                x0: pos.x + (Math.random() - 0.5) * 2 * maxSpread,
                y0: pos.y + (Math.random() - 0.5) * 2 * maxSpread,
                cx: 0,
                cy: 0,
                r: circleRadius,
                fill: circleColor,
            });
            m.push({
                type: "text",
                id: `lettersoup_letter_${i}`,
                parent: `lettersoup_circle_${i}`,
                "text-anchor": "middle",
                "font-size": fontSize,
                textContent: letter,
                x: 0,
                y: circleRadius/2
            });
        };
        events.publish(m);
    }
    return {};
}
