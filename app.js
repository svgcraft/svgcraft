"use strict";

class App {
    constructor() {
        // ever growing list of JSON actions
        this.history = [];

        // must be set by subclasses
        this.avatarId = null;

        this.avatars = {};
    }

    // avatar_update is a JSON upd command customizing hue and emoji.
    // init should not be called by constructor.
    // All async operations should be spawned in init, not in constructor.
    init (avatar_update) {
        throw "should be implemented by subclass";
    }

    // called by subclasses once all the async operations have set up everything
    finish_init() {
        enter_state("default");
    }

    get myAvatar() {
        return this.avatars[this.avatarId];
    }

    // actions is a list of JSON actions
    post(actions) {
        throw "should be implemented by subclass";
    }
}
