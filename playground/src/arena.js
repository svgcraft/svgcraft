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

    class Player {
        // each module can add properties as it pleases, no name conflict avoidance at the moment
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
        const player = new Player();
        player.id = playerId;
        player.color = color;
        player.currentPos = new geom.Point(4, 5);
        player.relTo = "worldPlayers"; // id of element to which the player's position is relative
        ids.set(playerId, player);
        playerToDom(player);
        return player;
    }

    function playerToDom(player) {
        player.relTo ??= "worldPlayers";
        if (!player.g) {
            player.g = dom.svg("g");
            ids.get(player.relTo).g.appendChild(player.g);
        }
        if (!player.circ) {
            player.circ = dom.svg("circle", {
                cx: 0, // 0 relative to origin of surrounding g
                cy: 0,
                r: 1 // radius of player is always 1, but player size can be changed using player.scale
            });
            player.g.appendChild(player.circ);
        }
        player.circ.setAttribute("fill", player.color);
        player.scale ??= 0.5;
        player.g.setAttribute("transform", `translate(${player.currentPos.x}, ${player.currentPos.y}) scale(${player.scale})`);
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

    const arenaSvg = dom.svg("svg", { style: "position: absolute; overflow: visible; top: 0; left: 0; transform-origin: top left;"}, [
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
    const arenaClipperDiv = dom.elem("div", { style: "position:absolute; overflow: hidden;" }, [arenaSvg]);
    document.body.appendChild(arenaClipperDiv);
    document.body.style.backgroundColor = "black";
    const objectsG = dom.svg("g", { id: "objects" });
    arenaSvg.appendChild(objectsG);
    const worldPlayersG = dom.svg("g", { id: "worldPlayers" }); // for those players whose position is relative to the world
    arenaSvg.appendChild(worldPlayersG);
    ids.set("worldPlayers", { g: worldPlayersG });
    window.addEventListener('resize', onResize);
    onResize();
    events.subscribe(shapeMsgToDom);

    const myPlayer = addPlayer("testplayer", "orange");

    // exports:
    return {
        view: view,
        ids: ids,
        Player: Player,
        myPlayer: myPlayer,
        registerTool: registerTool
    };
}
