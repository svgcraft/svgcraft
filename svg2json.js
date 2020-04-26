"use strict";

function shallow_dom2json(dom) {
    const j = {
        action: "new",
        tag: dom.tagName
    };
    for (const attr of dom.attributes) {
        j[attr.name] = attr.value;
    }
    return j;
}

function svg2json(dom) {
    const res = [];
    res.push({action: "new", tag: "avatar", id: "avatar0", pos: {x: 100, y: 100}});
    const b = dom.documentElement.getAttribute('viewBox');
    if (b) {
        const [x, y, w, h] = b.split(' ').map(v => parseFloat(v));
        res.push({
            action: "upd",
            id: "avatar0",
            viewBox: {x: x, y: y, width: w, height: h},
            pos: {x: x+100, y: y+100}
        });
    }
    for (const pat of dom.getElementsByTagName('pattern')) {
        res.push(shallow_dom2json(pat));
        for (const e of pat.children) {
            const j = shallow_dom2json(e);
            j.parent = pat.id;
            res.push(j);
        }
    }
    const bg = dom.getElementById("BackgroundRect");
    if (bg) {
        res.push({action: "upd", id: "BackgroundRect", fill: bg.getAttribute("fill")});
    } else {
        log.parsing('No #BackgroundRect found!');
    }
    const elems = dom.getElementById("EditableElements");
    if (elems) {
        for (const e of elems.children) {
            res.push(shallow_dom2json(e));
        }
    } else {
        log.parsing('No #EditableElements found!');
    }
    window.tmp = dom;
    return res;
}
