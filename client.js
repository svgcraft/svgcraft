"use strict";

class Client extends App {
    constructor(serverId) {
        super();
        this.serverId = serverId;

        const peer = new Peer(null, {debug: 2});

        peer.on('open', (id) => {
            console.log("PeerJS server gave us ID " + id);

            const conn = peer.connect(serverId, {
                reliable: true
            });
            console.log(conn);

            conn.on('open', () => {
                console.log("Connected to " + conn.peer);
            });

            conn.on('data', (data) => {
                console.log(`Data received from svgcraft server`);
                console.log(data);
                process_json_actions(data);
                this.history.push(...data);
            });

            conn.on('close', () => {
                console.log("Connection to svgcraft server closed");
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
