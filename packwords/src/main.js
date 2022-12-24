'use strict';

function packwords(dom, wordlist) {
    const thinLineWidth = 0.04;
    const thickLineWidth = 0.08;
    const borderSlack = 0.1;
    const gridLineColor = "gray";
    const wordBackgroundColor = "#dedede";
    const wordFrameColor = "black";
    const textHeight = 0.7;
    const negativeSquareColor = "#ff3333";
    const positiveSquareColor = "#00b300";


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
        coversPos(x, y) {
            if (this.isDown) {
                return this.x <= x && x < this.x + 1 && this.y <= y && y < this.y + this.word.length;
            } else {
                return this.y <= y && y < this.y + 1 && this.x <= x && x < this.x + this.word.length;
            }
        }
        rotateAtIndex(i) {
            if (this.isDown) {
                this.x = this.x - i;
                this.y = this.y + i;
            } else {
                this.x = this.x + i;
                this.y = this.y - i;
            }
            this.isDown = !this.isDown;
        }
    }

    function paintScoreSquares(scoreGrid) {
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                if (scoreGrid[y][x] != 0) {
                    const attrs = { 
                        x: x, 
                        y: y, 
                        width: 1,
                        height: 1,
                        stroke: "none",
                        fill: scoreGrid[y][x] < 0 ? negativeSquareColor : positiveSquareColor
                    };
                    mainSvg.appendChild(dom.svg("rect", attrs));
                }
            }
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
                    "text-anchor": "middle",
                    "pointer-events": "none"
                });
                t.textContent = letter;
                mainSvg.appendChild(t);
            }
        }
    }

    function randomInt(maxPlusOne) {
        return Math.floor(rng() * maxPlusOne);
    }

    // Returns a grid of strings, each the concatenation of all letters on that cell
    function computeOccupancy(wordObjs) {
        const occ = emptyGrid("");
        for (w of wordObjs) {
            for (var i = 0; i < w.word.length; i++) {
                const x = w.x + (w.isDown ? 0 : i);
                const y = w.y + (w.isDown ? i : 0);
                if (0 <= x && x < W && 0 <= y && y < H) {
                    occ[y][x] = occ[y][x].concat(w.word[i]);
                }
            }
        }
        return occ;
    }

    function containsDifferentLetters(s) {
        if (s.length === 0) return false;
        for (var i = 1; i < s.length; i++) {
            if (s[0] !== s[i]) return true;
        }
        return false;
    }

    function occupancyToScoreGrid(occ) {
        const scoreGrid = emptyGrid(0);
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                const s = occ[y][x];
                if (containsDifferentLetters(s)) {
                    scoreGrid[y][x] = -1;
                } else if (s.length > 1) {
                    scoreGrid[y][x] = s.length - 1;
                }
            }
        }
        return scoreGrid;
    }

    function scoreGridSum(scoreGrid) {
        var sum = 0;
        for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
                sum += scoreGrid[y][x];
            }
        }
        return sum;
    }

    function emptyGrid(defaultValue) {
        const res = [];
        for (var row = 0; row < H; row++) {
            res.push(Array(W).fill(defaultValue));
        }
        return res;
    }

    function emptyGridGen(f) {
        const res = [];
        for (var row = 0; row < H; row++) {
            const a = [];
            for (var col = 0; col < W; col++) {
                a.push(f());
            }
            res.push(a);
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

    function findWordAt(x, y, wordObjs) {
        for (var w of wordObjs) {
            if (w.coversPos(x, y)) return w;
        }
    }

    function eventToRelCoords(e) {
        const r = mainSvg.getBoundingClientRect();
        const x = e.pageX - r.left;
        const y = e.pageY - r.top;
        return [x / r.width * (W + 2 * borderSlack), y / r.height * (H + 2 * borderSlack)];
    }
    
    function eventToIntRelCoords(e) {
        const [x, y] = eventToRelCoords(e);
        return [Math.floor(x), Math.floor(y)];
    }

    var draggee = null;
    var indexOfDraggedLetter = -1;

    function onStartDragging(e) {
        const [x, y] = eventToIntRelCoords(e);
        draggee = findWordAt(x, y, current);
        if (draggee) indexOfDraggedLetter = (x - draggee.x) + (y - draggee.y); // only one of the summands is non-zero
        e.preventDefault();
    }

    function onDragging(e) {
        const [xMouse, yMouse] = eventToIntRelCoords(e);
        draggee.x = xMouse - (draggee.isDown ? 0 : indexOfDraggedLetter);
        draggee.y = yMouse - (draggee.isDown ? indexOfDraggedLetter : 0);
        repaint();
        e.preventDefault();
    }

    function onMouseMove(e) {
        if (draggee != null) {
            onDragging(e);
        }
    }

    function onEndDragging(e) {
        draggee = null;
        indexOfDraggedLetter = -1;
    }

    function onRightClick(e) {
        const [x, y] = eventToIntRelCoords(e);
        w = findWordAt(x, y, current);
        if (w) {
            const indexOfLetter = (x - w.x) + (y - w.y); // only one of the summands is non-zero
            w.rotateAtIndex(indexOfLetter);
        }
        repaint();
        e.preventDefault();
    }

    function repaint() {
        const occ = computeOccupancy(current);
        const scoreGrid = occupancyToScoreGrid(occ);
        mainSvg.replaceChildren();
        paintWordRects(current, "none", wordBackgroundColor);
        paintScoreSquares(scoreGrid);
        paintGrid();
        paintWordRects(current, wordFrameColor, "none");    
        paintLetters(current);
        scoreSpan.innerHTML = scoreGridSum(scoreGrid);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const seedParam = urlParams.get("seed") ?? 'random';
    const seed = String(seedParam == 'random' ? Math.random() : seedParam);
    const rng = new Math.seedrandom(seed);
    const W = urlParams.get("W") ?? 9;
    const H = urlParams.get("H") ?? 14;
    const minWordLength = urlParams.get("minWordLength") ?? 3;
    const maxWordLength = urlParams.get("maxWordLength") ?? Math.min(W, H);
    const customWords = urlParams.has("customWords") ? urlParams.get("customWords").split(",") : null;
    const nAcross = urlParams.get("nAcross") ?? Math.floor(H / 3);
    const nDown = urlParams.get("nDown") ?? Math.floor(W / 3);
    
    const filteredWords = [];
    for (var w of wordlist) {
        if (minWordLength <= w.length && w.length <= maxWordLength) {
            filteredWords.push(w.toUpperCase());
        }
    }

    var solution = null;
    var current = null;

    if (customWords) {
        current = arrangeInStartPos(customWords.map(w => new Word(0, 0, w, false)));
    } else {
        solution = makeCompactSolution();
        current = arrangeInStartPos(solution);
    }

    const mainSvg = document.getElementById("mainSvg");
    const scoreSpan = document.getElementById("scoreSpan");
    mainSvg.setAttribute("viewBox", `${-borderSlack} ${-borderSlack} ${W+2*borderSlack} ${H+2*borderSlack}`);

    repaint();

    mainSvg.addEventListener('pointerdown', onStartDragging);
    mainSvg.addEventListener('contextmenu', onRightClick);
    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onEndDragging);
        
}

