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
        const urlParams = new URLSearchParams(window.location.search);
        const avatar_update = {
            action: "upd",
            id: this.avatarId,
            hue: urlParams.get("avatarHue"),
            emojiUtf: urlParams.get("avatarEmoji")
        };
        this.post([avatar_update]);
        app.myAvatar.g.children[0].setAttribute("id", "avatar-clickable"); // for pointer
        set_transform();
        enter_state("default");
    }

    get myAvatar() {
        return this.avatars[this.avatarId];
    }

    // actions is a list of JSON actions
    post(actions) {
        process_json_actions(actions);
        this.history.push(...actions);
        this.publish(actions);
    }

    // actions is a list of JSON actions
    publish(actions) {
        throw "should be implemented by subclass";
    }
}
