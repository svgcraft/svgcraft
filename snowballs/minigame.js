"use strict";

class MiniGame {
    constructor(pos, gameState) {
        this.pos = pos;
        this.gameState = gameState;
        this.id = gameState.freshId();
    }
    init() {
        throw "has to be implemented by subclass";
    }
}