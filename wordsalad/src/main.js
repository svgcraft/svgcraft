'use strict';


function wordsalad(dom, geom) {
    const gap = 0.1;
    const lineWidth = 0.05;
    const textHeight = 0.7;

    function addSquares(mainSvg, y, word, showWord) {
        for (var i = 0; i < word.length; i++) {
            const r = dom.svg("rect", {
                x: i + gap,
                y: y + gap,
                width: 1 - 2 * gap,
                height: 1 - 2 * gap,
                fill: "transparent",
                stroke: "black",
                "stroke-width": lineWidth
            });
            mainSvg.appendChild(r);
            if (showWord) {
                const letter = word[i];
                const t = dom.svg("text", {
                    x: i + 0.5,
                    y: y + 0.52,
                    "font-size": textHeight,
                    "dominant-baseline": "middle",
                    "text-anchor": "middle"
                });
                t.textContent = letter;
                mainSvg.appendChild(t);
            }
        }
    }

    function randomInt(maxPlusOne) {
        return Math.floor(Math.random() * maxPlusOne);
    }

    function permute_str(l) {
        if (l.length <= 1) return l;
        const h = l[0];
        const t = l.substring(1);
        const u = permute_str(t);
        const i = randomInt(u.length);
        const before = u.substring(0, i);
        const after = u.substring(i, u.length);
        return before + h + after;
    }

    function permutation(n) {
        const a = [...Array(n).keys()];
        for (var i = 0; i < n - 1; i++) {
            const j = i + randomInt(n - i); // i <= j < n
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function applyPermutation(p, s) {
        var r = "";
        for (var i = 0; i < p.length; i++) {
            r = r + s[p[i]];
        }
        return r;
    }

    function connect(i, j) {
        const xTop = i + 0.5;
        const yTop = 1 - gap;
        const xBot = j + 0.5;
        const yBot = H - 1 + gap;
        const d = 0.4 * (H - 2);
        const b = dom.svg("path", {
            d: `M ${xTop} ${yTop} C ${xTop} ${yTop+d} ${xBot} ${yBot-d} ${xBot} ${yBot}`,
            fill: "transparent",
            stroke: "black",
            "stroke-width": lineWidth
        });
        return b;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const solution = urlParams.has("solution") ? urlParams.get("solution") : 'EXAMPLE';
    const perm = permutation(solution.length);
    const scrambled = applyPermutation(perm, solution);
    console.log(solution);
    console.log(perm);
    console.log(scrambled);
    const mainSvg = document.getElementById("mainSvg");
    const W = solution.length;
    const H = W * 0.5 + 2;
    mainSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    addSquares(mainSvg, 0, scrambled, true);
    addSquares(mainSvg, H - 1, solution, false);
    for (var i = 0; i < solution.length; i++) {
        if (Math.random() < 0.2) continue;
        mainSvg.appendChild(connect(i, perm[i]));
    }

}

