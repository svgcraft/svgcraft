"use strict";

class Client extends App {
    constructor(serverId) {
        super();
        this.serverId = serverId;
        this.avatarId = null; // will be assigned by server
        this.conn = null;
    }

    init (avatar_update) {
        const peer = new Peer(null, {debug: 2});

        peer.on('open', (id) => {
            console.log("PeerJS server gave us ID " + id);

            this.conn = peer.connect(this.serverId, {
                reliable: true
            });

            this.conn.on('open', () => {
                console.log("Connected to " + this.conn.peer);
            });

            this.conn.on('data', (data) => {
                console.log(`Data received from svgcraft server`);
                console.log(data);
                if (data.your_id) {
                    this.avatarId = data.your_id;
                    // TODO server or client needs to issue avatar creation event
                    avatar_update.id = data.your_id;
                    this.post([avatar_update]); // TODO how does this interleave with server sending history?

                    this.finish_init();
                } else {
                    process_json_actions(data);
                    this.history.push(...data);
                }
            });

            this.conn.on('close', () => {
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

    post(actions) {
        process_json_actions(actions);
        this.conn.send(actions);
    }
}
