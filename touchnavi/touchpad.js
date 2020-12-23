"use strict";

let conn = null;
let serverTimeDelta = null;

function getServerTime() {
    return (Date.now() - serverTimeDelta) / 1000;
}

function initConnection (serverId) {
    const peer = new Peer(null, {debug: 2});

    peer.on('open', (id) => {
        log.connection("PeerJS server gave us ID " + id);

        conn = peer.connect(serverId, {
            reliable: true
        });

        let timeRequestSent = null;

        conn.on('open', () => {
            log.connection("Connected to " + conn.peer);
            timeRequestSent = Date.now();
            sendMessage(conn, "gettime");
        });

        conn.on('data', (data) => {
            log.data(`Data received from game server`);
            log.data(data);
            if (data.type === "time") {
                const timeResponseReceived = Date.now();
                const timeResponseSent = (timeRequestSent + timeResponseReceived) / 2;
                serverTimeDelta = timeResponseSent - data.timeStamp;
                log.connection(`RTT: ${timeResponseReceived - timeRequestSent}ms`);
                log.connection(`serverTimeDelta: ${serverTimeDelta}ms`);
            }
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
        sendMessage(conn, e);
    } else {
        log.data('connection not yet established');
    }
}

function onEvent(side) {
    return e => {
        sendEvent({
            side: side,
            timeStamp: getServerTime(),
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
