"use strict";

class Solo extends App {

    constructor(worldJsonUrl) {
        super();
        this.worldJsonUrl = worldJsonUrl;
        this.avatarId = "avatar0";
    }

    init(avatar_update) {
        fetch(this.worldJsonUrl)
            .then(res => res.json())
            .then((j) => { j.push(avatar_update); this.init_with_json(j) });
    }

    init_with_json(j) {
        this.history = j;
        process_json_actions(j);
        this.finish_init();
    }
}
