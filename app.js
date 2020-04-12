"use strict";

class App {
    constructor() {
        // ever growing list of JSON actions
        this.history = [];

        // must be set by subclasses
        this.avatarId = null;

        this.avatars = {};
    }

    new_avatar0_command() {
        for (const c of this.history) {
            if (c.action === "new" && c.id === "avatar0") return c;
        }
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
        enter_state("default");
    }

    get myAvatar() {
        return this.avatars[this.avatarId];
    }

    // actions is a list of JSON actions, or one single action
    post(actions) {
        if (!Array.isArray(actions)) actions = [actions];
        process_json_actions(actions);
        this.history.push(...actions);
        this.publish(actions);
    }

    // actions is a list of JSON actions
    publish(actions) {
        throw "should be implemented by subclass";
    }
}
