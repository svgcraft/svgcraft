'use strict';

function packwords(dom, wordlist) {
    const thinLineWidth = 0.04;
    const thickLineWidth = 0.08;
    const borderSlack = 0.1;
    const gridLineColor = "gray";
    const wordBackgroundColor = "#dedede";
    const wordFrameColor = "black";
    const textHeight = 0.7;


    function paintGrid() {
        const attrs = {
            x1: 0,
            y1: 0,
            x2: W,
            y2: 0,
            stroke: gridLineColor,
            "stroke-width": thinLineWidth,
            "stroke-linecap": "square"
        };
        for (var row = 0; row <= H; row++) {
            mainSvg.appendChild(dom.svg("line", attrs));
            attrs.y1 += 1;
            attrs.y2 += 1;
        }
        attrs.x1 = 0;
        attrs.y1 = 0;
        attrs.x2 = 0;
        attrs.y2 = H;
        for (var col = 0; col <= W; col++) {
            mainSvg.appendChild(dom.svg("line", attrs));
            attrs.x1 += 1;
            attrs.x2 += 1;
        }
    }

    class Word {
        constructor(x, y, word, isDown) {
            this.x = x;
            this.y = y;
            this.word = word;
            this.isDown = isDown;
        }
        get dx() {
            return this.isDown ? 0 : 1;
        }
        get dy() {
            return this.isDown ? 1 : 0;
        }
        atPos(x, y) {
            return new Word(x, y, this.word, this.isDown);
        }
    }

    function paintWordRects(words, stroke, fill) {
        for (var word of words) {
            const attrs = { 
                x: word.x, 
                y: word.y, 
                width: word.isDown ? 1 : word.word.length, 
                height: word.isDown ? word.word.length : 1,
                stroke: stroke,
                "stroke-width": thickLineWidth,
                fill: fill
            };
            mainSvg.appendChild(dom.svg("rect", attrs));
        }
    }

    function paintLetters(words) {
        for (var word of words) {
            for (var i = 0; i < word.word.length; i++) {
                const letter = word.word[i];
                const t = dom.svg("text", {
                    x: word.x + 0.5 + word.dx * i,
                    y: word.y + 0.52 + word.dy * i,
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
        return Math.floor(rng() * maxPlusOne);
    }

    function emptyGrid(defaultValue) {
        const res = [];
        for (var row = 0; row < H; row++) {
            res.push(Array(W).fill(defaultValue));
        }
        return res;
    }

    function makeCompactSolution() {
        const gridLetters = emptyGrid(null);
        const usedWords = new Set();
        const wordObjs = new Set();

        function placeWord(x, y, word, isDown) {
            wordObjs.add(new Word(x, y, word, isDown));
            usedWords.add(word);
            const dx = isDown ? 0 : 1;
            const dy = isDown ? 1 : 0;
            for (var i = 0; i < word.length; i++) {
                gridLetters[y][x] = word[i];
                x += dx;
                y += dy;
            }
        }

        // -1 means invalid, bigger score is better (more crossings with other words)
        function rateWordPlacement(x, y, word, isDown) {
            if (usedWords.has(word)) return -1;
            const dx = isDown ? 0 : 1;
            const dy = isDown ? 1 : 0;
            if (W < x + word.length * dx) return -1;
            if (H < y + word.length * dy) return -1;
            var score = 0;
            for (var i = 0; i < word.length; i++) {
                if (gridLetters[y][x] === word[i]) {
                    score++;
                } else if (gridLetters[y][x] !== null) {
                    return -1;
                }
                x += dx;
                y += dy;
            }
            return score;
        }

        const firstWord = filteredWords[randomInt(filteredWords.length)];
        placeWord(Math.floor(W/2), Math.floor((H - firstWord.length)/2), firstWord, true);

        var remainingAcross = nAcross;
        var remainingDown = nDown;
        var nextIsDown = false;
        // let's hope this terminates...
        while (0 < remainingAcross + remainingDown) {
            const dx = nextIsDown ? 0 : 1;
            const dy = nextIsDown ? 1 : 0;
            const x = randomInt(W - dx * minWordLength);
            const y = randomInt(H - dy * minWordLength);
            const bests = new Set();
            var bestScore = -2;
            for (var w of filteredWords) {
                const score = rateWordPlacement(x, y, w, nextIsDown);
                if (score > bestScore) {
                    bestScore = score;
                    bests.clear();
                    bests.add(w);
                } else if (score === bestScore) {
                    bests.add(w);
                }
            }
            if (bestScore > 0) {
                const pick = Array.from(bests)[randomInt(bests.size)];
                placeWord(x, y, pick, nextIsDown);
                remainingAcross -= dx;
                remainingDown -= dy;
                nextIsDown = !nextIsDown;
                if (remainingAcross <= 0) { nextIsDown = true; }
                if (remainingDown <= 0) { nextIsDown = false; }
            }
        }
        return wordObjs;
    }

    function arrangeInStartPos(original) {
        const arranged = new Set();
        var downX = 0;
        var acrossY = H - 1;
        for (var w of original) {
            if (w.isDown) {
                arranged.add(w.atPos(downX, 0));
                downX++;
            } else {
                arranged.add(w.atPos(0, acrossY));
                acrossY--;
            }
        }
        return arranged;
    }

    function eventToRelCoords(e) {
        const r = mainSvg.getBoundingClientRect();
        const x = e.pageX - r.left;
        const y = e.pageY - r.top;
        return [x / r.width * (W + 2 * borderSlack), y / r.width * (H + 2 * borderSlack)];
    }

    var draggee = null;

    function onStartDragging(e) {

    }

    const urlParams = new URLSearchParams(window.location.search);
    const seedParam = urlParams.get("seed") ?? 'random';
    const seed = String(seedParam == 'random' ? Math.random() : seedParam);
    const rng = new Math.seedrandom(seed);
    const W = urlParams.get("W") ?? 9;
    const H = urlParams.get("H") ?? 14;
    const minWordLength = urlParams.get("minWordLength") ?? 3;
    const maxWordLength = urlParams.get("maxWordLength") ?? Math.min(W, H);
    const nAcross = urlParams.get("nAcross") ?? Math.floor(H / 3);
    const nDown = urlParams.get("nDown") ?? Math.floor(W / 3);
    
    const filteredWords = [];
    for (var w of wordlist) {
        if (minWordLength <= w.length && w.length <= maxWordLength) {
            filteredWords.push(w.toUpperCase());
        }
    }

    const mainSvg = document.getElementById("mainSvg");
    mainSvg.setAttribute("viewBox", `${-borderSlack} ${-borderSlack} ${W+2*borderSlack} ${H+2*borderSlack}`);

    const solution = makeCompactSolution();
    const current = arrangeInStartPos(solution);
    paintWordRects(current, "none", wordBackgroundColor);
    paintGrid();
    paintWordRects(current, wordFrameColor, "none");    
    paintLetters(current);
    console.log(solution);
}

