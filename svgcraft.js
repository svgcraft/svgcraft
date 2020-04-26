"use strict";

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

function equilateral_triangle_from_center(center, corner) {
    const r = corner.sub(center);
    const p1 = corner;
    const p2 = center.add(r.rotate(Math.PI*2/3));
    const p3 = center.add(r.rotate(-Math.PI*2/3));
    return svg("path", {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} z`});
}

function equilateral_triangle(mid, tip) {
    const h = tip.sub(mid);
    const l = h.norm() / Math.sqrt(3.0);
    const p1 = mid.add(Point.polar(l, h.angle() + Math.PI/2));
    const p2 = mid.add(Point.polar(l, h.angle() - Math.PI/2));
    return {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${tip.x} ${tip.y} z`};
}

function isosceles_triangle(baseMid, baseLength, rotation, height) {
    const tip = baseMid.add(Point.polar(height, rotation));
    const p1 = baseMid.add(Point.polar(baseLength/2, rotation + Math.PI/2));
    const p2 = baseMid.add(Point.polar(baseLength/2, rotation - Math.PI/2));
    return svg("path", {d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${tip.x} ${tip.y} z`});
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

function fatal(msg) {
    const d = document.createElement("div");
    d.classList.add("bsod");
    d.innerHTML = `<p>Error: ${msg}</p>`;
    document.body.appendChild(d); // append rather than replace so that we can still inspect the DOM
    throw msg;
}

var app = null;
var pending_avatar_update = null;

var clickedColorButtonId = null;

function close_color_dialog(e) {
    I("color_picker").style.display = 'none';
}

function rgbStr_to_rgbArr(s, fallback) {
    if (s.startsWith("rgb(")) {
        const a = s.split(/rgb\(|, |\)/);
        return [a[1], a[2], a[3]];
    } else {
        return fallback;
    }
}

function is_selected_by_others(eId) {
    for (const g of I("OtherHandles").children) {
        const idparts = g.getAttribute("id").split("__");
        if (idparts[1] !== "select") throw "unexpected id format";
        if (idparts[0] === eId) return true;
    }
    return false;
}

function delete_selectedElem() {
    if (selectedElemId) {
        if (is_selected_by_others(selectedElemId)) {
            // This is simpler and friendlier than having to force other users do deselect
            alert("Someone else might be editing this element, please ask everyone to deselect it before deleting it");
        } else {
            app.post([
                {action: "deselect", who: app.avatarId, what: [selectedElemId]},
                {action: "del", id: selectedElemId}
            ]);
            selectedElemId = null;
        }
    } else {
        alert("To delete an element, please first right-click it to select it!");
    }
}

function init_color_picker() {
    const p = color_picker.create();
    p.oncolorchange = (colorstr) => {
        I("pick-fill-color").style.backgroundColor = colorstr;
    }
    I("color_picker_inner").appendChild(p);
    I("close-color-picker").onclick = close_color_dialog;
    // I("pick-stroke-color").onclick = open_color_dialog;
    I("pick-fill-color").onclick = (e) => {
        clickedColorButtonId = e.target.getAttribute("id");
        I("color_picker").style.display = 'block';
        const a = rgbStr_to_rgbArr(I("pick-fill-color").style.backgroundColor, [255, 255, 0]);
        p.set_hsl(...rgbToHsl(...a));
    }
}

function init_pointing_tool_icon() {
    const s = I("pointing-tool-svg");
    const c = s.children[0];
    const x = parseFloat(c.getAttribute("cx"));
    const y = parseFloat(c.getAttribute("cy"));
    const r = parseFloat(c.getAttribute("r"));
    const f = r / Avatar.radius;
    const angle = - Math.PI / 4;
    const t = isosceles_triangle(new Point(x, y), Avatar.pointerBaseWidth * f, angle, Avatar.pointerRadius * f);
    t.setAttribute("fill", c.getAttribute("fill"));
    s.appendChild(t);
}

function init() {
    if (peerjs.util.browser !== 'chrome') {
        fatal(`Only Chrome is supported!`);
    }

    for (const toolBtn of I("Tools").children) toolBtn.onclick = toolbutton_click;
    init_pointing_tool_icon();
    init_color_picker();
    init_avatar_picker();
    I("color_picker").style.display = 'none';
    // I("pick-stroke-color").style.backgroundColor = 'black';
    I("pick-fill-color").style.backgroundColor = "rgb(104, 212, 19)"; //`rgb(0, 182, 111)`;
    I("delete-button").onclick = delete_selectedElem;
    I("save-button").onclick = savesvg;

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
