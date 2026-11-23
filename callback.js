(function () {
    'use strict';
    var value = location.href;
    document.getElementById('callback').value = value;
    history.replaceState(null, '', location.pathname);
    document.getElementById('copy').onclick = function () {
        navigator.clipboard.writeText(value).then(function () {
            document.getElementById('status').textContent = 'Адрес скопирован.';
        }).catch(function () { document.getElementById('callback').select(); });
    };
}());
