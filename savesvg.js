"use strict";

function current_viewBox() {
    const x = -app.myAvatar.view.x / app.myAvatar.view.scale;
    const y = -app.myAvatar.view.y / app.myAvatar.view.scale;
    const w = (I("mapport").clientWidth - app.myAvatar.view.x) / app.myAvatar.view.scale - x;
    const h = (I("mapport").clientHeight - app.myAvatar.view.y) / app.myAvatar.view.scale - y;
    return [x, y, w, h].map(a => Math.round(a)).join(' ');
}

function attributes_str(elem) {
    const res = [];
    for (const a of elem.attributes) {
        res.push(`${a.name}="${a.value}"`);
    }
    return res.join(' ');
}

// formatting: each leaf element gets its own line
function dom_to_str(indent, elem) {
    var res = `${indent}<${elem.tagName} ${attributes_str(elem)}>`;
    for (const c of elem.children) {
        res += "\n";
        res += dom_to_str(indent + "  ", c);
    }
    if (elem.children.length > 0) res += "\n" + indent;
    res += `</${elem.tagName}>`;
    return res;
}

// We don't use new XMLSerializer().serializeToString(completeDom) because we want to control
// the newlines ourselves: One line per element, to make the produced svg files git diff friendly
function saveable_svg_str() {
    var res = `<svg xmlns="http://www.w3.org/2000/svg" width="${I("mapport").clientWidth}" height="${I("mapport").clientHeight}" viewBox="${current_viewBox()}">\n`;
    res += dom_to_str("  ", I("Defs")) + "\n";
    res += dom_to_str("  ", I("BackgroundRect")) + "\n";
    res += dom_to_str("  ", I("EditableElements")) + "\n";
    res += "</svg>\n";
    return res;
}

function savesvg() {
    const a = document.createElement('a');
    a.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(saveable_svg_str()));
    a.setAttribute('download', document.title + '.svg');
    a.click();
}
