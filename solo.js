"use strict";

class Solo extends App {

    constructor(worldUrl) {
        super();
        this.worldUrl = worldUrl;
        this.avatarId = "avatar0";
    }

    init() {
        this.init_from_worldUrl();
    }

    init_with_json(j) {
        this.history = j;
        process_json_actions(j);
        this.finish_init();
    }

    publish(actions) {
        // NOP
    }
}
