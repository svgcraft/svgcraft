"use strict";

function I(id) {
    return document.getElementById(id);
}

let conn = null;

function initConnection (serverId) {
    const peer = new Peer(null, {debug: 2});

    peer.on('open', (id) => {
        log.connection("PeerJS server gave us ID " + id);

        conn = peer.connect(serverId, {
            reliable: true,
            metadata: { type: "swipepad" }
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

function positionLine(dom, x1, y1, x2, y2) {
    dom.setAttribute("x1", x1);
    dom.setAttribute("y1", y1);
    dom.setAttribute("x2", x2);
    dom.setAttribute("y2", y2);
}

function initSwipepad(svg, onSwipe) {
    svg.style.cursor = "none";
    svg.oncontextmenu = e => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    const line = svg.getElementsByTagName("line")[0];
    let lastX = null;
    let lastY = null;
    let lastT = null;
    svg.addEventListener("pointerdown", e => {
        line.setAttribute("class", "visible");
    });
    svg.addEventListener("pointermove", e => {
        const relX = e.offsetX / svg.clientWidth;
        const relY = e.offsetY / svg.clientWidth; // 1.0 ~ width, even if pad is not square
        if (lastX === null) lastX = relX;
        if (lastY === null) lastY = relY;
        if (lastT === null) lastT = e.timeStamp;
        positionLine(line, lastX, lastY, relX, relY);
    });
    svg.addEventListener("pointerup", e => {
        const relX = e.offsetX / svg.clientWidth;
        const relY = e.offsetY / svg.clientWidth; // 1.0 ~ width, even if pad is not square
        onSwipe(relX - lastX, relY - lastY, e.timeStamp - lastT + 1.0);
        line.setAttribute("class", "hidden");
        lastX = null;
        lastY = null;
        lastT = null;
    });
    function onResize() {
        const h = svg.parentNode.clientHeight / svg.parentNode.clientWidth;
        svg.setAttribute("viewBox", `0 0 1 ${h}`);
    }
    window.addEventListener("resize", onResize);
    onResize();
}

function onEvent(side) {
    return (dx, dy, dt) => {
        sendEvent({
            side: side,
            deltaX: dx,
            deltaY: dy,
            deltaT: dt / 1000
        });
    }
}

function init() {
    initSwipepad(I("LeftPad"), onEvent("left"));
    initSwipepad(I("RightPad"), onEvent("right"));
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("connectTo")) {
        initConnection(urlParams.get("connectTo"));
    } else {
        console.error("No connectTo in URL");
    }
}

window.onload = init;
