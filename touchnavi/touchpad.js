"use strict";

let conn = null;

function initConnection (serverId) {
    const peer = new Peer(null, {debug: 2});

    peer.on('open', (id) => {
        log.connection("PeerJS server gave us ID " + id);

        conn = peer.connect(serverId, {
            reliable: true
        });

        conn.on('open', () => {
            log.connection("Connected to " + conn.peer);
        });

        conn.on('data', (data) => {
            log.data(`Data received from game server`);
            log.data(data);
        });

        conn.on('close', () => {
            log.connection("Connection to game server closed");
        });
    });

    peer.on('disconnected', () => {
        log.connection("disconnected!");
    });

    peer.on('close', () => {
        log.connection('Connection to PeerJS server closed');
    });

    peer.on('error', (err) => {
        log.connection(err);
    });
}

function sendEvent(e) {
    log.data('Sending event to game server');
    log.data(e);
    if (conn) {
        conn.send(e);
    } else {
        log.data('connection not yet established');
    }
}

function onEvent(side) {
    return e => {
        sendEvent({
            side: side,
            speedX: e.speedX,
            speedY: e.speedY
        });
    }
}

function registerHandlers(dom, side) {
    const t = new Touchnavi(dom);
    t.addSpeedListener(onEvent(side));
}

function init() {
    registerHandlers(document.getElementById("LeftPad"), "left");
    registerHandlers(document.getElementById("RightPad"), "right");

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("serverId")) {
        initConnection(urlParams.get("serverId"));
    } else {
        console.error("No serverId in URL");
    }
}

window.onload = init;
