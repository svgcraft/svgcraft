"use strict";

function fillCircle(context, centerX, centerY, radius) {
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    context.fill();
}

var clickedColorButtonId = null;

function open_color_dialog(e) {
    clickedColorButtonId = e.target.getAttribute("id");
    console.log(clickedColorButtonId);
    I("color_picker").style.display = 'block';
}

function init_color_picker() {
    const R1 = 50;
    const R2 = 450;
    const R3 = 460;
    const pos2color = (x, y) => {
        const r = Math.sqrt(x*x + y*y);
        const alpha = Math.atan2(y, x);
        var s = `hsl(0, 100%, 100%)`;
        if (r >= R1) {
            s = `hsl(${alpha/Math.PI*180}, 100%, ${100-(r-R1)/(R2-R1)*100}%)`;
        }
        if (r >= R2) {
            s = `hsl(0, 0%, 0%)`;
        }
        return s;
    };
    const D = 3;
    const canvas = I('color_wheel');
    canvas.setAttribute("width", 2*R3);
    canvas.setAttribute("height", 2*R3);
    const ctx = canvas.getContext('2d');
    ctx.translate(R3, R3);
    ctx.fillStyle = `hsl(0, 0, 0)`;
    fillCircle(ctx, 0, 0, R3);
    for (var x = -R3 + D/2.0; x < R3; x += D) {
        for (var y = -R3 + D/2.0; y < R3; y += D) {
            const r = Math.sqrt(x*x + y*y);
            if (r >= R2) continue;
            ctx.fillStyle = pos2color(x, y);
            ctx.fillRect(x-D/2, y-D/2, D, D);
        }
    }

    // I("pick-stroke-color").onclick = open_color_dialog;
    I("pick-fill-color").onclick = open_color_dialog;
    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left)/rect.width - 0.5) * 2 * R3;
        const y = ((e.clientY - rect.top)/rect.height - 0.5) * 2 * R3;
        const c = pos2color(x, y);
        I(clickedColorButtonId).style.backgroundColor = c;
        console.log(c, I(clickedColorButtonId).style.backgroundColor);
        I("color_picker").style.display = 'none';
    };
}
