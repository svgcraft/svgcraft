"use strict";

let slowDownNetwork = true;
let longDelay = 700;
let shortDelay = 300;
let delayDeviation = 50;

function sendMessage(conn, msg) {
    if (slowDownNetwork) {
        const baseDelay = (Math.round(Date.now() / 1000) % 4 === 0) ? longDelay : shortDelay;
        const delay = baseDelay - delayDeviation + (Math.random() - 0.5) * 2 * delayDeviation;
        console.log(`delaying by ${delay}ms:`, msg);
        setTimeout(() => { conn.send(msg) }, delay);
    } else {
        conn.send(msg);
    }
}
