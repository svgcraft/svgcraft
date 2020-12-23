"use strict";

class Touchnavi {
    constructor(dom) {
        dom.style.cursor = "none";
        dom.oncontextmenu = e => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };
        this.listeners = [];
        // previous position used to determine speed must lie within this time window:
        this.minTimeDiff = 0.05;
        this.maxTimeDiff = 0.09;
        let history = []; // [x, y, t] tuples
        dom.addEventListener("pointermove", e => {
            const relX = e.offsetX / dom.clientWidth;
            const relY = e.offsetY / dom.clientWidth; // 1.0 ~ width, even if touchpad is not square
            const t = e.timeStamp / 1000;
            while (history.length > 0 && t - history[0][2] > this.maxTimeDiff) history.shift();
            if (history.length > 0) {
                const dt = t - history[0][2];
                if (dt > this.minTimeDiff) {
                    const dx = relX - history[0][0];
                    const dy = relY - history[0][1];
                    const e2 = {
                        speedX: dx / dt,
                        speedY: dy / dt,
                        timeStamp: e.timeStamp
                    }
                    for (var f of this.listeners) f(e2);
                }
            }
            history.push([relX, relY, t]);
        });        
    }
    addSpeedListener(f) {
        this.listeners.push(f);
    }
}
