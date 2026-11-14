// 訪問履歴マップ（公開版）Service Worker v4
// HTMLはネットワーク優先。ページ以外への遷移はキャッシュしない。404時はキャッシュ済み本体を返す。
var CACHE_NAME = 'visit-map-v4';
var APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 地図タイル・境界CDN等の外部は素通し
  // ページ遷移として扱うのは、アプリのルートと index.html への遷移だけに限定する
  var scopePath = new URL(self.registration.scope).pathname;
  var isPage = req.mode === 'navigate' && (url.pathname === scopePath || url.pathname === scopePath + 'index.html');
  if (isPage) {
    event.respondWith(
      fetch(req).then(function (res) {
        var type = res && res.headers ? (res.headers.get('content-type') || '') : '';
        if (res && res.ok && type.indexOf('text/html') !== -1) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put('./index.html', copy); });
          return res;
        }
        // 404など正常でない応答はそのまま返さず、キャッシュ済みの本体を返す
        return caches.match('./index.html').then(function (cached) {
          return cached || res;
        });
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
