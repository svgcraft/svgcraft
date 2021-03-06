"use strict";

class PdfScreen extends MiniGame {
    constructor(pos, gameState) {
        super(pos, gameState);
        this.currentPage = 1;
    }

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = "PdfScreenCanvas";
        this.canvas.width = 1600;
        this.canvas.height = 900;
        this.canvas.style.position = "absolute";
        this.canvas.style.border = "none";
        this.canvas.style.height = "100%";
        I("midGround").appendChild(this.canvas);
        this.initPdfJs();
        window.addEventListener("keydown", e => {
            if (e.key === "ArrowRight") {
                this.currentPage++;
            } else if (e.key === "ArrowLeft") {
                this.currentPage--;
            } else {
                return;
            }
            if (this.currentPage < 1) {
                this.currentPage = this.pdfDoc.numPages;
            }
            if (this.currentPage > this.pdfDoc.numPages) {
                this.currentPage = 1;
            }
            this.showPage(this.currentPage);
        });
    }

    initPdfJs() {
        const url = '../gitignored_media/presentation2.pdf';

        // Loaded via <script> tag, create shortcut to access PDF.js exports.
        var pdfjsLib = window['pdfjs-dist/build/pdf'];

        // The workerSrc property shall be specified.
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.6.347/build/pdf.worker.min.js';

        // Asynchronous download of PDF
        var loadingTask = pdfjsLib.getDocument(url);
        loadingTask.promise.then(pdf => {
            this.pdfDoc = pdf;
            console.log('PDF loaded');

            this.showPage(this.currentPage);
        }, reason => {
            console.error(reason);
        });

    }

    showPage(pageNumber) {
        console.log(this.pdfDoc.numPages);
        this.pdfDoc.getPage(pageNumber).then(page => {
            console.log('Page loaded');

            var scale = 1.5;
            var viewport = page.getViewport({ scale: scale });

            var context = this.canvas.getContext('2d');
            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;

            var renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            var renderTask = page.render(renderContext);
            renderTask.promise.then(() => {
                console.log('Page rendered');
            });
        });
    }
}
