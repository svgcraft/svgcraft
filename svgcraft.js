var is_dragging = false;
var lastMouseX = null;
var lastMouseY = null;
var mainSvgX = 0;
var mainSvgY = 0;
var zoomScale = 1.0;
var mainSvgElem = null;
var mapPortDiv = null;

function port_coord_to_world(p) {
    return p.add(new Point(mainSvgX, mainSvgY)).scale(zoomScale);
}

function set_transform() {
    mainSvgElem.style.transform = `translate(${mainSvgX}px, ${mainSvgY}px) scale(${zoomScale})`;
    add_needed_tiles();
}

function setup_scroll_and_zoom() {
    mainSvgElem = document.getElementById("mainsvg");
    mapPortDiv = document.getElementById("mapport");
    mapPortDiv.addEventListener("mousedown", function(e){
        is_dragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
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
var tileWidth = 10000;
var tileHeight = 10000;

function modulo(n, m) {
    return ((n % m) + m) % m;
}

function some_random(i, j) {
    return (new Math.seedrandom(i + "aa" + j))();
}

function add_tile_if_not_there(i, j) {
    var id = `Tile_${i}_${j}`;
    if (!document.getElementById(id)) {
        var kind = Math.floor(some_random(i, j) * tileTemplateGs.length);
        var newTileG = tileTemplateGs[kind].cloneNode(true);
        newTileG.id = id;
        newTileG.style.transform = `translate(${i*tileWidth}px, ${j*tileHeight}px)`;
        document.getElementById("Tiles").appendChild(newTileG);
    }
}

function add_needed_tiles() {
    var start_i = Math.floor(-mainSvgX / zoomScale / tileWidth);
    var start_j = Math.floor(-mainSvgY / zoomScale / tileHeight);
    var end_i = Math.ceil((mapPortDiv.clientWidth - mainSvgX) / zoomScale / tileWidth);
    var end_j = Math.ceil((mapPortDiv.clientHeight - mainSvgY) / zoomScale / tileHeight);
    for (var i = start_i; i < end_i; i++) {
        for (var j = start_j; j < end_j; j++) {
            add_tile_if_not_there(i, j);
        }
    }
}

function setup_tiles() {
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

function init() {
    setup_scroll_and_zoom();
    setup_tiles();
    set_transform();
    console.log("init done");
}
