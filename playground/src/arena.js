"use strict";

function arena(dom, events) {
    // constants:
    const aspectRatio = 16/9;
    const styleAttrs = ["stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "fill", "fill-opacity", "text-anchor", "font-size"];
    const positionAttrs = ["cx", "cy", "r", "rx", "ry", "d", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "textContent"];
    const gAttrs = ["x0", "y0", "scale"];
    const updatableSvgAttrs = styleAttrs.concat(positionAttrs);
    const updatableAttrs = updatableSvgAttrs.concat(gAttrs);
    
    // state:
    const view = {
        // svg coordinates of the point currently at the top left corner of the viewport
        x: 0,
        y: 0,
        // how many svg units fit into one viewport width:
        unitsPerWidth: 10
    };
    const objects = new Map();

    // functions:

    function I(id) {
        return document.getElementById(id);
    }

    function transferAttrsToDom(j, attrs, target) {
        for (const attr of attrs) {
            if (j[attr] !== undefined) {
                if (attr === "textContent") {
                    target.textContent = j[attr];
                } else {
                    target.setAttribute(attr, j[attr]);
                }
            }
        }
    }
    
    function transferAttrsToObj(j, attrs, target) {
        for (const attr of attrs) {
            if (j[attr] !== undefined) target[attr] = j[attr];
        }
    }
    
    function onResize() {
        const viewportWidthPx = Math.min(window.innerWidth, window.innerHeight * aspectRatio);
        const viewportHeightPx = Math.min(window.innerHeight, window.innerWidth / aspectRatio);
        arenaClipperDiv.style.left = (window.innerWidth - viewportWidthPx) / 2 + "px";
        arenaClipperDiv.style.right = arenaClipperDiv.style.left;
        arenaClipperDiv.style.top = (window.innerHeight - viewportHeightPx) / 2 + "px";
        arenaClipperDiv.style.bottom = arenaClipperDiv.style.top;
        const pxPerUnit = viewportWidthPx / view.unitsPerWidth;
        const tx = - view.x * pxPerUnit;
        const ty = - view.y * pxPerUnit;
        arenaSvg.style.transform = `translate(${tx}px, ${ty}px) scale(${pxPerUnit})`;
    }

    function shapeMsgToDom(m, sourceId) {
        if (m.type === "rect" || m.type === "line" || m.type === "circle" || m.type === "text") {
            const parent = I(m.parent);
            if (parent === null) {
                log.state(`Ignoring object because its parent ${m.parent} was not found`, m);
                return;
            }
            let o = objects.get(m.id);
            let d = I(m.id) ?? undefined;
            if ((o === undefined) != (d === undefined)) throw 'arena.objects and DOM got out of sync';
            const needsG = m.type === "rect" || m.type === "circle";
            if (o === undefined) {
                o = { type: m.type, id: m.id, scale: 1, parent: m.parent };
                objects.set(o.id, o);
                if (needsG) {
                    d = dom.svg(m.type);
                    const g = dom.svg("g", { id: m.id }, [d]);
                    parent.appendChild(g)
                } else {
                    d = dom.svg(m.type, { id: m.id });
                    if (m.type === "text") {
                        d.style.pointerEvents = "none";
                        d.style.cursor = "default";
                    }
                    parent.appendChild(d);
                }
            } else {
                if (needsG) d = d.children[0];
            }
            transferAttrsToObj(m, updatableAttrs, o);
            transferAttrsToDom(o, updatableSvgAttrs, d);
            if (needsG) {
                d.parentNode.setAttribute("transform", `translate(${o.x0}, ${o.y0}) scale(${o.scale})`);
            }
        }
    }

    // initialisation:

    const arenaSvg = dom.svg("svg", { style: "position: absolute; overflow: visible; top: 0; left: 0; transform-origin: top left;"}, [
        dom.svg("defs", {}, [
            dom.svg("linearGradient", { id: "skyGradient", gradientTransform: "rotate(90)" }, [
                dom.svg("stop", { offset: "49.9750125%", "stop-color": "#0080ff" }),
                dom.svg("stop", { offset: "50.0249875%", "stop-color": "#46caff" })
            ]),
            dom.svg("clipPath", { id: "clipVideo", clipPathUnits: "objectBoundingBox" }, [
                dom.svg("circle", { cx: "0.5", cy: "0.5", r: "0.45" })
            ])
        ]),
        dom.svg("rect", { x: "-10000",  y: "-10000", width: "20000", height: "20000", fill: "url('#skyGradient')" }),
        dom.svg("g", { id: "objects" })
    ]);
    const arenaClipperDiv = dom.elem("div", { style: "position:absolute; overflow: hidden;" }, [arenaSvg]);
    document.body.appendChild(arenaClipperDiv);
    document.body.style.backgroundColor = "black";
    window.addEventListener('resize', onResize);
    onResize();
    events.subscribe(shapeMsgToDom);

    // exports:
    return {
        view: view,
        objects: objects
    };
}
