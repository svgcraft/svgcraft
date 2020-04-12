"use strict";

function init_avatar_picker() {
    const hues = {'🙂': 230, '🤠': 0, '😎': 200, '🤓': 270, '👽': 50, '😺': 170, '👨': 230, '🧔': 230, '🧒': 230, '👦': 220, '👧': 230, '🧑': 220, '👩': 230, '👩‍🦱': 230, '🧑‍🎓': 100, '🧑‍🏫': 230, '🧑‍⚖️': 0, '🧑‍🌾': 195, '🧑‍🍳': 300, '🧑‍🔧': 0, '🧑‍🏭': 0, '🧑‍💻': 230, '🧑‍🎨': 230, '🧕': 60, '🧙🏼‍♂️': 120, '🧜‍♀️': 280, '🐵': 90, '🦍': 90, '🦧': 90, '🐶': 230, '🐺': 340, '🦊': 230, '🦝': 230, '🦁': 40, '🐴': 230, '🦓': 230, '🐮': 90, '🐷': 90, '🐭': 90, '🐹': 90, '🐰': 90, '🐻': 90, '🐨': 90, '🐥': 90, '🐧': 180, '🦅': 200, '🦉': 200, '🐸': 0, '🐊': 50, '🐠': 230, '🦋': 90, '🦂': 60, '🦀': 60, '🦞': 60};

    for (const emojiUtf in hues) {
        const d = document.createElement('div');
        d.setAttribute("class", "avatar_preview");
        d.style.backgroundColor = `hsl(${hues[emojiUtf]}, 100%, 50%)`;
        d.style.backgroundImage = `url(${get_emoji_url(emojiUtf)})`;
        d.onclick = (e) => {
            I("avatar_picker").style.display = 'none';
            const u = {
                action: "upd",
                id: app.avatarId,
                hue: hues[emojiUtf],
                emojiUtf: emojiUtf
            };
            if (app != null && app.avatarId != null) {
                // things are loaded and we can post update:
                app.post(u);
            } else {
                // save update for later:
                pending_avatar_update = u;
            }
        };
        I("avatar_previews").appendChild(d);
    }
}
