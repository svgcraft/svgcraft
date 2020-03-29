// Import for side-effects only. The side effect of this import is that the "Math"
// object is extended with a method called "seedrandom" which can be used to obtain
// a deterministic pseudo random generator.
import "https://cdnjs.cloudflare.com/ajax/libs/seedrandom/3.0.5/seedrandom.min.js";

// provides twemoji.parse
import twemoji from "./third_party/twemoji.esm.js";

var is_dragging = false;
var lastMouseX = null;
var lastMouseY = null;
var mainSvgX = 0;
var mainSvgY = 0;
var zoomScale = 1.0;
var mainSvgElem = null;
var mapPortDiv = null;
var setup_tile = null;

function port_coord_to_world(p) {
    return p.add(new Point(mainSvgX, mainSvgY)).scale(zoomScale);
}

function encode_transform() {
    return `translate(${mainSvgX}px, ${mainSvgY}px) scale(${zoomScale})`;
}

// s could be eg "translate(210px, 180px) scale(0.4)"
function decode_transform(s) {
    var r = /translate\(([0-9.]+)px, ([0-9.]+)px\) scale\(([0-9.]+)\)/;
    var initialPosMatch = s.match(r);
    if (initialPosMatch) {
        mainSvgX = parseFloat(initialPosMatch[1]);
        mainSvgY = parseFloat(initialPosMatch[2]);
        zoomScale = parseFloat(initialPosMatch[3]);
    }
}

function set_transform() {
    mainSvgElem.style.transform = encode_transform();
    add_needed_tiles();
}

function setup_scroll_and_zoom() {
    mainSvgElem = document.getElementById("mainsvg");
    mapPortDiv = document.getElementById("mapport");
    decode_transform(mainSvgElem.style.transform);
    console.log("initial transform: " + encode_transform());
    mapPortDiv.addEventListener("mousedown", function(e){
        is_dragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        var rect = mapPortDiv.getBoundingClientRect();
        var xInPort = e.clientX - rect.left;
        var yInPort = e.clientY - rect.top;
        var xInWorld = (xInPort - mainSvgX) / zoomScale;
        var yInWorld = (yInPort - mainSvgY) / zoomScale;
        avatarG.style.transform = `translate(${xInWorld}px, ${yInWorld}px)`;
    });
    mapPortDiv.addEventListener("mouseup", function(){
        is_dragging = false;
    });
    mapPortDiv.addEventListener("mousemove", function(e){
        if (!is_dragging) return;
        e.preventDefault();
        var dx = e.clientX - lastMouseX;
        var dy = e.clientY - lastMouseY;
        mainSvgX += dx;
        mainSvgY += dy;
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
        mainSvgX = xInPort - (xInPort - mainSvgX) * zoomChange;
        mainSvgY = yInPort - (yInPort - mainSvgY) * zoomChange;
        zoomScale *= zoomChange;
        set_transform();
    });
}

var tileTemplateGs = null;
var tileWidth = -1;
var tileHeight = -1;

function modulo(n, m) {
    return ((n % m) + m) % m;
}

function add_tile_if_not_there(i, j) {
    var id = `Tile_${i}_${j}`;
    if (!document.getElementById(id)) {
        var rng = new Math.seedrandom(i + "aa" + j);
        var kind = Math.floor(rng() * tileTemplateGs.length);
        var newTileG = tileTemplateGs[kind].cloneNode(true);
        newTileG.id = id;
        setup_tile(newTileG, i, j, rng);
        newTileG.style.transform = `translate(${i*tileWidth}px, ${j*tileHeight}px)`;
        document.getElementById("Tiles").appendChild(newTileG);
    }
}

function add_needed_tiles() {
    var start_i = Math.floor(-mainSvgX / zoomScale / tileWidth);
    var start_j = Math.floor(-mainSvgY / zoomScale / tileHeight);
    var end_i = Math.ceil((mapPortDiv.clientWidth - mainSvgX) / zoomScale / tileWidth);
    var end_j = Math.ceil((mapPortDiv.clientHeight - mainSvgY) / zoomScale / tileHeight);
    var backgroundRect = document.getElementById("BackgroundRect");

    backgroundRect.setAttribute("x", start_i * tileWidth);
    backgroundRect.setAttribute("y", start_j * tileHeight);
    backgroundRect.setAttribute("width", (end_i - start_i) * tileWidth);
    backgroundRect.setAttribute("height", (end_j - start_j) * tileHeight);
    for (var i = start_i; i < end_i; i++) {
        for (var j = start_j; j < end_j; j++) {
            add_tile_if_not_there(i, j);
        }
    }
}

function setup_tiles() {
    var backgroundRect = document.getElementById("BackgroundRect");
    tileWidth = parseFloat(backgroundRect.getAttribute("width"));
    tileHeight = parseFloat(backgroundRect.getAttribute("height"));
    var tileTemplatesG = document.getElementById("TileTemplates");
    document.getElementById("mainsvg").removeChild(tileTemplatesG);
    tileTemplateGs = [];
    for (var i = 0; i < tileTemplatesG.children.length; i++) {
        var tile = tileTemplatesG.children[i];
        for (var c = 0; c < tile.getAttribute("data-freq"); c++) {
            // push mulitple times (without copying) to increase its chances of being picked
            tileTemplateGs.push(tile);
        }
    }
}

console.log(twemoji.convert.toCodePoint("🐸"));

console.log(get_emoji_url("👖"));

console.log(twemoji.parse("🐸", {
  folder: 'svg',
  ext: '.svg'
}));

function get_emoji_url(s) {
    return `${twemoji.base}svg/${twemoji.convert.toCodePoint(s)}.svg`;
}

function svg(tag, attrs, children) {
    var res = document.createElementNS("http://www.w3.org/2000/svg", tag);
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

var avatarG = null;

function setup_avatar(avatar_str) {
    var img = svg("image", {x: -25, y: -25, height: 50, width: 50});
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', get_emoji_url(avatar_str));
    avatarG = svg("g", {}, [svg("circle", {cx: 0, cy: 0, r: 35, fill: "yellow"}), img]);
    mainSvgElem.appendChild(avatarG);
}

// the function passed in should have the following signature (or be undefined)
//
//   function specialize_tile(tile, i, j, rng)
//
//  tile: <g></g>
//  i, j: tile coordinates
//  rng: random number generator seeded with value derived deterministically from i and j
export function init(specialize_tile) {
    setup_scroll_and_zoom();
    if (specialize_tile) {
        setup_tile = specialize_tile;
    } else {
        setup_tile = (tile, i, j, rng) => {};
    }
    setup_tiles();
    set_transform();
    setup_avatar("🐸");
    console.log("init done");
}
