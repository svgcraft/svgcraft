"use strict";

function mill(dom, events, arena) {

    const boardColor = "#e1c16e";
    const gridColor = "#bbb";
    const gridLineWidth = 0.1;
    const stoneRadius = 0.3;
    const stoneDist = 0.8;
    const maxPosImprecision = 0.09;

    // The surrounding rect and the stones are an ordinary rect and circles,
    // which can be moved like rects and circles (TODO lock size of circles and aspect
    // ratio of rect), whereas the grid gets a separate message type and is drawn
    // by this plugin
    function millMsg(index, pos) {
        const m = [];
        m.push({
            type: "rect",
            id: `mill_board_${index}`,
            parent: "objects",
            scale: 0.25,
            // absolute
            x0: pos.x,
            y0: pos.y,
            // relative to (x0, y0) and scale
            x: -5,
            y: -4,
            width: 10,
            height: 8,
            fill: boardColor
        });
        m.push({
            type: "mill_grid",
            parent: `mill_board_${index}`
        });
        function stoneMsgs(color, x) {
            function stone(y) {
                m.push({
                    type: "circle",
                    id: `mill_stone_${color}_${y}`,
                    parent: `mill_board_${index}`,
                    x0: x + (Math.random() - 0.5) * 2 * maxPosImprecision,
                    y0: y + (Math.random() - 0.5) * 2 * maxPosImprecision,
                    cx: 0,
                    cy: 0,
                    r: stoneRadius,
                    fill: color
                });
            };
            stone(0);
            for (let i = 1; i <= 4; i++) {
                stone(i * stoneDist);
                stone(- i * stoneDist);
            }
        }
        stoneMsgs("white", -4);
        stoneMsgs("black", 4);
        return m;
    }

    function connector(innerX, innerY) {
        return dom.svg("line", {
            x1: innerX,
            y1: innerY,
            x2: innerX * 3,
            y2: innerY * 3,
            stroke: gridColor,
            "stroke-width": gridLineWidth
        });
    }

    function ring(radius) {
        return dom.svg("rect", {
            x0: 0,
            y0: 0,
            x: -radius,
            y: -radius,
            width: 2 * radius,
            height: 2 * radius,
            stroke: gridColor,
            "stroke-width": gridLineWidth,
            fill: "transparent"
        });
    }

    function addMillGrid(g) {
        g.appendChild(ring(1));
        g.appendChild(ring(2));
        g.appendChild(ring(3));
        g.appendChild(connector(-1, 0));
        g.appendChild(connector(0, 1));
        g.appendChild(connector(1, 0));
        g.appendChild(connector(0, -1));
    }

    function processMsg(m) {
        if (m.type === "mill_grid") {
            const parent = document.getElementById(m.parent);
            addMillGrid(parent);
        }
    }
    events.subscribe(processMsg);
    
    events.publish(millMsg(0, { x: 8, y: 4}));
}
