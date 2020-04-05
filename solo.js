"use strict";

class Solo extends App {

    constructor(worldJsonUrl) {
        super();
        this.worldJsonUrl = worldJsonUrl;
        fetch(this.worldJsonUrl)
            .then(res => res.json())
            .then((j) => this.init_with_json(j));
    }

    init_with_json(j) {
        this.history = j;
        process_json_actions(j);
    }
}
