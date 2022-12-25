'use strict';

function packwords(dom, wordlist) {
    const thinLineWidth = 0.04;
    const thickLineWidth = 0.08;
    const borderSlack = 1.2;
    const gridLineColor = "gray";
    const wordBackgroundColor = "#dedede";
    const wordFrameColor = "black";
    const textHeight = 0.7;
    const negativeSquareColor = "#ff3333";
    const positiveSquareColor = "#00b300";


    function paintGrid() {
        const attrs = {
            x1: gridLeft,
            x2: gridRight,
            stroke: gridLineColor,
            "stroke-width": thinLineWidth,
            "stroke-linecap": "square"
        };
        for (var row = Math.floor(gridTop); row <= gridBottom; row++) {
            attrs.y1 = row;
            attrs.y2 = row;
            mainSvg.appendChild(dom.svg("line", attrs));
        }
        attrs.y1 = gridTop;
        attrs.y2 = gridBottom;
        for (var col = Math.floor(gridLeft); col <= gridRight; col++) {
            attrs.x1 = col;
            attrs.x2 = col;
            mainSvg.appendChild(dom.svg("line", attrs));
        }
    }

    function paintBoundingBox(dimensions) {
        const [x1, y1, x2, y2] = dimensions;
        const attrs = { 
            x: x1,
            y: y1, 
            width: x2 - x1, 
            height: y2 - y1,
            stroke: gridLineColor,
            "stroke-width": thickLineWidth,
            fill: "none"
        };
        mainSvg.appendChild(dom.svg("rect", attrs));
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
        get width() {
            return this.isDown ? 1 : this.word.length;
        }
        get height() {
            return this.isDown ? this.word.length : 1;
        }
        get x2() {
            return this.x + this.width;
        }
        get y2() {
            return this.y + this.height;
        }
        atPos(x, y) {
            return new Word(x, y, this.word, this.isDown);
        }
        coversPos(x, y) {
            return this.x <= x && x < this.x2 && this.y <= y && y < this.y2;
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

    class Grid {
        constructor(dimensions, defaultValue) {
            const [x1, y1, x2, y2] = dimensions;
            const grid = [];
            for (var y = y1; y < y2; y++) {
                grid.push(Array(x2-x1).fill(defaultValue));
            }
            this.grid = grid;
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
        }
        get(x, y) {
            return this.grid[y-this.y1][x-this.x1];
        }
        set(x, y, v) {
            this.grid[y-this.y1][x-this.x1] = v;
        }
        get dimensions() {
            return [this.x1, this.y1, this.x2, this.y2];
        }
        get width() {
            return this.x2 - this.x1;
        }
        get height() {
            return this.y2 - this.y1;
        }
    }

    function paintScoreSquares(scoreGrid) {
        for (var y = scoreGrid.y1; y < scoreGrid.y2; y++) {
            for (var x = scoreGrid.x1; x < scoreGrid.x2; x++) {
                if (scoreGrid.get(x, y) != 0) {
                    const attrs = { 
                        x: x, 
                        y: y, 
                        width: 1,
                        height: 1,
                        stroke: "none",
                        fill: scoreGrid.get(x, y) < 0 ? negativeSquareColor : positiveSquareColor
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

    function boundingBoxOfWords(wordObjs) {
        var x1 = Number.POSITIVE_INFINITY;
        var y1 = Number.POSITIVE_INFINITY;
        var x2 = Number.NEGATIVE_INFINITY;
        var y2 = Number.NEGATIVE_INFINITY;
        for (var w of wordObjs) {
            x1 = Math.min(x1, w.x);
            y1 = Math.min(y1, w.y);
            x2 = Math.max(x2, w.x2);
            y2 = Math.max(y2, w.y2);
        }
        return [x1, y1, x2, y2];
    }

    // Returns a grid of strings, each the concatenation of all letters on that cell
    function computeOccupancy(wordObjs) {
        const occ = new Grid(boundingBoxOfWords(wordObjs), "");
        for (w of wordObjs) {
            for (var i = 0; i < w.word.length; i++) {
                const x = w.x + (w.isDown ? 0 : i);
                const y = w.y + (w.isDown ? i : 0);
                occ.set(x, y, occ.get(x, y).concat(w.word[i]));
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
        const scoreGrid = new Grid(occ.dimensions, 0);
        for (var y = occ.y1; y < occ.y2; y++) {
            for (var x = occ.x1; x < occ.x2; x++) {
                const s = occ.get(x, y);
                if (containsDifferentLetters(s)) {
                    scoreGrid.set(x, y, -1);
                } else if (s.length > 1) {
                    scoreGrid.set(x, y, s.length - 1);
                }
            }
        }
        return scoreGrid;
    }

    function scoreOfScoreGrid(scoreGrid) {
        var sum = 0;
        for (var y = scoreGrid.y1; y < scoreGrid.y2; y++) {
            for (var x = scoreGrid.x1; x < scoreGrid.x2; x++) {
                sum += scoreGrid.get(x, y);
            }
        }
        return sum * 100 - scoreGrid.width * scoreGrid.height;
    }

    function makeCompactSolution(W, H) {
        const gridLetters = new Grid([0, 0, W, H], null);
        const usedWords = new Set();
        const wordObjs = new Set();

        function placeWord(x, y, word, isDown) {
            wordObjs.add(new Word(x, y, word, isDown));
            usedWords.add(word);
            const dx = isDown ? 0 : 1;
            const dy = isDown ? 1 : 0;
            for (var i = 0; i < word.length; i++) {
                gridLetters.set(x, y, word[i]);
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
                if (gridLetters.get(x, y) === word[i]) {
                    score++;
                } else if (gridLetters.get(x, y) !== null) {
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
        var remainingDown = nDown - 1;
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

    function arrangeInStartPos(original, count) {
        var maxWordLen = 0;
        for (var w of original) {
            maxWordLen = Math.max(maxWordLen, w.word.length);
        }
        const W = maxWordLen + 2;
        const H = maxWordLen + count - 2;
        const arranged = new Set();
        var putAtTop = true;
        var topY = 0;
        var botY = H - 1;
        for (var w of original) {
            var wnew;
            if (putAtTop) {
                wnew = w.atPos(0, topY);
                topY++;
            } else {
                wnew = w.atPos(W-w.word.length, botY)
                botY--;
            }
            wnew.isDown = false;
            arranged.add(wnew);
            putAtTop = !putAtTop;
        }
        return arranged;
    }

    function findWordAt(x, y, wordObjs) {
        for (var w of wordObjs) {
            if (w.coversPos(x, y)) return w;
        }
    }

    function eventToRelCoords(e) {
        const r = mainSvgWrapper.getBoundingClientRect();
        const x = e.pageX - r.left - translateX;
        const y = e.pageY - r.top - translateY;
        return [x / scale, y / scale];
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

    var translateX;
    var translateY;
    var scale;
    var gridLeft;
    var gridTop;
    var gridRight;
    var gridBottom;

    function setTransform(dimensions) {
        const [x1, y1, x2, y2] = dimensions;
        const r = mainSvgWrapper.getBoundingClientRect();
        const w = 2 * borderSlack + x2 - x1;
        const h = 2 * borderSlack + y2 - y1;
        const wscale = r.width/w;
        const hscale = r.height/h;
        if (wscale < hscale) {
            scale = wscale;
            translateX = (-x1 + borderSlack) * scale;
            translateY = (-y1 + borderSlack) * scale + (r.height - scale * h) / 2;
            gridLeft = x1 - borderSlack;
            gridRight = x2 + borderSlack;
            gridTop = y1 - borderSlack - (r.height / scale - h) / 2;
            gridBottom = y2 + borderSlack + (r.height / scale - h) / 2;
        } else {
            scale = hscale;
            translateX = (-x1 + borderSlack) * scale + (r.width - scale * w) / 2;
            translateY = (-y1 + borderSlack) * scale;
            gridLeft = x1 - borderSlack - (r.width / scale - w) / 2;
            gridRight = x2 + borderSlack + (r.width / scale - w) / 2;
            gridTop = y1 - borderSlack;
            gridBottom = y2 + borderSlack;
        }
        const t = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        mainSvg.style.transform = t;
    }

    function repaint() {
        const occ = computeOccupancy(current);
        const scoreGrid = occupancyToScoreGrid(occ);
        mainSvg.replaceChildren();
        setTransform(scoreGrid.dimensions);
        paintWordRects(current, "none", wordBackgroundColor);
        paintScoreSquares(scoreGrid);
        paintGrid();
        paintBoundingBox(scoreGrid.dimensions);
        paintWordRects(current, wordFrameColor, "none");    
        paintLetters(current);
        scoreSpan.innerHTML = scoreOfScoreGrid(scoreGrid);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const seedParam = urlParams.get("seed") ?? 'random';
    const seed = String(seedParam == 'random' ? Math.random() : seedParam);
    const rng = new Math.seedrandom(seed);
    const minWordLength = urlParams.get("minWordLength") ?? 3;
    const maxWordLength = urlParams.get("maxWordLength") ?? 100000;
    const customWords = urlParams.has("customWords") ? urlParams.get("customWords").split(",") : null;
    const nAcross = urlParams.get("nAcross") ?? 4;
    const nDown = urlParams.get("nDown") ?? 3;

    const filteredWords = [];
    for (var w of wordlist) {
        if (minWordLength <= w.length && w.length <= maxWordLength) {
            filteredWords.push(w.toUpperCase());
        }
    }

    var solution = null;
    var current = null;

    if (customWords) {
        current = arrangeInStartPos(customWords.map(w => new Word(0, 0, w, false)), customWords.length);
    } else {
        solution = makeCompactSolution(9, 14);
        current = arrangeInStartPos(solution, solution.size);
    }

    const mainSvg = document.getElementById("mainSvg");
    const mainSvgWrapper = document.getElementById("mainSvgWrapper");
    const scoreSpan = document.getElementById("scoreSpan");

    repaint();

    mainSvg.addEventListener('pointerdown', onStartDragging);
    mainSvg.addEventListener('contextmenu', onRightClick);
    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onEndDragging);
        
}

