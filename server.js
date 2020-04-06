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

        const peer = new Peer(this.peerId, {debug: 2});

        peer.on('open', (id) => {
            console.log("PeerJS server gave us ID " + id);
            console.log("Waiting for peers to connect");
            this.finish_init();
        });

        var nextFreeClientId = 1; // 0 is ourselves

        peer.on('connection', (conn) => {
            const clientId = `avatar${nextFreeClientId}`;
            nextFreeClientId++;

            console.log("Connected to " + conn.peer + ", clientId: " + clientId);

            conn.on('open', () => {
                conn.send({your_id: clientId});
                conn.send(this.history);
            });

            conn.on('data', (data) => {
                console.log(`Data received from client ${clientId}:`);
                console.log(data);
                // TODO send to all clients except to clientId
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

    post(actions) {
        process_json_actions(actions);
        // TODO send to clients
    }
}
