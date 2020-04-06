"use strict";

class Point {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    static zero() {
        return new Point(0, 0);
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

    angle() {
        return Math.atan2(this.y, this.x);
    }

    distanceTo(that) {
        return this.sub(that).norm();
    }

    rotate(alpha) {
        return Point.polar(this.norm(), this.angle() + alpha);
    }
}

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

function jump_path_d(from, to, jumpHeight) {
    return `M${from.x},${from.y} C${from.x},${from.y-jumpHeight} ${to.x},${to.y-jumpHeight} ${to.x},${to.y}`;
}

function avatar_jump_to(a, p) {
    const d = jump_path_d(a.pos, p, 400);

    const showJumpTrace = false;
    if (showJumpTrace) {
        const path = svg("path", {d: d, fill: "transparent", stroke: a.color});
        I("mainsvg").appendChild(path);
    }

    a.g.style.removeProperty("transform");
    a.g.style.offsetPath = `path('${d}')`;
    console.log(a.g.style.cssText);

    // The right way would be something like this:
    // app.myAvatar.g.animate([{ "offset-distance": "0%" }, { "offset-distance": "100%" }], 500);
    // But since that doesn't work, we re-trigger the animation by removing and adding the node:
    replace_with_clone(a.g);
    a.pos = p;
}

function mousedown_begin_map_move(e) {
    if (!is_left_button(e)) return;
    avatar_jump_to(app.myAvatar, event_to_world_coords(e));
    enter_state("map_move");
    set_lastMousePos(e);
}

function wheel_zoom(e) {
    e.preventDefault();
    const zoomChange = Math.exp(e.deltaY * -0.001);
    const rect = I("mapport").getBoundingClientRect();
    const xInPort = e.clientX - rect.left;
    const yInPort = e.clientY - rect.top;
    app.myAvatar.view.x = xInPort - (xInPort - app.myAvatar.view.x) * zoomChange;
    app.myAvatar.view.y = yInPort - (yInPort - app.myAvatar.view.y) * zoomChange;
    app.myAvatar.view.scale *= zoomChange;
    set_transform();
}

function mousemove_map_move(e) {
    e.preventDefault();
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    app.myAvatar.view.x += dx;
    app.myAvatar.view.y += dy;
    set_lastMousePos(e)
    set_transform();
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

function back_to_default_state() {
    for (const toolBtn of I("Tools").children) {
        toolBtn.classList.remove("ActiveTool");
    }
    selectedElement = null;
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
    return svg("path", {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} ${tip.x} ${tip.y} ${p1.x} ${p1.y}`});
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
    return svg("rect", {x: x, y: y, width: w, height: h});
}

function create_shape(name, originPoint, secondPoint) {
    return {
        triangle: equilateral_triangle,
        rectangle: rectangle
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
    mouseDownPos = event_to_world_coords(e);
    avatar_jump_to(app.myAvatar, mouseDownPos);
    enter_state("adjust_shape");
    set_lastMousePos(e);
}

// without jump animation
function place_avatar(p) {
    app.myAvatar.g.style.removeProperty("offset-path");
    app.myAvatar.g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    app.myAvatar.pos = p;
}

function handleRadius() {
    return 20 / app.myAvatar.view.scale;
}

function mousemove_adjust_shape(e) {
    const p = event_to_world_coords(e);
    if (selectedElement) {
        I("EditableElements").removeChild(selectedElement);
        selectedElement = null;
    }
    const l = p.distanceTo(mouseDownPos) - Avatar.radius - handleRadius();
    if (l > 0) {
        const p2 = mouseDownPos.add(Point.polar(l, p.sub(mouseDownPos).angle()))
        selectedElement = create_shape(currentShape, mouseDownPos, p2);
        I("EditableElements").appendChild(selectedElement);
    }
    place_avatar(p);
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
    // coordinates are relative to app.myAvatar.pos because it will be put inside app.myAvatar.g
    const t = isosceles_triangle(Point.zero(), Avatar.radius * 1.6,
                                 mouseDownPosWithinAvatar.angle(), Avatar.radius * 1.9);
    t.setAttribute("fill", app.myAvatar.color);
    t.setAttribute("id", "avatar-pointer");
    I("avatar-clickable").parentNode.insertBefore(t, I("avatar-clickable"));
    enter_state("point_at");
    e.stopImmediatePropagation(); // don't let mapport start a map_move
}

function mousemove_point_at(e) {
    const p = event_to_world_coords(e);
    place_avatar(p.sub(mouseDownPosWithinAvatar));
    set_lastMousePos(e);
}

function mouseup_point_at(e) {
    if (!is_left_button(e)) return;
    I("avatar-pointer").remove();
    back_to_default_state(e);
    // TODO jump_to is too distracting, but maybe go back linearly?
    // Also note that jump_to replaces app.myAvatar.g by a clone, which removes its event listeners
    // jump_to(mouseDownPos);
}

function enter_state(name) {
    switch (name) {
    case "default":
        I("mapport").onmousedown = mousedown_begin_map_move;
        I("mapport").onmousemove = undefined;
        I("mapport").onmouseup = undefined;
        I("mapport").onwheel = wheel_zoom;
        I("avatar-clickable").onmousedown = mousedown_begin_point_at;
        set_tool_onclick(click_start_shape);
        set_cursor("default");
        break;
    case "map_move":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_map_move;
        I("mapport").onmouseup = back_to_default_state;
        I("mapport").onwheel = undefined;
        I("avatar-clickable").onmousedown = undefined;
        set_tool_onclick(undefined);
        set_cursor("none");
        break;
    case "place_shape":
        I("mapport").onmousedown = mousedown_place_shape_here;
        I("mapport").onmousemove = undefined;
        I("mapport").onmouseup = undefined;
        I("mapport").onwheel = wheel_zoom;
        I("avatar-clickable").onmousedown = undefined;
        set_tool_onclick(back_to_default_state);
        set_cursor("crosshair");
        break;
    case "adjust_shape":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_adjust_shape;
        I("mapport").onmouseup = back_to_default_state;
        I("mapport").onwheel = undefined;
        I("avatar-clickable").onmousedown = undefined;
        set_tool_onclick(undefined);
        set_cursor("none");
        break;
    case "point_at":
        I("mapport").onmousedown = undefined;
        I("mapport").onmousemove = mousemove_point_at;
        I("mapport").onmouseup = mouseup_point_at;
        I("mapport").onwheel = undefined;
        I("avatar-clickable").onmousedown = undefined;
        set_tool_onclick(undefined);
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

function fatal(msg) {
    const d = document.createElement("div");
    d.classList.add("bsod");
    d.innerHTML = `<p>Error: ${msg}</p>`;
    document.body.appendChild(d); // append rather than replace so that we can still inspect the DOM
    throw msg;
}

var app = null;

function init() {
    const urlParams = new URLSearchParams(window.location.search);

    const mode = urlParams.get("mode");
    const worldJsonUrl = urlParams.get("worldJsonUrl");

    replace_node(initial_svg(), I("mainsvg"));

    switch (mode) {
    case "server":
        const peerId = urlParams.get("peerId");
        if (!peerId) fatal("No peerId");
        if (!worldJsonUrl) fatal("No worldJsonUrl");
        app = new Server(peerId, worldJsonUrl);
        break;
    case "client":
        const serverId = urlParams.get("serverId");
        if (!serverId) fatal("No serverId");
        app = new Client(serverId);
        break;
    case "solo":
        if (!worldJsonUrl) fatal("No worldJsonUrl");
        app = new Solo(worldJsonUrl);
        break;
    default:
        fatal(`unknown mode ${mode}`);
    }

    const avatar_update = {
        action: "upd",
        hue: urlParams.get("avatarHue"),
        emojiUtf: urlParams.get("avatarEmoji")
    };
    if (mode !== "client") {
        avatar_update.id = "avatar0";
        // TODO else make sure client sets it as well
        // or change protocol so that it sends it without id to server to say hi
    }
    app.init(avatar_update);
}
