"use strict";

function I(id) {
    return document.getElementById(id);
}

function positionLine(dom, x1, y1, x2, y2) {
    dom.setAttribute("x1", x1);
    dom.setAttribute("y1", y1);
    dom.setAttribute("x2", x2);
    dom.setAttribute("y2", y2);
}

function initSwipepad(svg) {
    svg.style.cursor = "none";
    svg.oncontextmenu = e => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    const line = svg.getElementsByTagName("line")[0];
    let lastX = null;
    let lastY = null;
    svg.addEventListener("pointerdown", e => {
        line.setAttribute("class", "visible");
    });
    svg.addEventListener("pointermove", e => {
        const relX = e.offsetX / svg.clientWidth;
        const relY = e.offsetY / svg.clientWidth; // 1.0 ~ width, even if pad is not square
        if (lastX === null) lastX = relX;
        if (lastY === null) lastY = relY;
        positionLine(line, lastX, lastY, relX, relY);
    });
    svg.addEventListener("pointerup", e => {
        line.setAttribute("class", "hidden");
        lastX = null;
        lastY = null;        
    });
    function onResize() {
        const h = svg.parentNode.clientHeight / svg.parentNode.clientWidth;
        svg.setAttribute("viewBox", `0 0 1 ${h}`);
    }
    window.addEventListener("resize", onResize);
    onResize();
}

function init() {
    initSwipepad(I("LeftPad"));
    initSwipepad(I("RightPad"));
}

window.onload = init;
