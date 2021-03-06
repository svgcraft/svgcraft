"use strict";

// Don't confuse the three different servers:
// - HTTP(S) file server used to serve the html and js files
// - svgcraft server (this file)
// - peerjs server used to establish p2p connections

function make_client_link(serverId) {
    return `${window.location.protocol}//${window.location.host}/svgcraft.html?mode=client&serverId=${serverId}`;
}

class Server extends App {

    constructor(serverId, worldUrl) {
        super();
        this.serverId = serverId;
        this.worldUrl = worldUrl;
        this.avatarId = "avatar0";
        this.clientConns = {}; // maps clientId to PeerJS connection
    }

    init() {
        this.init_from_worldUrl();
    }

    init_with_json(j) {
        this.history = j;
        process_json_actions(j);

        const peer = new Peer(this.serverId, {debug: 2});

        peer.on('open', (id) => {
            log.connection("PeerJS server gave us ID " + id);
            this.serverId = id;
            log.connection("Client link to share:", make_client_link(this.serverId));
            log.connection("Waiting for peers to connect");
            this.finish_init();
        });

        var nextFreeClientId = 1; // 0 is ourselves

        peer.on('connection', (conn) => {
            const clientIdNumber = nextFreeClientId;
            const clientId = `avatar${clientIdNumber}`;
            nextFreeClientId++;

            log.connection("Connected to " + conn.peer + ", clientId: " + clientId);

            conn.on('open', () => {
                log.connection("Connection to " + conn.peer + " open");
                this.clientConns[clientId] = conn;
                for (const a of this.history) conn.send([a]);
                this.post([this.new_client_avatar_command(clientIdNumber)]);
                conn.send([{action: "your_id", id: clientId}]);
            });

            conn.on('data', (actions) => {
                log.data(`actions received from client ${clientId}:`);
                log.data(actions);
                // to make sure we know whether we have to avoid sending this update back to client
                for (const a of actions) {
                    a.creatorId = clientId;
                }
                this.post(actions);
            });
            conn.on('close', () => {
                delete this.clientConns[clientId];
                log.connection(`Connection to client ${clientId} closed`);
                const m = [];
                for (const g of I("OtherHandles").children) {
                    const idparts = g.getAttribute("id").split("__");
                    if (idparts[1] !== "select") throw "unexpected id format";
                    if (idparts[2] === clientId) {
                        m.push({
                            action: "deselect",
                            who: clientId,
                            what: [idparts[0]]
                        });
                    }
                }
                m.push({action: "del", id: clientId});
                app.post(m);
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

    new_client_avatar_command(clientIdNumber) {
        const shiftX = Avatar.radius * 4 * clientIdNumber;
        return {
            action: "new",
            tag: "avatar",
            id: `avatar${clientIdNumber}`,
            pos: {x: this.initialPos.x - shiftX, y: this.initialPos.y},
            view: {x: this.initialView.x + shiftX * this.initialView.scale,
                   y: this.initialView.y,
                   scale: this.initialView.scale}
        };
    }

    publish(actions) {
        for (const clientId in this.clientConns) {
            const f = actions.filter((a) => a.creatorId !== clientId);
            if (f.length) this.clientConns[clientId].send(f);
        }
    }
}
