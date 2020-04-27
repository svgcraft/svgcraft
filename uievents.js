"use strict";

class Tool {
    constructor() {}
    pointerdown(e) {
        app.post({
            action: "upd",
            id: app.avatarId,
            pos: event_to_world_coords(e),
            animate: 'jump'
        });
    }
    first_drag(e) {
        throw "should be implemented by subclass";
    }
    continue_drag(e) {
        throw "should be implemented by subclass";
    }
    end_drag(e) {
        throw "should be implemented by subclass";
    }
}

class NavigationTool extends Tool {
    constructor() {
        super();
        // e.clientX/Y of last mouse event
        this.last_clientX = null;
        this.last_clientY = null;
    }
    pointerdown(e) {
        super.pointerdown(e);
        this.last_clientX = e.clientX;
        this.last_clientY = e.clientY;
    }
    first_drag(e) {
        this.move_impl(e);
    }
    continue_drag(e) {
        this.move_impl(e);
    }
    end_drag(e) {}
    move_impl(e) {
        const dx = e.clientX - this.last_clientX;
        const dy = e.clientY - this.last_clientY;
        this.last_clientX = e.clientX;
        this.last_clientY = e.clientY;
        app.post({
            action: "upd",
            id: app.avatarId,
            view: {x: app.myAvatar.view.x + dx, y: app.myAvatar.view.y + dy}
        }, true);
    }
}

class PointingTool extends Tool {
    constructor() {
        super();
        this.avatarPosBeforeLastJump = null;
    }
    pointerdown(e) {
        this.avatarPosBeforeLastJump = app.myAvatar.pos;
        app.post({
            action: "upd",
            id: app.avatarId,
            pos: event_to_world_coords(e),
            animate: 'line'
        });
    }
    first_drag(e) {
        app.post({
            action: "upd",
            id: app.avatarId,
            pos: event_to_world_coords(e),
            pointer: event_to_world_coords(e).sub(this.avatarPosBeforeLastJump).angle() / Math.PI * 180
        });
    }
    continue_drag(e) {
        app.post({
            action: "upd",
            id: app.avatarId,
            pos: event_to_world_coords(e),
        });
    }
    end_drag(e) {
        app.post({
            action: "upd",
            id: app.avatarId,
            pointer: "none"
        });
    }
}

class ShapeTool extends Tool {
    constructor() {
        super();
        // world coordinates of the last pointerdown event
        this.pointerDownPos = null;
    }
    pointerdown(e) {
        this.pointerDownPos = event_to_world_coords(e);
        super.pointerdown(e);
    }
    first_drag(e) {
        const p = event_to_world_coords(e);
        if (selectedElemId) {
            app.post({
                action: "deselect",
                who: app.avatarId,
                what: [selectedElemId]
            });
            selectedElemId = null;
        }
        this.move_avatar_to_shape_corner(p);
        const s = create_shape(activeTool, this.pointerDownPos, p);
        s.action = 'new';
        if (activeTool === 'rectangle') {
            s.tag = 'rect';
        } else {
            s.tag = 'path';
        }
        s.id = app.gen_elem_id(s.tag);
        // s.stroke = I("pick-stroke-color").style.backgroundColor;
        s.fill = I("pick-fill-color").style.backgroundColor;
        app.post(s);
        selectedElemId = s.id;
        app.post({
            action: "select",
            who: app.avatarId,
            what: [selectedElemId]
        });
    }
    continue_drag(e) {
        const p = event_to_world_coords(e);
        this.move_avatar_to_shape_corner(p);
        const s = create_shape(activeTool, this.pointerDownPos, p);
        s.action = 'upd';
        s.id = selectedElemId;
        app.post(s);
    }
    end_drag(e) {
        app.post({
            action: "upd",
            id: app.avatarId,
            pointer: "none"
        });
    }
    // "private"
    move_avatar_to_shape_corner(p) {
        const d = p.distanceTo(this.pointerDownPos) + Avatar.pointerRadius;
        const alpha = p.sub(this.pointerDownPos).angle();
        app.post({
            action: "upd",
            id: app.avatarId,
            pos: this.pointerDownPos.add(Point.polar(d, alpha)),
            pointer: alpha / Math.PI * 180 + 180
        });
    }
}

// possible values: any member name of the tools object above
var activeTool = "navigation";

var selectedElemId = null;

// We use the term "pointer" to refer to the mouse pointer on desktop, and the finger on mobile/tablets
class PointerEvents {
    constructor() {
        // This variable behaves like the following state machine:
        //
        //           v
        //       +-> UP ----pointerdown----+
        //       |    ^                    |
        //       |    |                    v
        //       |    +-----pointerup---- DOWN
        //       |                         |
        //       |                         |
        //     DRAGGING <---pointermove----+
        //    ^        \
        //   /          \
        //  +-pointermove+
        //
        this.pointerState = "UP";
        this.tools = {
            navigation: new NavigationTool(),
            pointing: new PointingTool(),
            rectangle: new ShapeTool(),
            triangle: new ShapeTool(),
            square: new ShapeTool()
        };
        this._draggee = null; // can be null, "handle" or "tool"
        this.onadjustcorner = null;
    }
    get draggee() {
        return this._draggee;
    }
    set draggee(v) {
        log.debug("draggee:", v);
        this._draggee = v;
    }
    pointerdown_on_map(e) {
        this.tools[activeTool].pointerdown(e);
        this.draggee = "tool";
        this.pointerdown_common(e);
    }
    // elem: DOM SVG element being edited
    // cornerPos: original world coordinates of the corner being edited
    // geomUpdater: function which takes a Point with the new corner coordinates
    //              and returns a JSON action to update elem
    pointerdown_on_corner_handle(elem, cornerPos, geomUpdater) {
        return (e) => {
            const p = event_to_world_coords(e);
            const mouseDownPosWithinHandle = p.sub(cornerPos);
            const alpha = mouseDownPosWithinHandle.angle();
            const avatarOffset = Point.polar(Avatar.pointerRadius, alpha);
            app.post({
                action: "upd",
                id: app.avatarId,
                pos: p.add(avatarOffset),
                animate: 'jump'
            });
            this.onadjustcorner = (e) => {
                const p = event_to_world_coords(e);
                app.post([{
                    action: "upd",
                    id: app.avatarId,
                    pos: p.add(avatarOffset),
                    pointer: alpha / Math.PI * 180 + 180
                }, geomUpdater(p.sub(mouseDownPosWithinHandle))]);
            };
            this.draggee = "handle";
            this.pointerdown_common(e);
            e.stopPropagation();
        };
    }
    pointerdown_common(e) {
        this.pointerState = "DOWN";
        set_corner_handle_cursor("none");
        set_cursor("none");
    }
    pointermove(e) {
        if (this.pointerState === "UP") return; // mousedown happened somewhere else
        switch (this.draggee) {
        case "tool":
            switch (this.pointerState) {
            case "DOWN":
                this.tools[activeTool].first_drag(e);
                this.pointerState = "DRAGGING";
                break;
            case "DRAGGING":
                this.tools[activeTool].continue_drag(e);
                break;
            }
            break;
        case "handle":
            this.onadjustcorner(e);
            break;
        }
    }
    pointerup(e) {
        if (this.pointerState === "UP") return; // mousedown happened somewhere else
        switch (this.draggee) {
        case "tool":
            this.tools[activeTool].end_drag(e);
            break;
        case "handle":
            app.post({
                action: "upd",
                id: app.avatarId,
                pointer: "none"
            });
            this.onadjustcorner = null;
            break;
        }
        this.pointerState = "UP";
        set_cursor_for_active_tool();
        set_corner_handle_cursor("move");
    }
}

function set_corner_handle_cursor(name) {
    const l = I("mainsvg").classList;
    for (const c of l) {
        if (c.startsWith("set_corner_handle_cursors_to_")) {
            l.remove(c);
        }
    }
    l.add("set_corner_handle_cursors_to_" + name);
}

function wheel_zoom(e) {
    e.preventDefault();
    const zoomChange = Math.exp(e.deltaY * -0.001);
    const rect = I("mapport").getBoundingClientRect();
    const xInPort = e.clientX - rect.left;
    const yInPort = e.clientY - rect.top;
    app.post({
        action: "upd",
        id: app.avatarId,
        view: {
            x: xInPort - (xInPort - app.myAvatar.view.x) * zoomChange,
            y: yInPort - (yInPort - app.myAvatar.view.y) * zoomChange,
            scale: app.myAvatar.view.scale * zoomChange
        }
    }, true);
}

function set_cursor_for_active_tool() {
    switch (activeTool) {
    case "navigation":
        set_cursor("grab");
        break;
    case "pointing":
        set_cursor("default");
        break;
    case "square":
    case "rectangle":
    case "triangle":
        set_cursor("crosshair");
        break;
    default:
        throw 'unknown tool'
    }
}

function toolbutton_click(e) {
    for (const toolBtn of I("Tools").children) {
        toolBtn.classList.remove("ActiveTool");
    }
    const id = e.currentTarget.id;
    if (!id.endsWith("-tool")) throw 'unexpected tool id';
    activeTool = id.substr(0, id.length-5);
    e.currentTarget.classList.add("ActiveTool");
    set_cursor_for_active_tool();
}

function shape_contextmenu(e) {
    const elem = e.target;
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

function background_contextmenu(e) {
    if (selectedElemId) {
        app.post({
            action: "deselect",
            who: app.avatarId,
            what: [selectedElemId]
        });
        selectedElemId = null;
    }
    const c = I("BackgroundRect").getAttribute("fill");
    if (!c.startsWith('url')) I("pick-fill-color").style.backgroundColor = c;
}

const MOUSEBUTTONS_LEFT = 1;

var pointerEventsHandler = new PointerEvents();

function mousedown_corner_handle(elem, cornerPos, geomUpdater) {
    return pointerEventsHandler.pointerdown_on_corner_handle(elem, cornerPos, geomUpdater);
}

function init_uievents() {
    I("mapport").onpointerdown = (e) => {
        if (e.buttons !== MOUSEBUTTONS_LEFT) return;
        pointerEventsHandler.pointerdown_on_map(e);
    };
    window.addEventListener('pointermove', (e) => {
        if (e.buttons !== MOUSEBUTTONS_LEFT) return;
        pointerEventsHandler.pointermove(e);
    });
    // TODO what if multiple mouse buttons are pressed?
    window.addEventListener('pointerup', (e) => {
        pointerEventsHandler.pointerup(e);
    });
    // never show the browser's context menu (also prevents the browser context menu on long taps)
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    I("mapport").onwheel = wheel_zoom;
    I("BackgroundRect").oncontextmenu = background_contextmenu;
    window.addEventListener('resize', expand_background);
    set_cursor_for_active_tool();
    set_corner_handle_cursor("move");
}
