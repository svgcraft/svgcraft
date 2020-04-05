"use strict";

// Don't confuse the three different servers:
// - HTTP(S) file server used to serve the html and js files
// - svgcraft server (this file)
// - peerjs server used to establish p2p connections

// This is the id of the svgcraft server, used as a peer id for peerjs
var serverId;

function init_with_json(j) {
    const peer = new Peer(serverId, {debug: 2});

    peer.on('open', function (id) {
        console.log("PeerJS server gave us ID " + id);
        console.log("Waiting for peers to connect");
    });

    var nextFreeClientId = 0;

    peer.on('connection', function (conn) {
        const clientId = nextFreeClientId;
        nextFreeClientId++;

        console.log("Connected to " + conn.peer + ", clientId: " + clientId);

        conn.on('open', function () {
            conn.send(j);
        });

        conn.on('data', function (data) {
            console.log(`Data received from client ${clientId}:`);
            console.log(data);
        });
        conn.on('close', function () {
            console.log(`Connection to client ${clientId} closed`);
        });
    });

    peer.on('disconnected', function () {
        console.log("disconnected!");
    });

    peer.on('close', function() {
        console.log('Connection to PeerJS server closed');
    });

    peer.on('error', function (err) {
        console.log(err);
    });
}

// invoke server by opening an URL like this:
// http://0.0.0.0:8000/server.html?worldJsonUrl=archipelago.json&serverId=MY_RANDOM_ID
// where MY_RANDOM_ID is random enough to not collide with other users of peerjs,
// for instance you could create it using `openssl rand -hex 20`
function init() {
    const urlParams = new URLSearchParams(window.location.search);

    const worldJsonUrl = urlParams.get("worldJsonUrl");
    if (!worldJsonUrl) throw "Error: no worldJsonUrl";
    console.log(worldJsonUrl);

    serverId = urlParams.get("serverId");
    if (!serverId) throw "Error: No serverId";
    console.log(serverId);

    fetch(worldJsonUrl).then(res => res.json()).then(init_with_json);
}
