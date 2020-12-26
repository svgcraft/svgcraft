"use strict";

let conn = null;
let serverTimeDelta = 0;

function toServerTime(t) {
    return t / 1000 - serverTimeDelta;
}

function initConnection (serverId) {
    const peer = new Peer(null, {debug: 2});

    peer.on('open', (id) => {
        log.connection("PeerJS server gave us ID " + id);

        conn = peer.connect(serverId, {
            reliable: true // TODO set to false once we do several time measures and are sure we can deal with packet loss/reordering
        });

        let timeRequestSent = null;

        conn.on('open', () => {
            log.connection("Connected to " + conn.peer);
            timeRequestSent = performance.now() / 1000;
            sendMessage(conn, { type: "gettime" } );
        });

        conn.on('data', (data) => {
            log.data(`Data received from game server`);
            log.data(data);
            if (data.type === "time") {
                const timeResponseReceived = performance.now() / 1000;
                const timeResponseSent = (timeRequestSent + timeResponseReceived) / 2;
                serverTimeDelta = timeResponseSent - data.timeStamp;
                log.connection(`RTT: ${timeResponseReceived - timeRequestSent}s`);
                log.connection(`serverTimeDelta: ${serverTimeDelta}s`);
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
            timeStamp: toServerTime(e.timeStamp),
            speedX: e.speedX,
            speedY: e.speedY
        });
    }
}

function registerHandlers(dom, side) {
    const t = new Touchnavi(dom);
    t.addSpeedListener(onEvent(side));
}

function frame(timestamp) {
    document.getElementById("serverTime").innerText = Math.floor(toServerTime(timestamp));
    window.requestAnimationFrame(frame);
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

    window.requestAnimationFrame(frame);
}

window.onload = init;
