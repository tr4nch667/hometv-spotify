(function () {
    'use strict';
    var original = location.href, url = new URL(original), box = document.getElementById('callback'), button = document.getElementById('copy'), status = document.getElementById('status'), session;
    function bytes(s) { return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), function (c) { return c.charCodeAt(0); }); }
    function b64(a) { return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function localRelay(value) {
        try {
            var u = new URL(value), parts = u.hostname.split('.').map(Number);
            return u.protocol === 'http:' && u.port === '8139' && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/' &&
                parts.length === 4 && parts.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= 255; }) &&
                (parts[0] === 10 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168);
        } catch (_) { return false; }
    }
    function valid(p) {
        return p && /^[a-f0-9]{32}$/i.test(p.i) && ['c', 's', 'k'].every(function (k) { return /^[A-Za-z0-9_-]{43}$/.test(p[k]); }) && /^[A-Za-z0-9_-]{32}$/.test(p.t) && localRelay(p.b);
    }
    function screen(title, text, action) {
        document.querySelector('h1').textContent = title;
        document.querySelector('main > p').textContent = text;
        box.hidden = true; button.textContent = action;
    }
    history.replaceState(null, '', location.pathname);
    try {
        if (url.hash.indexOf('#pair=') === 0) {
            session = JSON.parse(new TextDecoder().decode(bytes(url.hash.slice(6))));
            if (!valid(session)) throw new Error('Invalid pairing');
            session.expires = Date.now() + 600000;
            sessionStorage.setItem('hometv.spotify.pair.v1', JSON.stringify(session));
            screen('Войти в Spotify', 'Войдите на телефоне. После входа вы вернётесь сюда для подключения HomeTV.', 'Войти в Spotify');
            button.onclick = function () {
                if (Date.now() > session.expires) { status.textContent = 'Время входа истекло. Отсканируйте новый QR-код.'; return; }
                location.assign('https://accounts.spotify.com/authorize?' + new URLSearchParams({
                    client_id: session.i, response_type: 'code', redirect_uri: url.origin + url.pathname,
                    scope: 'user-read-playback-state user-modify-playback-state', code_challenge_method: 'S256', code_challenge: session.c, state: session.s
                }).toString());
            };
            return;
        }
        session = JSON.parse(sessionStorage.getItem('hometv.spotify.pair.v1') || 'null');
        if (session && (!valid(session) || session.expires < Date.now())) { sessionStorage.removeItem('hometv.spotify.pair.v1'); session = null; }
        if (session && (url.searchParams.has('code') || url.searchParams.has('error'))) {
            if (url.searchParams.get('state') !== session.s) throw new Error('Invalid state');
            screen('Передать вход на ТВ', 'Телефон и ПК должны быть в одной домашней сети. Подтверждение передаётся в зашифрованном виде.', 'Передать телевизору');
            button.onclick = function () {
                if (Date.now() > session.expires) { status.textContent = 'Время входа истекло. Начните подключение заново.'; return; }
                button.disabled = true;
                var iv = crypto.getRandomValues(new Uint8Array(12));
                crypto.subtle.importKey('raw', bytes(session.k), 'AES-GCM', false, ['encrypt']).then(function (key) {
                    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: new TextEncoder().encode(session.t) }, key, new TextEncoder().encode(original));
                }).then(function (cipher) {
                    var packet = new Uint8Array(12 + cipher.byteLength); packet.set(iv); packet.set(new Uint8Array(cipher), 12);
                    location.assign(session.b + '/complete/' + session.t + '?payload=' + b64(packet));
                }).catch(function () { button.disabled = false; status.textContent = 'Не удалось зашифровать подтверждение. Попробуйте снова.'; });
            };
            return;
        }
    } catch (_) {
        screen('Начните подключение заново', 'Отсканируйте новый QR-код с телевизора в обычном браузере телефона.', 'Вход недоступен');
        button.disabled = true;
        return;
    }
    box.value = original;
    button.onclick = function () {
        if (!navigator.clipboard) { box.select(); return; }
        navigator.clipboard.writeText(original).then(function () { status.textContent = 'Адрес скопирован.'; }).catch(function () { box.select(); });
    };
}());
