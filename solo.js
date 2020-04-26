"use strict";

class Solo extends App {

    constructor(worldJsonUrl) {
        super();
        this.worldJsonUrl = worldJsonUrl;
        this.avatarId = "avatar0";
    }

    init() {
        fetch(this.worldJsonUrl)
            .then(res => res.json())
            .then((j) => this.init_with_json(j));
    }

    init_with_json(j) {
        j.unshift({action: "new", tag: "avatar", id: "avatar0"});
        this.history = j;
        process_json_actions(j);
        this.finish_init();
    }

    publish(actions) {
        // NOP
    }
}
