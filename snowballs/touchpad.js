"use strict";

let conn = null;

function initConnection (serverId) {
    const peer = new Peer(null, {debug: 2});

    peer.on('open', (id) => {
        log.connection("PeerJS server gave us ID " + id);

        conn = peer.connect(serverId, {
            reliable: true,
            metadata: { type: "touchpad" }
        });

        conn.on('open', () => {
            log.connection("Connected to " + conn.peer);
            peer.disconnect(); // we don't need the connection to the PeerJS server any more
        });

        conn.on('data', (data) => {
            log.data(`Data received (not quite expected), closing connection`);
            log.data(data);
            conn.close();
        });

        conn.on('close', () => {
            log.connection("Connection closed");
        });
    });

    peer.on('disconnected', () => {
        log.connection("Disconnected from PeerJS server");
    });

    peer.on('close', () => {
        log.connection('PeerJS Peer closed');
    });

    peer.on('error', (err) => {
        log.connection(err);
    });
}

function sendEvent(e) {
    log.data('Sending event');
    log.data(e);
    if (conn) {
        sendMessage(conn, e);
    } else {
        log.data('connection not yet established');
    }
}

const movementScale = 10;

function onEvent(side) {
    return e => {
        sendEvent({
            side: side,
            timestamp: e.timestamp / 1000,
            speedX: e.speedX * movementScale,
            speedY: e.speedY * movementScale
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
    if (urlParams.has("connectTo")) {
        initConnection(urlParams.get("connectTo"));
    } else {
        console.error("No connectTo in URL");
    }
}

window.onload = init;
