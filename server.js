"use strict";

// Don't confuse the three different servers:
// - HTTP(S) file server used to serve the html and js files
// - svgcraft server (this file)
// - peerjs server used to establish p2p connections

class Server extends App {

    constructor(peerId, worldJsonUrl) {
        super();
        this.peerId = peerId;
        this.worldJsonUrl = worldJsonUrl;
        fetch(this.worldJsonUrl)
            .then(res => res.json())
            .then((j) => this.init_with_json(j));
    }

    init_with_json(j) {
        this.history = j;
        process_json_actions(j);

        const peer = new Peer(this.peerId, {debug: 2});

        peer.on('open', (id) => {
            console.log("PeerJS server gave us ID " + id);
            console.log("Waiting for peers to connect");
        });

        var nextFreeClientId = 0;

        peer.on('connection', (conn) => {
            const clientId = nextFreeClientId;
            nextFreeClientId++;

            console.log("Connected to " + conn.peer + ", clientId: " + clientId);

            conn.on('open', () => {
                conn.send(this.history);
            });

            conn.on('data', (data) => {
                console.log(`Data received from client ${clientId}:`);
                console.log(data);
            });
            conn.on('close', () => {
                console.log(`Connection to client ${clientId} closed`);
            });
        });

        peer.on('disconnected', () => {
            console.log("disconnected!");
        });

        peer.on('close', () => {
            console.log('Connection to PeerJS server closed');
        });

        peer.on('error', (err) => {
            console.log(err);
        });
    }
}
