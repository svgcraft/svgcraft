"use strict";

var N = 5;
var W = 10;

function vary(v, d) {
    return v + Math.round((Math.random()-0.5) * d);
}

function vary_rgb(c) {
    return c.map(v => vary(v, 10));
}

function rgb_array_to_str(a) {
    return 'rgb(' + a.join(', ') + ')';
}

var h_variance = 3;
var s_variance = 10;
var l_variance = 5;
var min_dist = 1;

var previous = [43, 41, 48];

function dist(a, b) {
    const variances = [h_variance, s_variance, l_variance];
    var sum = 0;
    for (var i = 0; i < 3; i++) sum += Math.abs(a[i] - b[i]) / variances[i];
    return sum;
}

function vary_hsl(c) {
    var res = c;
    do {
        res = [vary(c[0], h_variance), vary(c[1], s_variance), vary(c[2], l_variance)];
    } while (dist(res, previous) < min_dist);
    previous = res;
    return res;
}

function hsl_array_to_str(a) {
    return `hsl(${a[0]}, ${a[1]}%, ${a[2]}%)`;
}

function hardwood_tile(c, x, y, dx, dy) {
    for (var i = 0; i < N; i++) {
        app.post({
            action: "new",
            tag: "rect",
            x: x + i * dx,
            y: y + i * dy,
            width: N * dy + dx + 1,
            height: N * dx + dy + 1,
            fill: hsl_array_to_str(vary_hsl(c))
        });
    }
}

function hardwood_floor_one(x, y) {
    // const c = [185, 168, 76];
    const c = [43, 41, 48];
    hardwood_tile(c, x, y, W, 0);
    hardwood_tile(c, x+N*W, y, 0, W);
    hardwood_tile(c, x, y+N*W, 0, W);
    hardwood_tile(c, x+N*W, y+N*W, W, 0);
}

function hardwood_floor(count) {
    for (var i = 0; i < count; i++) {
        for (var j = 0; j < count; j++) {
            hardwood_floor_one(i * 2 * N * W, j * 2 * N * W);
        }
    }
}

hardwood_floor(2);
for (const a of app.history) {
    const a2 = Object.assign({}, a);
    a2.parent = "hardwood-floor";
    console.log(JSON.stringify(a2));
}
