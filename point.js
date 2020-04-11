"use strict";

class Point {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    static zero() {
        return new Point(0, 0);
    }

    static polar(r, alpha){
        return new Point(r * Math.cos(alpha), r * Math.sin(alpha));
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
        return new Point(this.x * factor, this.y * factor);
    }

    json() {
        return {x: this.x, y: this.y};
    }
}
