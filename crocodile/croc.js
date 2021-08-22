"use strict";

function I(id) {
    return document.getElementById(id);
}

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
    }    }

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

// first repaint, then alert
function delayedAlert(msg) {
    setTimeout(() => alert(msg), 0);
}

function letterClick(e) {
    if (blocked) return;
    const span = e.currentTarget;
    const c = span.innerHTML;

    // ignore letters that have already been classified as correct or wrong
    if (!span.getAttribute("class")) {
        const topFound = addLetter(c, I("topMouthG"), topStr, 0.5);
        const bottomFound = addLetter(c, I("bottomMouthG"), bottomStr, - 0.5 - toothHeight);
        if (topFound || bottomFound) {
            span.setAttribute("class", "correctLetter");
            if (lettersStillToFind === 0) {
                blocked = true;
                delayedAlert("You win!");
            }
        } else {
            span.setAttribute("class", "wrongLetter");
            wrongTries++;
            updateMouthAngle();
            if (wrongTries === maxTries) {
                blocked = true;
                delayedAlert("You lose!");
            }
        }
    }
}

function cleanWord(w) {
    return w.toUpperCase().replace(/[^ A-Z]/g, "");
}

function inputChange(e) {
    const oldVal = e.target.value;
    const newVal = cleanWord(oldVal);
    if (newVal != oldVal) e.target.value = newVal;

    const unused = new Set();
    for (let i = 'A'.charCodeAt(0); i <= 'Z'.charCodeAt(0); i++) {
        unused.add(String.fromCharCode(i));
    }
    const used = new Set();
    for (const c of (I("topStr").value + I("bottomStr").value)) {
        if (c === ' ') continue;
        unused.delete(c);
        used.add(c);
    }
    I("usedLetters").value = used.size;
    I("unusedLetters").value = unused.size;
}

function submit() {
    const top = encodeURIComponent(btoa(I("topStr").value));
    const bottom = encodeURIComponent(btoa(I("bottomStr").value));
    const max = I("maxTries").value;
    window.location = `${window.location.origin}${window.location.pathname}?topStr=${top}&bottomStr=${bottom}&maxTries=${max}`;    
}

let topStr = "";
let bottomStr = "";
let maxTries = 12;

const toothWidth = 0.7;
const toothDist = 0.8;
const toothHeight = 0.95;
const toothTextHeight = 0.8;
const leftToothMargin = 0.5;
const rightToothMargin = 4;
const fullyOpenAngle = 32;

let lettersStillToFind = -1;
let wrongTries = 0;
let blocked = false;

function addTeeth(g, letters, y) {
    let x = - Math.max(topStr.length, bottomStr.length) * toothDist - rightToothMargin;
    for (const l of letters) {
        if (l !== ' ') {
            g.appendChild(svg("rect", { x: x, y: y, width: toothWidth, height: toothHeight, fill: "white" }));
        }
        x += toothDist;
    }
}

function addLetter(c, g, letters, y) {
    let foundLetter = false;
    let x = - Math.max(topStr.length, bottomStr.length) * toothDist - rightToothMargin;
    for (const l of letters) {
        if (c === l) {
            foundLetter = true;
            lettersStillToFind--;
            const t = svg("text", { 
                x: x + 0.5 * toothWidth, 
                y: y + 0.5 * toothHeight, 
                "font-size": toothTextHeight, 
                "dominant-baseline": "middle",
                "text-anchor": "middle"
            });
            t.textContent = c;
            g.appendChild(t);
        }
        x += toothDist;
    }
    return foundLetter;
}

function updateMouthAngle() {
    I("topMouthG").setAttribute("transform", `rotate(${(maxTries-wrongTries)/maxTries*fullyOpenAngle})`);
}

function setupMouth() {
    addTeeth(I("topTeeth"), topStr, 0.5);
    addTeeth(I("bottomTeeth"), bottomStr, -0.5 - toothHeight);
    const w = leftToothMargin + Math.max(topStr.length, bottomStr.length) * toothDist + rightToothMargin;
    I("topMouth").setAttribute("x", -w);
    I("topMouth").setAttribute("width", w);
    I("bottomMouth").setAttribute("x", -w);
    I("bottomMouth").setAttribute("width", w);
    updateMouthAngle();
    const minx = -w - 0.5;
    const miny = - Math.max(4, Math.sin(fullyOpenAngle / 180 * Math.PI) * w + 0.5);
    const maxx = 5;
    const maxy = 4;
    I("crocSvg").setAttribute("viewBox", `${minx} ${miny} ${maxx - minx} ${maxy - miny}`);
}

function init() {
    for (const s of document.getElementsByTagName("span")) {
        s.onclick = letterClick;
    }
    I("topStr").oninput = inputChange;
    I("bottomStr").oninput = inputChange;

    const urlParams = new URLSearchParams(window.location.search);
    topStr = urlParams.get("topStr") ?? "";
    bottomStr = urlParams.get("bottomStr") ?? "";
    maxTries = urlParams.get("maxTries") ?? "12";
    if (maxTries === "") maxTries = "12";
    maxTries = Number.parseInt(maxTries);
    if (maxTries < 1) maxTries = 12;
    topStr = atob(topStr).toUpperCase();
    bottomStr = atob(bottomStr).toUpperCase();
    //console.log(topStr);
    //console.log(bottomStr);

    if (topStr && bottomStr) {
        I("getWords").style.display = "none";
        setupMouth();
        lettersStillToFind = (topStr + bottomStr).replaceAll(" ", "").length;
    }
}
