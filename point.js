"use strict";

class Point {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
        if (typeof this.x !== 'number') throw new TypeError(`${x} is not a number`);
        if (typeof this.y !== 'number') throw new TypeError(`${y} is not a number`);
    }

    static zero() {
        return new Point(0, 0);
    }

    static polar(r, alpha){
        return new Point(r * Math.cos(alpha), r * Math.sin(alpha));
    }

    static min(p1, p2) {
        return p1.norm() < p2.norm() ? p1 : p2;
    }

    static infinity() {
        return new Point(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    }

    add(that) {
        return new Point(this.x + that.x, this.y + that.y);
    }

    sub(that) {
        return new Point(this.x - that.x, this.y - that.y);
    }

    norm() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    distanceTo(that) {
        return this.sub(that).norm();
    }

    rotate(alpha) {
        return Point.polar(this.norm(), this.angle() + alpha);
    }

    scale(factor) {
        if (factor instanceof Point) {
            return new Point(this.x * factor.x, this.y * factor.y);
        } else {
            return new Point(this.x * factor, this.y * factor);
        }
    }

    scaleToLength(l) {
        return this.scale(l / this.norm());
    }

    dot(that) {
        return this.x * that.x + this.y * that.y;
    }

    json() {
        return {x: this.x, y: this.y};
    }
}

// distance of c from the line defined by a and b
function dist_from_line(c, a, b) {
    const lambda = a.sub(c).dot(a.sub(b)) / a.sub(b).dot(a.sub(b));
    return a.sub(c).add(b.sub(a).scale(lambda)).norm();
}
