"use strict";

function events() {
    const subscribers = new Set();

    function subscribe(f) {
        subscribers.add(f);
    }

    function unsubscribe(f) {
        subscribers.delete(f);
    }

    function publishOne(e, sourceId) {
        console.log(sourceId, e);
        for (const f of subscribers) f(e, sourceId);
    }

    // sourceId is optional and denotes the peer publishing e
    // undefined means it was published by ourselves
    function publish(e, sourceId) {
        if (Array.isArray(e)) {
            for (const x of e) publishOne(x, sourceId);
        } else {
            publishOne(e, sourceId);
        }
    }

    return {
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        publish: publish
    }
}