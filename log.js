"use strict";

function ignore(msg) {}

const log = {
    event: console.log,
    connection: console.log,
    data: ignore,
    debug: ignore
}

// By running "log.topicname = ignore" or "log.topicname = console.log" in the console,
// one can change the logging levels dynamically without reloading the page
