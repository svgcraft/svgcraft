"use strict";

const style_attrs = ["stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "fill", "fill-opacity"];
const position_attrs = ["cx", "cy", "r", "rx", "ry", "d", "x", "y", "width", "height"];
const updatable_attrs = style_attrs.concat(position_attrs);

const tag_types = {
    circle: ["id", "cx", "cy", "r"].concat(style_attrs),
    ellipse: ["id", "cx", "cy", "rx", "ry"].concat(style_attrs),
    path:  ["id", "d"].concat(style_attrs),
    rect: ["id", "x", "y", "width", "height"].concat(style_attrs),
    pattern: ["id", "x", "y", "width", "height"].concat(style_attrs)
}

const initialView = {x: 0, y: 0, scale: 1.0}

function check_field(j, fieldName) {
    if (!j[fieldName]) throw `Field "${fieldName}" is missing`;
}

function check_fields(j, fieldNames) {
    for (name of fieldNames) check_field(j, name);
}

function transfer_attrs_to_dom(j, attrs, target) {
    for (const attr of attrs) {
        if (j[attr]) target.setAttribute(attr, j[attr]);
    }
}

function transfer_attrs_to_obj(j, attrs, target) {
    for (const attr of attrs) {
        if (j[attr]) target[attr] = j[attr];
    }
}

function add_emoji_to_avatar(a) {
    const img = svg("image", {x: -25, y: -25, height: 50, width: 50});
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', a.emojiUrl);
    img.setAttribute("pointer-events", "none"); // they should go to circle underneath
    a.g.appendChild(img);
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

// without jump animation
function avatar_place_at(a, p) {
    a.g.style.removeProperty("offset-path");
    a.g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    a.pos = p;
}

function new_avatar(j) {
    check_field(j, "id");
    if (app.avatars[j.id]) throw `${j.id} already exists`;
    const a = new Avatar(j.id);
    app.avatars[j.id] = a;
    const c = svg("circle", {cx: a.pos.x, cy: a.pos.y, r: Avatar.radius, fill: a.color});
    const g = svg("g", {"id": j.id, "class": "avatar"}, [c]);
    I("mainsvg").appendChild(g);
    add_emoji_to_avatar(a);
    upd_avatar(a, j);
}

function upd_avatar(a, j) {
    // TODO should validate values in j
    if (j.emojiUtf) {
        a.emojiUtf = j.emojiUtf;
        a.g.children[1].setAttributeNS('http://www.w3.org/1999/xlink', 'href', a.emojiUrl);
    }
    if (j.hue) {
        a.hue = j.hue;
        a.g.children[0].setAttribute("fill", a.color);
    }
    if (j.view) {
        transfer_attrs_to_obj(j.view, ["x", "y", "scale"], a.view);
        if (app.myAvatar && a.id === app.myAvatar.id) {
            set_transform();
        }
    }
    if (j.pos) {
        if (j.animate === 'jump') {
            avatar_jump_to(a, new Point(j.pos.x, j.pos.y));
        } else {
            avatar_place_at(a, new Point(j.pos.x, j.pos.y));
        }
    }
    if (j.pointer !== null && j.pointer !== undefined) {
        for (const p of a.g.getElementsByClassName("avatar-pointer")) p.remove();
        if (j.pointer !== 'none') {
            const angle = parseFloat(j.pointer);
            if (isNaN(angle)) throw `${angle} is not a number`;
            // coordinates are relative to a.pos because it will be put inside a.g
            const t = isosceles_triangle(Point.zero(), Avatar.pointerBaseWidth, angle, Avatar.pointerRadius);
            t.setAttribute("fill", a.color);
            t.setAttribute("class", "avatar-pointer");
            a.g.prepend(t);
        }
    }
}

function new_elem(j) {
    var parent = I("EditableElements");
    if (j.tag === "pattern") {
        if (j.parent && j.parent !== "Defs") throw "parent of pattern must be Defs or unspecified";
        parent = I("Defs");
    } else if (j.parent) {
        parent = I(j.parent);
        if (!parent) throw `parent ${j.parent} not found`;
    }
    if (!tag_types[j.tag]) throw `unknown tag ${j.tag}`;
    const elem = svg(j.tag, j, [], tag_types[j.tag]);
    if (j.tag === "pattern") {
        elem.setAttribute("patternUnits", "userSpaceOnUse");
    } else {
        elem.oncontextmenu = shape_contextmenu;
    }
    parent.appendChild(elem);
}

function handles_g_id(elem, avatarId) {
    return elem.getAttribute('id') + '__select__' + avatarId;
}

function handle_radius() {
    if (app.myAvatar) {
        return 20.0 / app.myAvatar.view.scale;
    } else {
        return 20.0;
    }
}

function corner_handle(x, y, color) {
    color = 'none'; // <-- TODO remove this line once modifying corners is supported
    return svg("circle", {cx: x, cy: y, r: handle_radius(),
                          stroke: color, "stroke-width": 1, fill: "none"});
}

function select_elem(who, elem) {
    const g = svg("g", {id: handles_g_id(elem, who)});
    switch (elem.tagName) {
    case "rect":
        const x = parseFloat(elem.getAttribute("x"));
        const y = parseFloat(elem.getAttribute("y"));
        const w = parseFloat(elem.getAttribute("width"));
        const h = parseFloat(elem.getAttribute("height"));
        const corners = [{x: x, y: y}, {x: x+w, y: y}, {x: x+w, y: y+h}, {x: x, y: y+h}];
        for (const c of corners) {
            g.appendChild(corner_handle(c.x, c.y, app.avatars[who].color));
        }
        break;
    case "path":
        const ps = elem.getAttribute("d").split(' ');
        for (var i = 1; i < ps.length; i += 3) { // TODO this only works for M and L
            const x = ps[i];
            const y = ps[i+1];
            g.appendChild(corner_handle(x, y, app.avatars[who].color));
        }
        break;
    default:
        console.log("don't know how to select", elem.tagName);
        break;
    }
    I(app.avatarId === who ? "OwnHandles" : "OtherHandles").appendChild(g);
}

function deselect_elem(who, elem) {
    I(handles_g_id(elem, who)).remove();
}

function update_select_handles(elem) {
    for (const aId in app.avatars) {
        if (I(handles_g_id(elem, aId))) {
            deselect_elem(aId, elem);
            select_elem(aId, elem);
        }
    }
}

function process_json_action(j) {
    // console.log("processing", j);
    check_field(j, "action");
    switch (j.action) {
    case "upd":
        check_field(j, "id");
        switch (j.id) {
        case "document":
            check_field(j, "title");
            document.title = j.title;
            break;
        case "BackgroundRect":
            check_field(j, "fill");
            I("BackgroundRect").setAttribute("fill", j.fill);
            break;
        default:
            if (app.avatars[j.id]) {
                upd_avatar(app.avatars[j.id], j);
            } else {
                // This allows peers to update any parts of our DOM, even outside the SVG!
                // TODO make a bit safer by having two namespaces for ids
                const elem = I(j.id);
                if (!elem) throw `No element with id ${j.id}`;
                transfer_attrs_to_dom(j, updatable_attrs, elem);
                update_select_handles(elem);
            }
            break;
        }
        break;
    case "new":
        check_field(j, "tag");
        if (j.tag === "avatar") {
            new_avatar(j);
        } else {
            new_elem(j);
        }
        break;
    case "del":
        check_field(j, "id");
        if (app.avatars[j.id]) {
            I(j.id).remove();
            delete app.avatars[j.id];
        } else {
            throw `Deleting ${j.id} not supported (yet)`;
        }
        break;
    case "your_id":
        // indicates that all initial history has been sent, and avatars have been set up
        check_field(j, "id");
        app.avatarId = j.id;
        app.finish_init(); // only needed in client
        break;
    case "select":
        check_field(j, "who");
        check_field(j, "what");
        for (const eId of j.what) {
            const elem = I(eId);
            if (!elem) throw `No element with id ${eId}`;
            select_elem(j.who, elem);
        }
        break;
    case "deselect":
        check_field(j, "who");
        check_field(j, "what");
        for (const eId of j.what) {
            const elem = I(eId);
            if (!elem) throw `No element with id ${eId}`;
            deselect_elem(j.who, elem);
        }
        break;
    default:
        throw `unknown action ${j.action}`;
    }
}

function process_json_actions(j) {
    if (!Array.isArray(j)) throw "expected a list";
    for (const a of j) {
        process_json_action(a);
    }
}

function initial_svg() {
    const res = svg("svg", {id: "mainsvg"});
    res.appendChild(svg("defs", {id: "Defs"}));
    res.appendChild(svg("rect", {id: "BackgroundRect"}));
    res.appendChild(svg("g", {id: "EditableElements"}));
    // markers on selected elements: First draw everyone else's, then draw our own on top
    res.appendChild(svg("g", {id: "OtherHandles"}));
    res.appendChild(svg("g", {id: "OwnHandles"}));
    return res;
}

function svg(tag, attrs, children, allowedAttrs) {
    const res = document.createElementNS("http://www.w3.org/2000/svg", tag);
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
