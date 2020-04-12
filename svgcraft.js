"use strict";

var lastMousePos = null;

function I(id) {
    return document.getElementById(id);
}

const debug = false;

function set_cursor(name) {
    if (debug && name === "none") name = "crosshair";
    I("mapport").style.cursor = name;
}

function port_coord_to_world(p) {
    return p.add(new Point(app.myAvatar.view.x, app.myAvatar.view.y)).scale(app.myAvatar.view.scale);
}

function set_lastMousePos(e) {
    lastMousePos = new Point(e.clientX, e.clientY);
}

function encode_transform() {
    return `translate(${app.myAvatar.view.x}px, ${app.myAvatar.view.y}px) scale(${app.myAvatar.view.scale})`;
}

function set_transform() {
    I("mainsvg").style.transform = encode_transform();
    expand_background();
}

function replace_node(newElem, oldElem) {
    oldElem.parentNode.replaceChild(newElem, oldElem);
}

function replace_with_clone(elem) {
    const newone = elem.cloneNode(true);
    replace_node(newone, elem);
    return newone;
}

function event_to_world_coords(e) {
    const rect = I("mapport").getBoundingClientRect();
    const xInPort = e.clientX - rect.left;
    const yInPort = e.clientY - rect.top;
    return new Point((xInPort - app.myAvatar.view.x) / app.myAvatar.view.scale,
                     (yInPort - app.myAvatar.view.y) / app.myAvatar.view.scale);
}

function mousedown_begin_map_move(e) {
    if (!is_left_button(e)) return;
    app.post({
        action: "upd",
        id: app.avatarId,
        pos: event_to_world_coords(e),
        animate: 'jump'
    });
    enter_state("map_move");
    set_lastMousePos(e);
}

function wheel_zoom(e) {
    e.preventDefault();
    const zoomChange = Math.exp(e.deltaY * -0.001);
    const rect = I("mapport").getBoundingClientRect();
    const xInPort = e.clientX - rect.left;
    const yInPort = e.clientY - rect.top;
    // everybody knows what you're looking at!
    app.post({
        action: "upd",
        id: app.avatarId,
        view: {
            x: xInPort - (xInPort - app.myAvatar.view.x) * zoomChange,
            y: yInPort - (yInPort - app.myAvatar.view.y) * zoomChange,
            scale: app.myAvatar.view.scale * zoomChange
        }
    });
}

function mousemove_map_move(e) {
    e.preventDefault();
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    // everybody knows what you're looking at!
    app.post({
        action: "upd",
        id: app.avatarId,
        view: {
            x: app.myAvatar.view.x + dx,
            y: app.myAvatar.view.y + dy
        }
    });
    set_lastMousePos(e)
}

var currentShape = null;
var mouseDownPos = null;
var mouseDownPosWithinAvatar = null;

function tool_id_to_shape_name(id) {
    if (!id.startsWith("new-")) throw id + "does not start with 'new-'";
    return id.substring(4, id.length)
}

function click_start_shape(e) {
    if (!is_left_button(e)) return;
    e.currentTarget.classList.add("ActiveTool");
    currentShape = tool_id_to_shape_name(e.currentTarget.id);
    enter_state("place_shape");
}

function toolbutton_click(e) {
    if (!is_left_button(e)) return;
    const newShape = tool_id_to_shape_name(e.currentTarget.id);
    for (const toolBtn of I("Tools").children) {
        toolBtn.classList.remove("ActiveTool");
    }
    if (newShape === currentShape) {
        currentShape = null;
        enter_state("default");
    } else {
        e.currentTarget.classList.add("ActiveTool");
        currentShape = newShape;
        enter_state("place_shape");
    }
}

function mouseup_start_next_shape(e) {
    app.post({
        action: "upd",
        id: app.avatarId,
        pointer: "none"
    });
    enter_state("place_shape");
}

function back_to_default_state() {
    currentShape = null;
    for (const toolBtn of I("Tools").children) {
        toolBtn.classList.remove("ActiveTool");
    }
    app.post({
        action: "upd",
        id: app.avatarId,
        pointer: "none"
    });
    enter_state("default");
}

function equilateral_triangle_from_center(center, corner) {
    const r = corner.sub(center);
    const p1 = corner;
    const p2 = center.add(r.rotate(Math.PI*2/3));
    const p3 = center.add(r.rotate(-Math.PI*2/3));
    return svg("path", {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} ${p3.x} ${p3.y} ${p1.x} ${p1.y}`});
}

function equilateral_triangle(mid, tip) {
    const h = tip.sub(mid);
    const l = h.norm() / Math.sqrt(3.0);
    const p1 = mid.add(Point.polar(l, h.angle() + Math.PI/2));
    const p2 = mid.add(Point.polar(l, h.angle() - Math.PI/2));
    return {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} ${tip.x} ${tip.y} ${p1.x} ${p1.y}`};
}

function isosceles_triangle(baseMid, baseLength, rotation, height) {
    const tip = baseMid.add(Point.polar(height, rotation));
    const p1 = baseMid.add(Point.polar(baseLength/2, rotation + Math.PI/2));
    const p2 = baseMid.add(Point.polar(baseLength/2, rotation - Math.PI/2));
    return svg("path", {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} ${tip.x} ${tip.y} ${p1.x} ${p1.y}`});
}

function rectangle(origin, corner) {
    const x = Math.min(origin.x, corner.x);
    const y = Math.min(origin.y, corner.y);
    const w = Math.abs(origin.x - corner.x);
    const h = Math.abs(origin.y - corner.y);
    return {x: x, y: y, width: w, height: h};
}

function square(corner1, corner3) {
    const r = corner1.sub(corner3).scale(0.5);
    const center = corner3.add(r);
    const corner0 = center.add(r.rotate(Math.PI/2));
    const corner2 = center.add(r.rotate(-Math.PI/2));
    return {d: 'M ' + [corner0, corner1, corner2, corner3].map((p) => `${p.x} ${p.y}`).join(' L ') + ' z'};
}

function create_shape(name, originPoint, secondPoint) {
    return {
        triangle: equilateral_triangle,
        rectangle: rectangle,
        square: square
    }[name](originPoint, secondPoint);
}

function is_left_button(e) {
    return e.button === 0;
}

function is_right_button(e) {
    return e.button === 2;
}

function mousedown_place_shape_here(e) {
    if (!is_left_button(e)) return;
    if (selectedElemId) {
        app.post({
            action: "deselect",
            who: app.avatarId,
            what: [selectedElemId]
        });
        selectedElemId = null;
    }
    mouseDownPos = event_to_world_coords(e);
    app.post({
        action: "upd",
        id: app.avatarId,
        pos: mouseDownPos,
        animate: 'jump'
    });
    enter_state("adjust_shape");
    set_lastMousePos(e);
}

var nextFreshElemId = 0;

function gen_elem_id(tag) {
    return `${app.avatarId}_${tag}${nextFreshElemId++}`;
}

// the first time this function is called, it's not actually "adjust", but "create"
function mousemove_adjust_shape(e) {
    const p = event_to_world_coords(e);
    const d = p.distanceTo(mouseDownPos) + Avatar.pointerRadius;
    const alpha = p.sub(mouseDownPos).angle();
    const s = create_shape(currentShape, mouseDownPos, p);
    const m = [{
        action: "upd",
        id: app.avatarId,
        pos: mouseDownPos.add(Point.polar(d, alpha)),
        pointer: alpha + Math.PI
    }, s];
    if (selectedElemId) {
        s.action = 'upd';
        s.id = selectedElemId;
    } else {
        s.action = 'new';
        if (currentShape === 'rectangle') {
            s.tag = 'rect';
        } else {
            s.tag = 'path';
        }
        s.id = gen_elem_id(s.tag);
        // s.stroke = I("pick-stroke-color").style.backgroundColor;
        s.fill = I("pick-fill-color").style.backgroundColor;
        selectedElemId = s.id;
        m.push({
            action: "select",
            who: app.avatarId,
            what: [selectedElemId]
        });
    }
    app.post(m);
    set_lastMousePos(e);
}

function set_tool_onclick(f) {
    for (const toolBtn of I("Tools").children) {
        toolBtn.onclick = f;
    }
}

function mousedown_begin_point_at(e) {
    if (!is_left_button(e)) return;
    mouseDownPos = event_to_world_coords(e);
    mouseDownPosWithinAvatar = mouseDownPos.sub(app.myAvatar.pos);
    app.post({
        action: "upd",
        id: app.avatarId,
        pointer: mouseDownPosWithinAvatar.angle()
    });
    enter_state("point_at");
    e.stopImmediatePropagation(); // don't let mapport start a map_move
}

function mousemove_point_at(e) {
    const p = event_to_world_coords(e);
    app.post({
        action: "upd",
        id: app.avatarId,
        pos: p.sub(mouseDownPosWithinAvatar)
    });
    set_lastMousePos(e);
}

function shape_contextmenu(e) {
    const elem = e.target;
    console.log("right click on", elem);
    e.preventDefault();
    const clickedElemId = elem.getAttribute("id");
    const previouslySelected = selectedElemId;
    var m = [];

    // in any case, deselect whatever's currently selected
    if (previouslySelected) {
        m.push({
            action: "deselect",
            who: app.avatarId,
            what: [previouslySelected]
        });
        selectedElemId = null;
    }

    // if a different element than the previously selected one was clicked, select it,
    // else only the above deselect is needed
    if (previouslySelected !== clickedElemId) {
        selectedElemId = clickedElemId;
        const c = I(selectedElemId).getAttribute("fill");
        if (!c.startsWith('url')) I("pick-fill-color").style.backgroundColor = c;
        m.push({
            action: "select",
            who: app.avatarId,
            what: [selectedElemId]
        });
    }

    app.post(m);
}

function enter_state(name) {
    switch (name) {
    case "default":
        I("mapport").onmousedown = mousedown_begin_map_move;
        I("mapport").onmousemove = undefined;
        I("mapport").onmouseup = undefined;
        I("mapport").onwheel = wheel_zoom;
        I("avatar-clickable").onmousedown = mousedown_begin_point_at;
        set_cursor("default");
        break;
    case "map_move":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_map_move;
        I("mapport").onmouseup = back_to_default_state;
        I("mapport").onwheel = undefined;
        I("avatar-clickable").onmousedown = undefined;
        set_cursor("none");
        break;
    case "place_shape":
        I("mapport").onmousedown = mousedown_place_shape_here;
        I("mapport").onmousemove = undefined;
        I("mapport").onmouseup = undefined;
        I("mapport").onwheel = wheel_zoom;
        I("avatar-clickable").onmousedown = undefined;
        set_cursor("crosshair");
        break;
    case "adjust_shape":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_adjust_shape;
        I("mapport").onmouseup = mouseup_start_next_shape;
        I("mapport").onwheel = undefined;
        I("avatar-clickable").onmousedown = undefined;
        set_cursor("none");
        break;
    case "point_at":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_point_at;
        I("mapport").onmouseup = back_to_default_state;
        I("mapport").onwheel = undefined;
        I("avatar-clickable").onmousedown = undefined;
        set_cursor("none");
        break;
    default:
        throw name + " is not a state";
    }
    console.log("Entered state", name);
}

function expand_background() {
    const slack = 10;
    const x = -app.myAvatar.view.x / app.myAvatar.view.scale - slack;
    const y = -app.myAvatar.view.y / app.myAvatar.view.scale - slack;
    const w = (I("mapport").clientWidth - app.myAvatar.view.x) / app.myAvatar.view.scale + 2 * slack - x;
    const h = (I("mapport").clientHeight - app.myAvatar.view.y) / app.myAvatar.view.scale + 2 * slack - y;
    // TODO only do this if rect needs to grow, test if faster
    I("BackgroundRect").setAttribute("x", x);
    I("BackgroundRect").setAttribute("y", y);
    I("BackgroundRect").setAttribute("width", w);
    I("BackgroundRect").setAttribute("height", h);
}

var selectedElemId = null;

function fatal(msg) {
    const d = document.createElement("div");
    d.classList.add("bsod");
    d.innerHTML = `<p>Error: ${msg}</p>`;
    document.body.appendChild(d); // append rather than replace so that we can still inspect the DOM
    throw msg;
}

var app = null;
var pending_avatar_update = null;

function init() {
    if (peerjs.util.browser !== 'chrome') {
        fatal(`Only Chrome is supported!`);
    }
    init_color_picker();
    init_avatar_picker();
    I("color_picker").style.display = 'none';
    // I("pick-stroke-color").style.backgroundColor = 'black';
    I("pick-fill-color").style.backgroundColor = `hsl(${(Date.now() + 180) % 360}, 100%, 50%)`;
    set_tool_onclick(toolbutton_click);

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has("avatarHue") && urlParams.has("avatarEmoji")) {
        pending_avatar_update = {
            action: "upd",
            hue: urlParams.get("avatarHue"),
            emojiUtf: urlParams.get("avatarEmoji")
        };
        I("avatar_picker").style.display = 'none';
    }

    const mode = urlParams.get("mode");
    const worldJsonUrl = urlParams.get("worldJsonUrl");

    replace_node(initial_svg(), I("mainsvg"));

    switch (mode) {
    case "server": {
        const serverId = urlParams.get("serverId");
        if (!serverId) fatal("No serverId");
        if (!worldJsonUrl) fatal("No worldJsonUrl");
        app = new Server(serverId, worldJsonUrl);
        break;
    }
    case "client": {
        const serverId = urlParams.get("serverId");
        if (!serverId) fatal("No serverId");
        app = new Client(serverId);
        break;
    }
    case "solo": {
        if (!worldJsonUrl) fatal("No worldJsonUrl");
        app = new Solo(worldJsonUrl);
        break;
    }
    default: {
        fatal(`unknown mode ${mode}`);
    }}
    app.init();
}
