"use strict";

class Point {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    static polar(r, alpha){
        return new Point(r * Math.cos(alpha), r * Math.sin(alpha));
    }

    add(that) {
        return new Point(this.x + that.x, this.y + that.y);
    }

    sub(that) {
        return new Point(this.x - that.x, this.y - that.y);
    }

    norm() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    rotate(alpha) {
        return Point.polar(this.norm(), Math.atan2(this.y, this.x) + alpha);
    }
}

var avatarPos = null;
var lastMousePos = null;
var world = null;

function I(id) {
    return document.getElementById(id);
}

function port_coord_to_world(p) {
    return p.add(new Point(world.view.x, world.view.y)).scale(world.view.scale);
}

function set_lastMousePos(e) {
    lastMousePos = new Point(e.clientX, e.clientY);
}

function encode_transform() {
    return `translate(${world.view.x}px, ${world.view.y}px) scale(${world.view.scale})`;
}

function set_transform() {
    I("mainsvg").style.transform = encode_transform();
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

function event_to_world_coords(e) {
    var rect = I("mapport").getBoundingClientRect();
    var xInPort = e.clientX - rect.left;
    var yInPort = e.clientY - rect.top;
    return new Point((xInPort - world.view.x) / world.view.scale,
                     (yInPort - world.view.y) / world.view.scale);
}

function jump_path_d(from, to, jumpHeight) {
    return `M${from.x},${from.y} C${from.x},${from.y-jumpHeight} ${to.x},${to.y-jumpHeight} ${to.x},${to.y}`;
}

function mousedown_begin_map_move(e) {
    set_lastMousePos(e);
    const p = event_to_world_coords(e);

    var d = jump_path_d(avatarPos, p, 400);

    var showJumpTrace = false;
    if (showJumpTrace) {
        var path = svg("path", {d: d, fill: "transparent", stroke: "yellow"});
        I("mainsvg").appendChild(path);
    }

    avatarG.style.offsetPath = `path('${d}')`;

    // The right way would be something like this:
    // avatarG.animate([{ "offset-distance": "0%" }, { "offset-distance": "100%" }], 500);
    // But since that doesn't work, we re-trigger the animation by removing and adding the node:
    avatarG = replace_with_clone(avatarG);

    avatarPos.x = p.x;
    avatarPos.y = p.y;
    enter_state("map_move");
}

function wheel_zoom(e) {
    e.preventDefault();
    var zoomChange = Math.exp(e.deltaY * -0.001);
    var rect = I("mapport").getBoundingClientRect();
    var xInPort = e.clientX - rect.left;
    var yInPort = e.clientY - rect.top;
    world.view.x = xInPort - (xInPort - world.view.x) * zoomChange;
    world.view.y = yInPort - (yInPort - world.view.y) * zoomChange;
    world.view.scale *= zoomChange;
    set_transform();
}

function mousemove_map_move(e) {
    e.preventDefault();
    var dx = e.clientX - lastMousePos.x;
    var dy = e.clientY - lastMousePos.y;
    world.view.x += dx;
    world.view.y += dy;
    set_lastMousePos(e)
    set_transform();
}

var currentShape = null;

function tool_id_to_shape_name(id) {
    if (!id.startsWith("new-")) throw id + "does not start with 'new-'";
    return id.substring(4, id.length)
}

function click_start_shape(e) {
    e.currentTarget.classList.add("ActiveTool");
    currentShape = tool_id_to_shape_name(e.currentTarget.id);
    enter_state("place_shape");
}

function back_to_default_state() {
    for (const toolBtn of I("Tools").children) {
        toolBtn.classList.remove("ActiveTool");
    }
    enter_state("default");
}

function equilateral_triangle(center, corner) {
    const r = corner.sub(center);
    const p1 = corner;
    const p2 = center.add(r.rotate(Math.PI*2/3));
    const p3 = center.add(r.rotate(-Math.PI*2/3));
    return svg("path", {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} ${p3.x} ${p3.y} ${p1.x} ${p1.y}`});
}

function rectangle(origin, corner) {
    const x = Math.min(origin.x, corner.x);
    const y = Math.min(origin.y, corner.y);
    const w = Math.abs(origin.x - corner.x);
    const h = Math.abs(origin.y - corner.y);
    return svg("rect", {x: x, y: y, width: w, height: h});
}

function create_shape(name, originPoint, secondPoint) {
    return {
        triangle: equilateral_triangle,
        rectangle: rectangle
    }[name](originPoint, secondPoint);
}

function mousedown_place_shape_here(e) {
    const p = event_to_world_coords(e);
    selectedElement = create_shape(currentShape, avatarPos, p);
    I("EditableElements").appendChild(selectedElement);
    enter_state("adjust_shape");
    set_lastMousePos(e);
}

function mousemove_adjust_shape(e) {
    const p = event_to_world_coords(e);
    I("EditableElements").removeChild(selectedElement);
    selectedElement = create_shape(currentShape, avatarPos, p);
    I("EditableElements").appendChild(selectedElement);
    set_lastMousePos(e);
}

function set_tool_onclick(f) {
    for (const toolBtn of I("Tools").children) {
        toolBtn.onclick = f;
    }
}

function enter_state(name) {
    switch (name) {
    case "default":
        I("mapport").onmousedown = mousedown_begin_map_move;
        I("mapport").onmousemove = undefined;
        I("mapport").onmouseup = undefined;
        I("mapport").onwheel = wheel_zoom;
        set_tool_onclick(click_start_shape);
        break;
    case "map_move":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_map_move;
        I("mapport").onmouseup = back_to_default_state;
        I("mapport").onwheel = undefined;
        set_tool_onclick(undefined);
        break;
    case "place_shape":
        I("mapport").onmousedown = mousedown_place_shape_here;
        I("mapport").onmousemove = undefined;
        I("mapport").onmouseup = undefined;
        I("mapport").onwheel = wheel_zoom;
        set_tool_onclick(back_to_default_state);
        break;
    case "adjust_shape":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_adjust_shape;
        I("mapport").onmouseup = back_to_default_state;
        I("mapport").onwheel = undefined;
        set_tool_onclick(undefined);
        break;
    default:
        throw name + " is not a state";
    }
    console.log("Entered state", name);
}

function expand_background() {
    const slack = 10;
    const x = -world.view.x / world.view.scale - slack;
    const y = -world.view.y / world.view.scale - slack;
    var w = (I("mapport").clientWidth - world.view.x) / world.view.scale + 2 * slack - x;
    var h = (I("mapport").clientHeight - world.view.y) / world.view.scale + 2 * slack - y;
    // TODO only do this if rect needs to grow, test if faster
    I("BackgroundRect").setAttribute("x", x);
    I("BackgroundRect").setAttribute("y", y);
    I("BackgroundRect").setAttribute("width", w);
    I("BackgroundRect").setAttribute("height", h);
}

console.log(twemoji.convert.toCodePoint("🐸"));

// Note: needs v2 to obtain https://twemoji.maxcdn.com/2/svg/1f9d9-1f3fc-200d-2642-fe0f.svg
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
    avatarPos = new Point();
    var img = svg("image", {x: -25, y: -25, height: 50, width: 50});
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', get_emoji_url(avatar_str));
    avatarG = svg("g", {"class": "avatar"},
                  [svg("circle", {cx: avatarPos.x, cy: avatarPos.y, r: 35, fill: "yellow"}), img]);
    I("mainsvg").appendChild(avatarG);
}

var selectedElement = null;

function set_selected_INACTIVE(elem) {
    selectedElement = elem;
    if (elem) {
        I("SvgEdit").value = elem.outerHTML;
    } else {
        I("SvgEdit").value = "";
    }
}

function setup_edit_handlers() {
    /* TODO reactivate
    for (const elem of I("EditableElements").children) {
        elem.onclick = (e) => {
            set_selected(e.target);
        }
    }
    */
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
    replace_node(json2svg(j), I("mainsvg"));
    enter_state("default");
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
