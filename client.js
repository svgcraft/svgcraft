"use strict";

class Client extends App {
    constructor(serverId) {
        super();
        this.serverId = serverId;
        this.avatarId = null; // will be assigned by server
        this.conn = null;
    }

    init () {
        const peer = new Peer(null, {debug: 2});

        peer.on('open', (id) => {
            log.connection("PeerJS server gave us ID " + id);

            this.conn = peer.connect(this.serverId, {
                reliable: true,
                serialization: 'json'
            });

            this.conn.on('open', () => {
                log.connection("Connected to " + this.conn.peer);
            });

            this.conn.on('data', (data) => {
                log.data(`Data received from svgcraft server`);
                log.data(data);
                process_json_actions(data);
                this.history.push(...data);
            });

            this.conn.on('close', () => {
                log.connection("Connection to svgcraft server closed");
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

    publish(actions) {
        this.conn.send(actions);
    }
}
