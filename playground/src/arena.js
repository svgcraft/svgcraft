"use strict";

function arena(dom, geom, events) {
    // constants:
    const aspectRatio = 16/9;
    const styleAttrs = ["stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "fill", "fill-opacity", "text-anchor", "font-size"];
    const positionAttrs = ["cx", "cy", "r", "rx", "ry", "d", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "textContent"];
    const gAttrs = ["x0", "y0", "scale"];
    const updatableSvgAttrs = styleAttrs.concat(positionAttrs);
    const updatableAttrs = updatableSvgAttrs.concat(gAttrs);

    // classes:

    class DecceleratingObject {
        /** @param initialPos {Point} */
        constructor(initialPos) {
            this.zeroSpeedPos = initialPos;
            this.zeroSpeedTime = -1e10;
            this.movementAngle = 0.12345;
        }
        /** @returns {Float} deccelaration in svg position units per sec^2 */
        get decceleration() {
            throw "not implemented";
        }
        /** @param time in seconds */
        speedAtTime(time) {
            const t = Math.max(0, this.zeroSpeedTime - time);
            return geom.Point.polar(this.decceleration * t, this.movementAngle);
        }
        /** @param time in seconds */
        posAtTime(time) {
            const t = Math.max(0, this.zeroSpeedTime - time);
            const d = 0.5 * this.decceleration * t * t;
            return this.zeroSpeedPos.sub(geom.Point.polar(d, this.movementAngle));
        }
    }

    class Player extends DecceleratingObject {
        // each module can add properties as it pleases, no name conflict avoidance at the moment

        constructor(initialPos) {
            super(initialPos);
        }

        get decceleration() {
            return 10;
        }

        /** @param e {MouseEvent} */
        eventToRelCoords(e) {
            if (this.relTo === "worldPlayers") {
                const r = arenaDiv.getBoundingClientRect();
                const x = e.pageX - r.left;
                const y = e.pageY - r.top;
                return new geom.Point(x / r.width * this.view.unitsPerWidth + this.view.x,
                                      y / r.width * this.view.unitsPerWidth + this.view.y);
            } else {
                throw "relTo not yet supported"
            }
        }
    
    }

    // state:
    const view = {
        // svg coordinates of the point currently at the top left corner of the viewport
        x: 0,
        y: 0,
        // how many svg units fit into one viewport width:
        unitsPerWidth: 10
    };
    const ids = new Map(); // all objects, players, views -- everything that has a string id and is displayed somewhere
    const players = new Map();
    const tools = {};

    // functions:

    /** @deprecated Try to access DOM elements by storing them into JS variables instead */
    function I(id) {
        return document.getElementById(id);
    }

    function registerTool(name, tool) {
        tools[name] = tool;
    }

    /** 
     * @param playerId {string} player name without spaces
     * @param color {string} SVG/CSS color 
     */
    function addPlayer(playerId, color) {
        const player = new Player(new geom.Point(4, 5));
        player.id = playerId;
        player.color = color;
        player.currentPos = new geom.Point(2, 5);
        player.activeTool = "default_tool";
        player.relTo = "worldPlayers"; // id of element to which the player's position is relative
        ids.set(playerId, player);
        players.set(playerId, player);
        return player;
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

    function viewToDom(view) {
        const r = arenaDiv.getBoundingClientRect();
        const pxPerUnit = r.width / view.unitsPerWidth;
        const tx = - view.x * pxPerUnit;
        const ty = - view.y * pxPerUnit;
        mainSvg.style.transform = `translate(${tx}px, ${ty}px) scale(${pxPerUnit})`;
    }

    function onResize() {
        const viewportWidthPx = Math.min(window.innerWidth, window.innerHeight * aspectRatio);
        const viewportHeightPx = Math.min(window.innerHeight, window.innerWidth / aspectRatio);
        arenaDiv.style.left = (window.innerWidth - viewportWidthPx) / 2 + "px";
        arenaDiv.style.right = arenaDiv.style.left;
        arenaDiv.style.top = (window.innerHeight - viewportHeightPx) / 2 + "px";
        arenaDiv.style.bottom = arenaDiv.style.top;
        viewToDom(view);
    }

    function frame(t) {
        for (let player of players.values()) {
            player.currentPos = player.posAtTime(t); // TODO could be smoothened
            tools[player.activeTool].playerToDom(player);
        }
    }

    function shapeMsgToDom(m, sourceId) {
        if (m.type === "rect" || m.type === "line" || m.type === "circle" || m.type === "text") {
            const parent = I(m.parent);
            if (parent === null) {
                log.state(`Ignoring object because its parent ${m.parent} was not found`, m);
                return;
            }
            let o = ids.get(m.id);
            let d = I(m.id) ?? undefined;
            if ((o === undefined) != (d === undefined)) throw 'arena.ids and DOM got out of sync';
            const needsG = m.type === "rect" || m.type === "circle";
            if (o === undefined) {
                o = { type: m.type, id: m.id, scale: 1, parent: m.parent };
                ids.set(o.id, o);
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

    const mainSvg = dom.svg("svg", { style: "position: absolute; overflow: visible; top: 0; left: 0; transform-origin: top left;"}, [
        dom.svg("defs", {}, [
            dom.svg("linearGradient", { id: "skyGradient", gradientTransform: "rotate(90)" }, [
                dom.svg("stop", { offset: "49.9750125%", "stop-color": "#0080ff" }),
                dom.svg("stop", { offset: "50.0249875%", "stop-color": "#46caff" })
            ])
            /*, TODO move to video module
            dom.svg("clipPath", { id: "clipVideo", clipPathUnits: "objectBoundingBox" }, [
                dom.svg("circle", { cx: "0.5", cy: "0.5", r: "0.45" })
            ])
            */
        ]),
        dom.svg("rect", { x: "-10000",  y: "-10000", width: "20000", height: "20000", fill: "url('#skyGradient')" })
    ]);
    const arenaDiv = dom.elem("div", { style: "position:absolute; overflow: hidden;" }, [mainSvg]);
    document.body.appendChild(arenaDiv);
    document.body.style.backgroundColor = "black";
    const objectsG = dom.svg("g", { id: "objects" });
    mainSvg.appendChild(objectsG);
    const worldPlayersG = dom.svg("g", { id: "worldPlayers" }); // for those players whose position is relative to the world
    mainSvg.appendChild(worldPlayersG);
    ids.set("worldPlayers", { g: worldPlayersG });
    window.addEventListener('resize', onResize);
    onResize();
    events.subscribe(shapeMsgToDom);

    const myPlayer = addPlayer("testplayer", "orange");
    myPlayer.view = view;

    let handle = window.requestAnimationFrame(paint);
    function paint(timestamp) {
        frame(timestamp/1000);
        handle = window.requestAnimationFrame(paint);    
    }
    window.addEventListener("keypress", e => {
        if (e.key === "q") {
            window.cancelAnimationFrame(handle);
        }
    });
    window.addEventListener("contextmenu", function(e) { e.preventDefault(); });
    document.body.style.touchAction = "none"; // don't use browser's scroll/zoom on touch events

    // exports:
    return {
        mainSvg: mainSvg,
        arenaDiv: arenaDiv,
        ids: ids,
        Player: Player,
        myPlayer: myPlayer,
        viewToDom: viewToDom,
        registerTool: registerTool
    };
}
