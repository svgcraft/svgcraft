"use strict";

function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

class Touchnavi {
    constructor(dom) {
        dom.style.cursor = "none";
        dom.oncontextmenu = e => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };
        this.listeners = {
            down: [],
            up: [],
            move: [],
            swipe: []
        };
        this.movementThresh = 0.05; // movements less than this are considered no movement, relative to dom.clientWidth
        this.holdWindowLength = 0.08; // how long no movement must have occurred to disable swipe on up, in seconds
        this.swipeHistoryLength = 0.1; // how far back we go when taking average speed for swipe, in seconds
        let historyX = [];
        let historyY = [];
        let historyT = [];
        function addHistory(e) {
            const relX = e.offsetX / dom.clientWidth;
            const relY = e.offsetY / dom.clientWidth; // 1.0 ~ width, even if touchpad is not square
            historyX.unshift(relX);
            historyY.unshift(relY);
            historyT.unshift(e.timeStamp / 1000);
        }
        // finds the earliest event that happened at most t seconds ago
        function findEventIndex(t) {
            var i = 0;
            do { i++; } while (i < historyT.length && historyT[0] - historyT[i] < t);
            return i-1;
        }
        dom.addEventListener("pointerdown", e => {
            addHistory(e);
            const e2 = { 
                type: "down",
                originalEvent: e 
            };
            for (var f of this.listeners.down) f(e2);
        });
        dom.addEventListener("pointerup", e => {
            addHistory(e);
            const e2 = { originalEvent: e };
            const i = findEventIndex(this.holdWindowLength);
            if (dist(historyX[0], historyY[0], historyX[i], historyY[i]) >= this.movementThresh) {
                const j = findEventIndex(this.swipeHistoryLength);
                const dx = historyX[0] - historyX[j];
                const dy = historyY[0] - historyY[j];
                const dt = historyT[0] - historyT[j];
                if (dx*dx + dy*dy > this.movementThresh * this.movementThresh) {
                    e2.speedX = dx / dt;
                    e2.speedY = dy / dt;
                    e2.type = "swipe";
                    for (var f of this.listeners.swipe) f(e2);    
                }
            }
            historyX = [];
            historyY = [];
            historyT = [];
            e2.type = "up";
            for (var f of this.listeners.up) f(e2);
        });
        dom.addEventListener("pointermove", e => {
            addHistory(e);
            if (historyX.length >= 2) {
                const e2 = { 
                    type: "move",
                    originalEvent: e,
                    deltaX: historyX[0] - historyX[1],
                    deltaY: historyY[0] - historyY[1]
                };
                for (var f of this.listeners.move) f(e2);
            }
        });
        
    }
    addEventListener(eventName, f) {
        this.listeners[eventName].push(f);
    }

}