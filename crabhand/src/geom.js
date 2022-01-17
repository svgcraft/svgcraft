"use strict";

function geom() {

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

        // distance from the line defined by points a and b
        dist_from_line(c, a, b) {
            const lambda = a.sub(this).dot(a.sub(b)) / a.sub(b).dot(a.sub(b));
            return a.sub(this).add(b.sub(a).scale(lambda)).norm();
        }
    }

    return {
        Point: Point,

        // returns angle between -Math.PI and Math.PI
        normalizeAngle: function (a) {
            return a - 2 * Math.PI * Math.floor(a / 2 / Math.PI + 0.5);
        },

        // avoids getting huge angles by repeatedly adding Math.PI
        oppositeAngle: function (a) {
            return this.normalizeAngle(a + Math.PI);
        },

        angleDist: function (a, b) {
            return Math.abs(this.normalizeAngle(a - b));
        },

        equilateral_triangle_from_center: function (center, corner) {
            const r = corner.sub(center);
            const p1 = corner;
            const p2 = center.add(r.rotate(Math.PI*2/3));
            const p3 = center.add(r.rotate(-Math.PI*2/3));
            return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} z`;
        },
        
        equilateral_triangle: function (mid, tip) {
            const h = tip.sub(mid);
            const l = h.norm() / Math.sqrt(3.0);
            const p1 = mid.add(Point.polar(l, h.angle() + Math.PI/2));
            const p2 = mid.add(Point.polar(l, h.angle() - Math.PI/2));
            return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${tip.x} ${tip.y} z`;
        },
        
        isosceles_triangle: function (baseMid, baseLength, rotation, height) {
            const tip = baseMid.add(Point.polar(height, rotation));
            const p1 = baseMid.add(Point.polar(baseLength/2, rotation + Math.PI/2));
            const p2 = baseMid.add(Point.polar(baseLength/2, rotation - Math.PI/2));
            return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${tip.x} ${tip.y} z`;
        },
        
        line: function (p1, p2) {
            return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
        },

        /*
        rectangle: function (origin, corner) {
            const x = Math.min(origin.x, corner.x);
            const y = Math.min(origin.y, corner.y);
            const w = Math.abs(origin.x - corner.x);
            const h = Math.abs(origin.y - corner.y);
            return {x: x, y: y, width: w, height: h};
        },
        */
        
        square: function (corner1, corner3) {
            const r = corner1.sub(corner3).scale(0.5);
            const center = corner3.add(r);
            const corner0 = center.add(r.rotate(Math.PI/2));
            const corner2 = center.add(r.rotate(-Math.PI/2));
            return 'M ' + [corner0, corner1, corner2, corner3].map((p) => `${p.x} ${p.y}`).join(' L ') + ' z';
        }
    };
}