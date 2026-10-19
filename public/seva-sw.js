/*
 * Seva counter service worker (Design Book 6.3, 9.11). Registered by components/seva/counter/RegisterServiceWorker.tsx
 * with scope /admin/receipts/counter, so it controls only the counter pages.
 *
 * - Counter page navigations: network first; when the line is down, the last copy of the page from this cache.
 * - Next.js static files (hashed, never change), the install manifest and its icons: cache first.
 * - Everything else, and every /api/* call, goes straight to the network: receipts, sync and sign-in are never cached;
 *   the counter's own IndexedDB outbox handles offline saving.
 *
 * Plain JavaScript, no build step. `routeRequest` is exported for the unit test when `module` exists.
 */
'use strict';

var SEVA_SW_VERSION = '1';
var SEVA_CACHE_PREFIX = 'seva-counter-';
var SEVA_CACHE = SEVA_CACHE_PREFIX + SEVA_SW_VERSION;
var COUNTER_PATH = '/admin/receipts/counter';
var CACHE_FIRST_FILES = ['/seva-counter.webmanifest', '/favicon.svg', '/favicon.ico'];
var PRECACHE = [COUNTER_PATH].concat(CACHE_FIRST_FILES);

/**
 * How the worker answers one request.
 * @param {string | URL} url the request URL
 * @param {string} mode the request mode ('navigate', 'cors', 'no-cors', 'same-origin')
 * @returns {'network-first' | 'cache-first' | 'bypass'}
 */
function routeRequest(url, mode) {
  var parsed = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  var path = parsed.pathname;
  if (path === '/api' || path.indexOf('/api/') === 0) return 'bypass';
  if (mode === 'navigate' && (path === COUNTER_PATH || path.indexOf(COUNTER_PATH + '/') === 0)) {
    return 'network-first';
  }
  if (path.indexOf('/_next/static/') === 0) return 'cache-first';
  if (CACHE_FIRST_FILES.indexOf(path) !== -1) return 'cache-first';
  return 'bypass';
}

/** A response worth keeping: complete, same-origin and not a redirect (a sign-in redirect must not be cached). */
function cacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic' && !response.redirected;
}

function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (cacheable(response)) {
        var copy = response.clone();
        caches.open(SEVA_CACHE).then(function (cache) {
          return cache.put(request, copy);
        });
      }
      return response;
    })
    .catch(function () {
      return caches.open(SEVA_CACHE).then(function (cache) {
        return cache.match(request, { ignoreSearch: true }).then(function (hit) {
          return hit || cache.match(COUNTER_PATH).then(function (shell) {
            return shell || Response.error();
          });
        });
      });
    });
}

function cacheFirst(request) {
  return caches.open(SEVA_CACHE).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (cacheable(response)) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function' && typeof caches !== 'undefined') {
  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches
        .open(SEVA_CACHE)
        .then(function (cache) {
          // One missing file must not stop the worker from installing.
          return Promise.all(
            PRECACHE.map(function (path) {
              return cache.add(new Request(path, { cache: 'reload' })).catch(function () {
                return undefined;
              });
            }),
          );
        })
        .then(function () {
          return self.skipWaiting();
        }),
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (names) {
          return Promise.all(
            names
              .filter(function (name) {
                return name.indexOf(SEVA_CACHE_PREFIX) === 0 && name !== SEVA_CACHE;
              })
              .map(function (name) {
                return caches.delete(name);
              }),
          );
        })
        .then(function () {
          return self.clients.claim();
        }),
    );
  });

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;
    var url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    var route = routeRequest(url, request.mode);
    if (route === 'network-first') event.respondWith(networkFirst(request));
    else if (route === 'cache-first') event.respondWith(cacheFirst(request));
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { routeRequest: routeRequest };
}
