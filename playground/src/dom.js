"use strict";

function dom() {
    function addAttrsAndChildren(res, attrs, children, allowedAttrs) {
        if (attrs) {
            for (const attrName in attrs) {
                if (!allowedAttrs || allowedAttrs.includes(attrName)) res.setAttribute(attrName, attrs[attrName]);
            }
        }
        if (children) {
            for (const child of children) {
                res.appendChild(child);
            }
        }
    }

    function elem(tag, attrs, children, allowedAttrs) {
        const res = document.createElement(tag);
        addAttrsAndChildren(res, attrs, children, allowedAttrs);
        return res;
    }

    function svg(tag, attrs, children, allowedAttrs) {
        const res = document.createElementNS("http://www.w3.org/2000/svg", tag);
        addAttrsAndChildren(res, attrs, children, allowedAttrs);
        return res;
    }

    return {
        elem: elem,
        svg: svg
    };
}
