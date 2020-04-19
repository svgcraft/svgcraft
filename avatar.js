"use strict";

log.debug(twemoji.convert.toCodePoint("🐸"));

log.debug(twemoji.parse("🐸", {
  folder: 'svg',
  ext: '.svg'
}));

function get_emoji_url(s) {
    return `${twemoji.base}svg/${twemoji.convert.toCodePoint(s)}.svg`;
}

// Note: needs v2 to obtain https://twemoji.maxcdn.com/2/svg/1f9d9-1f3fc-200d-2642-fe0f.svg
// Use https://emojipedia.org/twitter/ as the emoji picker
log.debug(get_emoji_url("🧙🏼‍♂️"));

class Avatar {

    // Note: avatar id (string) is implied by key in avatar map, but we also want it as a field
    constructor(id) {
        this.emojiUtf = "🙂";
        this.pos = new Point();
        this.hue = Date.now() % 360;
        this.id = id;
        this.view = {x: 0, y: 0, scale: 1.0};
    }

    get emojiUrl() {
        return get_emoji_url(this.emojiUtf);
    }

    get color() {
        return `hsl(${this.hue}, 100%, 50%)`;
    }

    get g() {
        return I(this.id);
    }
}

Avatar.radius = 35;
Avatar.pointerRadius = Avatar.radius * 1.9;
Avatar.pointerBaseWidth = Avatar.radius * 1.6;
