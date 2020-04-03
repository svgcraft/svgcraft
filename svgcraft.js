"use strict";

var is_dragging = false;
var lastMouseX = null;
var lastMouseY = null;
var lastAvatarX = null;
var lastAvatarY = null;
var mainSvgElem = null;
var mapPortDiv = null;
var setup_tile = null;
var world = null;

function port_coord_to_world(p) {
    return p.add(new Point(world.view.x, world.view.y)).scale(world.view.scale);
}

function encode_transform() {
    return `translate(${world.view.x}px, ${world.view.y}px) scale(${world.view.scale})`;
}

function set_transform() {
    mainSvgElem.style.transform = encode_transform();
    expand_background();
}

function replace_node(newElem, oldElem) {
    oldElem.parentNode.replaceChild(newElem, oldElem);
}

function replace_with_clone(elem) {
    var newone = elem.cloneNode(true);
    replace_node(newone, elem);
    return newone;
}

function setup_scroll_and_zoom() {
    mainSvgElem = document.getElementById("mainsvg");
    mapPortDiv = document.getElementById("mapport");
    console.log("initial transform: " + encode_transform());
    mapPortDiv.addEventListener("mousedown", function(e){
        set_selected(null);
        is_dragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        var rect = mapPortDiv.getBoundingClientRect();
        var xInPort = e.clientX - rect.left;
        var yInPort = e.clientY - rect.top;
        var xInWorld = (xInPort - world.view.x) / world.view.scale;
        var yInWorld = (yInPort - world.view.y) / world.view.scale;

        var jumpHeight = 400;
        var d = `M${lastAvatarX},${lastAvatarY} C${lastAvatarX},${lastAvatarY-jumpHeight} ${xInWorld},${yInWorld-jumpHeight} ${xInWorld},${yInWorld}`;

        var showJumpTrace = false;
        if (showJumpTrace) {
            var path = svg("path", {d: d, fill: "transparent", stroke: "yellow"});
            mainSvgElem.appendChild(path);
        }

        avatarG.style.offsetPath = `path('${d}')`;

        // The right way would be something like this:
        // avatarG.animate([{ "offset-distance": "0%" }, { "offset-distance": "100%" }], 500);
        // But since that doesn't work, we re-trigger the animation by removing and adding the node:
        avatarG = replace_with_clone(avatarG);

        lastAvatarX = xInWorld;
        lastAvatarY = yInWorld;
    });
    mapPortDiv.addEventListener("mouseup", function(){
        is_dragging = false;
    });
    mapPortDiv.addEventListener("mousemove", function(e){
        if (!is_dragging) return;
        e.preventDefault();
        var dx = e.clientX - lastMouseX;
        var dy = e.clientY - lastMouseY;
        world.view.x += dx;
        world.view.y += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        set_transform();
    });
    mapPortDiv.addEventListener("wheel", function(e){
        e.preventDefault();
        var zoomChange = Math.exp(e.deltaY * -0.001);
        var rect = mapPortDiv.getBoundingClientRect();
        var xInPort = e.clientX - rect.left;
        var yInPort = e.clientY - rect.top;
        world.view.x = xInPort - (xInPort - world.view.x) * zoomChange;
        world.view.y = yInPort - (yInPort - world.view.y) * zoomChange;
        world.view.scale *= zoomChange;
        set_transform();
    });
}

function expand_background() {
    const slack = 10;
    const x = -world.view.x / world.view.scale - slack;
    const y = -world.view.y / world.view.scale - slack;
    var w = (mapPortDiv.clientWidth - world.view.x) / world.view.scale + 2 * slack - x;
    var h = (mapPortDiv.clientHeight - world.view.y) / world.view.scale + 2 * slack - y;
    var backgroundRect = document.getElementById("BackgroundRect");
    // TODO only do this if rect needs to grow, test if faster
    backgroundRect.setAttribute("x", x);
    backgroundRect.setAttribute("y", y);
    backgroundRect.setAttribute("width", w);
    backgroundRect.setAttribute("height", h);
}

console.log(twemoji.convert.toCodePoint("🐸"));

// TODO needs /2/ base to obtain
// https://twemoji.maxcdn.com/2/svg/1f9d9-1f3fc-200d-2642-fe0f.svg
// Use https://emojipedia.org/twitter/ as the emoji picker
console.log(get_emoji_url("🧙🏼‍♂️"));

console.log(twemoji.parse("🐸", {
  folder: 'svg',
  ext: '.svg'
}));

function get_emoji_url(s) {
    return `${twemoji.base}svg/${twemoji.convert.toCodePoint(s)}.svg`;
}

function svg(tag, attrs, children, allowedAttrs) {
    var res = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
        for (const attrName in attrs) {
            if (!allowedAttrs || allowedAttrs.includes(attrName)) res.setAttribute(attrName, attrs[attrName]);
        }
    }
    if (children) {
        for (const child of children) {
            res.appendChild(child);
        }
    }
    return res;
}

var avatarG = null;

function setup_avatar(avatar_str) {
    lastAvatarX = 0;
    lastAvatarY = 0;
    var img = svg("image", {x: -25, y: -25, height: 50, width: 50});
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', get_emoji_url(avatar_str));
    avatarG = svg("g", {"class": "avatar"},
                  [svg("circle", {cx: lastAvatarX, cy: lastAvatarY, r: 35, fill: "yellow"}), img]);
    mainSvgElem.appendChild(avatarG);
}

var selectedElement = null;

function set_selected(elem) {
    if (!document.getElementById("SvgEdit")) return; // TODO remove and build DOM in js

    selectedElement = elem;
    if (elem) {
        document.getElementById("SvgEdit").value = elem.outerHTML;
    } else {
        document.getElementById("SvgEdit").value = "";
    }
}

function setup_edit_handlers() {
    var editableElementsG = document.getElementById("EditableElements");
    if (!editableElementsG) return; // TODO remove and build DOM in js

    for (const elem of editableElementsG.children) {
        elem.onclick = (e) => {
            set_selected(e.target);
        }
    }
}

function elem2svg(j) {
    const style = ["stroke", "white", "stroke-width", "fill", "fill-opacity"];
    const funs = {
        circle: (j) => svg("circle", j, [], ["cx", "cy", "r"].concat(style)),
        ellipse: (j) => svg("ellipse", j, [], ["cx", "cy", "rx", "ry"].concat(style)),
        path: (j) => svg("path", j, [], ["d"].concat(style)),
        rect: (j) => svg("rect", j, [], ["x", "y", "width", "height"].concat(style)),
    }
    return funs[j.kind](j);
}

function pattern2svg([patternName, patternObj]) {
    const res = svg("pattern", patternObj, patternObj.elems.map(elem2svg), ["x", "y", "width", "height"]);
    res.setAttribute("id", patternName);
    res.setAttribute("patternUnits", "userSpaceOnUse");
    return res;
}

function patterns2svg(patterns) {
    const res = svg("defs");
    for (const p of Object.entries(patterns)) {
        res.appendChild(pattern2svg(p));
    }
    return res;
}

function json2svg(j) {
    const res = svg("svg", {id: "mainsvg"});
    res.appendChild(patterns2svg(j.patterns));
    res.appendChild(svg("rect", {id: "BackgroundRect", fill: j.backgroundFill}));
    res.appendChild(svg("g", {id: "EditableElements"}, j.elems.map(elem2svg)));
    return res;
}

function init_with_json(j) {
    world = j;
    replace_node(json2svg(j), document.getElementById("mainsvg"));
    setup_scroll_and_zoom();
    set_transform();
    setup_avatar("🐸");
    setup_edit_handlers();
    console.log("initialization done");
}

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const jsonUrl = `${urlParams.get("world")}.json`;
    fetch(jsonUrl).then(res => res.json()).then(init_with_json);
}
