"use strict";

const color_picker = (() => {
    const H = 800; // height of picker
    const D = 30; // width of bars
    const S = 60; // side length of handle
    const G = 50; // gap between two controls
    const T = 15; // handle tip size
    const N = 3; // number of sliders (3 for HSL, 4 for HSLA)
    const W1 = S + T + D + T + S + G; // width of once slider component
    const W = N * W1 + G;
    const defaultSat = '100%';

    function svg(tag, attrs, children) {
        const res = document.createElementNS("http://www.w3.org/2000/svg", tag);
        if (attrs) {
            for (const attrName in attrs) {
                res.setAttribute(attrName, attrs[attrName]);
            }
        }
        if (children) {
            for (const child of children) {
                res.appendChild(child);
            }
        }
        return res;
    }

    function bar(i, barfill) {
        return svg("rect", {
            x: i * W1 + G + S + T, y: G + S/2, width: D, height: H - S - 2 * G, fill: barfill
        });
    }

    function handle(i) {
        return svg("path", {
            "d": `M ${i*W1+G} ${G} ` +
                 `l ${S} 0 l 0 ${S/2-T} l ${T} ${T} l ${-T} ${T} l 0 ${S/2-T} l ${-S} 0 l 0 ${-S} ` +
                 `M ${i*W1+G+S+T+D+T} ${G} ` +
                 `l ${S} 0 l 0 ${S} l ${-S} 0 l 0 ${-(S/2-T)} l ${-T} ${-T} l ${T} ${-T} l 0 ${-(S/2-T)}`,
            "fill": "black",
            "stroke-width": 2,
            "stroke": "white",
            "stroke-linejoin": "round",
            "stroke-linecap": "round"
        });
    }

    function create() {
        var hFrac = 0.1;
        var sFrac = 0.2;
        var lFrac = 0.3;
        function hStr() { return (360*hFrac).toFixed(1).toString(); }
        function sStr() { return (100*sFrac).toFixed(1).toString() + '%'; }
        function lStr() { return (100*lFrac).toFixed(1).toString() + '%'; }
        function get_frac(i) {
            switch (i) {
            case 0: return hFrac;
            case 1: return sFrac;
            case 2: return lFrac;
            default: throw "bad index " + i;
            }
        }
        function set_frac(i, frac) {
            switch (i) {
            case 0: hFrac = frac; break;
            case 1: sFrac = frac; break;
            case 2: lFrac = frac; break;
            default: throw "bad index " + i;
            }
        }
        function upd_frac(i, frac) {
            switch (i) {
            case 0: hFrac += frac; break;
            case 1: sFrac += frac; break;
            case 2: lFrac += frac; break;
            default: throw "bad index " + i;
            }
        }
        const hGradient = svg("linearGradient", {id: "HGradient", gradientTransform: "rotate(90)"}, [
            svg("stop", {"offset":  "0%     ", "stop-color": `hsl(  0, ${defaultSat}, 50%)`}),
            svg("stop", {"offset": "16.6667%", "stop-color": `hsl( 60, ${defaultSat}, 50%)`}),
            svg("stop", {"offset": "33.3333%", "stop-color": `hsl(120, ${defaultSat}, 50%)`}),
            svg("stop", {"offset": "50%"     , "stop-color": `hsl(180, ${defaultSat}, 50%)`}),
            svg("stop", {"offset": "66.6667%", "stop-color": `hsl(240, ${defaultSat}, 50%)`}),
            svg("stop", {"offset": "83.3333%", "stop-color": `hsl(300, ${defaultSat}, 50%)`}),
            svg("stop", {"offset": "100%"    , "stop-color": `hsl(360, ${defaultSat}, 50%)`})
        ]);
        const sGradient = svg("linearGradient", {id: "SGradient", gradientTransform: "rotate(90)"}, [
            svg("stop", {"offset":   "0%", "stop-color": "hsl(180, 100%, 50%)"}),
            svg("stop", {"offset": "100%", "stop-color": "hsl(180,   0%, 50%)"})
        ]);
        const lGradient = svg("linearGradient", {id: "LGradient", gradientTransform: "rotate(90)"}, [
            svg("stop", {"offset":   "0%", "stop-color": "hsl(180, 50%, 100%)"}),
            svg("stop", {"offset":  "50%", "stop-color": "hsl(180, 50%,  50%)"}),
            svg("stop", {"offset": "100%", "stop-color": "hsl(180, 50%,   0%)"})
        ]);
        const defs = svg("defs", {}, [hGradient, sGradient, lGradient]);
        const hBar = bar(0, "url(#HGradient)");
        const sBar = bar(1, "url(#SGradient)");
        const lBar = bar(2, "url(#LGradient)");
        const hHandle = handle(0);
        const sHandle = handle(1);
        const lHandle = handle(2);
        const s = svg("svg", {viewBox: `0 0 ${W} ${H}`, style: "max-width: 100%; max-height: 100%"},
                      [defs, hBar, hHandle, sBar, sHandle, lBar, lHandle]);
        function repaint() {
            hHandle.setAttribute("fill", `hsl(${hStr()}, ${defaultSat}, 50%`);
            sHandle.setAttribute("fill", `hsl(${hStr()}, ${sStr()}, 50%)`);
            lHandle.setAttribute("fill", `hsl(${hStr()}, ${sStr()}, ${lStr()})`);
            sGradient.children[0].setAttribute("stop-color", `hsl(${hStr()}, 0%, 50%)`);
            sGradient.children[1].setAttribute("stop-color", `hsl(${hStr()}, 100%, 50%)`);
            lGradient.children[0].setAttribute("stop-color", `hsl(${hStr()}, ${sStr()},   0%)`);
            lGradient.children[1].setAttribute("stop-color", `hsl(${hStr()}, ${sStr()},  50%)`);
            lGradient.children[2].setAttribute("stop-color", `hsl(${hStr()}, ${sStr()}, 100%)`);
            hHandle.setAttribute("transform", `translate(0, ${hFrac * (H - S - 2 * G)})`);
            sHandle.setAttribute("transform", `translate(0, ${sFrac * (H - S - 2 * G)})`);
            lHandle.setAttribute("transform", `translate(0, ${lFrac * (H - S - 2 * G)})`);
        }
        var lastMouseY = null;
        var handleBeingMoved = null;
        function onhandlemousedown(i) {
            return (e) => {
                if (e.buttons !== 1) return;
                handleBeingMoved = i;
                lastMouseY = e.screenY;
            };
        }
        function oncomponentmousemove(e) {
            if (e.buttons !== 1) return;
            if (handleBeingMoved === null) return;
            const currentMouseY = e.screenY;
            const dy = currentMouseY - lastMouseY;
            const dFrac = dy / s.getBoundingClientRect().height * H / (H - S - 2 * G);
            var newFrac = get_frac(handleBeingMoved) + dFrac;
            newFrac = Math.min(newFrac, 1);
            newFrac = Math.max(newFrac, 0);
            set_frac(handleBeingMoved, newFrac);
            if (s.oncolorchange) {
                s.oncolorchange(`hsl(${hStr()}, ${sStr()}, ${lStr()})`);
            }
            repaint();
            lastMouseY = currentMouseY;
        }
        function onmouseup(e) {
            handleBeingMoved = null;
        }
        function onbarclick(i) {
            return (e) => {
                const r = s.getBoundingClientRect();
                set_frac(i, ((e.clientY - r.top) / r.height * H - S/2 - G) / (H - S - 2 * G));
                if (s.oncolorchange) {
                    s.oncolorchange(`hsl(${hStr()}, ${sStr()}, ${lStr()})`);
                }
                repaint();
            }
        }
        repaint();
        // don't register it on s, but on window, so that when the user moves outside of s very fast,
        // the slider still goes all the way to the end of the bar
        // s.onmousemove = oncomponentmousemove;
        window.addEventListener('pointermove', oncomponentmousemove);
        window.addEventListener('pointerup', onmouseup);
        s.set_hsl = (h, s, l) => {
            hFrac = h;
            sFrac = s;
            lFrac = l;
            repaint();
        };
        hHandle.onpointerdown = onhandlemousedown(0);
        sHandle.onpointerdown = onhandlemousedown(1);
        lHandle.onpointerdown = onhandlemousedown(2);
        hBar.onclick = onbarclick(0);
        sBar.onclick = onbarclick(1);
        lBar.onclick = onbarclick(2);
        return s;
    }
    return { create: create };
})();
