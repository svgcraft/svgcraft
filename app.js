"use strict";

// drops folder path and file extension
function path2filename(p) {
    return p.substring(p.lastIndexOf('/')+1, p.lastIndexOf('.'));
}

class App {
    constructor() {
        // ever growing list of JSON actions
        this.history = [];

        // must be set by subclasses
        this.avatarId = null;

        this.avatars = {};

        this.nextFreshElemId = 0;

        // initialized when the first json action containing this data is processed
        this.initialView = null; // x, y, scale
        this.initialPos = null; // x, y
    }

    init_from_worldUrl() {
        if (this.worldUrl.endsWith('.json')) {
            fetch(this.worldUrl)
                .then(res => res.json())
                .then((j) => this.init_with_json(j));
        } else if (this.worldUrl.endsWith('.svg')) {
            const title = path2filename(this.worldUrl);
            fetch(this.worldUrl)
                .then(res => res.text())
                .then(s => this.init_with_xml_str(s, title));
        } else {
            throw 'unknown file extension';
        }
    }

    init_with_xml_str(s, title) {
        const dom = (new DOMParser()).parseFromString(s, "text/xml");
        const j = svg2json(dom);
        j.push({action: "upd", "id": "document", "title": title});
        this.init_with_json(j);
    }

    gen_elem_id(tag) {
        // note: in previous editing sessions, some ids might already have been taken!
        var cand;
        do {
            cand = `${this.avatarId}_${tag}${this.nextFreshElemId++}`;
        } while (I(cand));
        return cand;
    }

    // init should not be called by constructor.
    // All async operations should be spawned in init, not in constructor.
    init () {
        throw "should be implemented by subclass";
    }

    // called by subclasses once all the async operations have set up everything
    finish_init() {
        if (pending_avatar_update) {
            pending_avatar_update.id = this.avatarId;
            this.post(pending_avatar_update);
        }
        pending_avatar_update = null;
        app.myAvatar.g.children[0].setAttribute("id", "avatar-clickable"); // for pointer
        set_transform();
        init_uievents();
    }

    get myAvatar() {
        return this.avatars[this.avatarId];
    }

    // actions is a list of JSON actions, or one single action
    post(actions, keepPrivate) {
        if (!Array.isArray(actions)) actions = [actions];
        process_json_actions(actions);
        if (!keepPrivate) {
            this.history.push(...actions);
            this.publish(actions);
        }
    }

    // actions is a list of JSON actions
    publish(actions) {
        throw "should be implemented by subclass";
    }
}
