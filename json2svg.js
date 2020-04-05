"use strict";

const style_attrs = ["stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "fill", "fill-opacity"];

const tag_types = {
    circle: ["id", "cx", "cy", "r"].concat(style_attrs),
    ellipse: ["id", "cx", "cy", "rx", "ry"].concat(style_attrs),
    path:  ["id", "d"].concat(style_attrs),
    rect: ["id", "x", "y", "width", "height"].concat(style_attrs),
    pattern: ["id", "x", "y", "width", "height"].concat(style_attrs)
}

const initialView = {x: 0, y: 0, scale: 1.0}

function process_json_action(j) {
    if (!j.action) throw "action missing";
    switch (j.action) {
    case "set":
        for (const key in j) {
            switch (key) {
            case "title": document.title = j[key]; break;
            case "initial_view_x": initialView.x = j[key]; break;
            case "initial_view_y": initialView.y = j[key]; break;
            case "initial_view_scale": initialView.scale = j[key]; break;
            case "background_fill": I("BackgroundRect").setAttribute("fill", j[key]); break;
            case "action": break;
            default: throw `unkown key ${key}`;
            }
        }
        break;
    case "new":
        if (!j.tag) throw "tag missing";
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
        }
        parent.appendChild(elem);
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
