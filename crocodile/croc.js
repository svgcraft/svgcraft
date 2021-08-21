"use strict";

function I(id) {
    return document.getElementById(id);
}

function letterClick(e) {
    const c = e.currentTarget.innerHTML;
    console.log(c);
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

function init() {
    for (const s of document.getElementsByTagName("span")) {
        s.onclick = letterClick;
    }

    const urlParams = new URLSearchParams(window.location.search);
    topStr = urlParams.get("topStr") ?? "";
    bottomStr = urlParams.get("bottomStr") ?? "";
    maxTries = urlParams.get("maxTries") ?? 12;
    topStr = atob(topStr).toUpperCase();
    bottomStr = atob(bottomStr).toUpperCase();
    console.log(topStr);
    console.log(bottomStr);

    if (topStr && bottomStr) {
        I("getWords").style.display = "none";
    }
}