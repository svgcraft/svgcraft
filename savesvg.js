function current_viewBox() {
    const x = -app.myAvatar.view.x / app.myAvatar.view.scale;
    const y = -app.myAvatar.view.y / app.myAvatar.view.scale;
    const w = (I("mapport").clientWidth - app.myAvatar.view.x) / app.myAvatar.view.scale - x;
    const h = (I("mapport").clientHeight - app.myAvatar.view.y) / app.myAvatar.view.scale - y;
    return [x, y, w, h].join(' ');
}

function saveable_svg_dom() {
    return svg(
        "svg",
        {xmlns: "http://www.w3.org/2000/svg",
         width: I("mapport").clientWidth,
         height: I("mapport").clientHeight,
         viewBox: current_viewBox()},
        [I("Defs").cloneNode(true),
         I("BackgroundRect").cloneNode(true),
         I("EditableElements").cloneNode(true)]);
}

function savesvg() {
    const svgstr = new XMLSerializer().serializeToString(saveable_svg_dom());
    const a = document.createElement('a');
    a.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgstr));
    a.setAttribute('download', document.title + '.svg');
    a.click();
}
