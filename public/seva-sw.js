/*
 * Seva counter service worker (Design Book 6.3, 9.11). Registered by components/seva/counter/RegisterServiceWorker.tsx
 * with scope /seva. Seva Entry installs as one app for every role (owner, 2026-10-20) and starts at /seva, where the
 * role landing sends each person on; the worker must control /seva so the counter PC still opens the app offline.
 * Version 2 moved the counter to /seva; `activate` drops the version-1 cache that held the old counter address.
 * Only the counter pages are ever cached.
 *
 * - Counter page navigations: network first; when the line is down or has not answered in 4 s, the last copy of the
 *   page from this cache.
 * - Opening /seva itself (the app's start page): the network, untouched and never cached; only when the network
 *   fails (the PC is offline) the cached counter page. No timeout here: a slow line must not send an admin to the
 *   counter.
 * - Next.js static files (hashed, never change), the install manifest and its icons: cache first.
 * - Everything else, and every /api/* call, goes straight to the network: receipts, sync and sign-in are never cached;
 *   the counter's own IndexedDB outbox handles offline saving.
 *
 * Plain JavaScript, no build step. `routeRequest`, `networkFirst`, `networkOrCounter` and `SEVA_CACHE` are exported for the unit test when `module` exists.
 */
'use strict';

var SEVA_SW_VERSION = '2';
var SEVA_CACHE_PREFIX = 'seva-counter-';
var SEVA_CACHE = SEVA_CACHE_PREFIX + SEVA_SW_VERSION;
var COUNTER_PATH = '/seva/counter';
/** The app's start page (manifest start_url), the role landing. */
var LANDING_PATH = '/seva';
var CACHE_FIRST_FILES = ['/seva-counter.webmanifest', '/favicon.svg', '/favicon.ico'];
var PRECACHE = [COUNTER_PATH].concat(CACHE_FIRST_FILES);
/** A counter page that has not answered in this time is served from the cache, if a copy exists. */
var NETWORK_TIMEOUT_MS = 4000;

/**
 * How the worker answers one request.
 * @param {string | URL} url the request URL
 * @param {string} mode the request mode ('navigate', 'cors', 'no-cors', 'same-origin')
 * @returns {'network-first' | 'network-else-counter' | 'cache-first' | 'bypass'}
 */
function routeRequest(url, mode) {
  var parsed = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  var path = parsed.pathname;
  if (path === '/api' || path.indexOf('/api/') === 0) return 'bypass';
  if (mode === 'navigate' && (path === COUNTER_PATH || path.indexOf(COUNTER_PATH + '/') === 0)) {
    return 'network-first';
  }
  if (mode === 'navigate' && (path === LANDING_PATH || path === LANDING_PATH + '/')) return 'network-else-counter';
  if (path.indexOf('/_next/static/') === 0) return 'cache-first';
  if (CACHE_FIRST_FILES.indexOf(path) !== -1) return 'cache-first';
  return 'bypass';
}

/** A response worth keeping: complete, same-origin and not a redirect (a sign-in redirect must not be cached). */
function cacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic' && !response.redirected;
}

/** The last saved copy of a counter page (or the counter page itself); undefined when none is cached. */
function cachedPage(request) {
  return caches.open(SEVA_CACHE).then(function (cache) {
    return cache.match(request, { ignoreSearch: true }).then(function (hit) {
      return hit || cache.match(COUNTER_PATH);
    });
  });
}

/**
 * Network first, with a timeout (Design Book 9.11: a call that hangs counts as offline). When the network has not
 * answered within NETWORK_TIMEOUT_MS and a cached page exists, the cached page is served; the network answer still
 * refreshes the cache when it arrives. `keepAlive` (event.waitUntil) keeps the worker alive for that refresh.
 */
function networkFirst(request, keepAlive) {
  var network = fetch(request).then(function (response) {
    if (cacheable(response)) {
      var copy = response.clone();
      var saved = caches.open(SEVA_CACHE).then(function (cache) {
        return cache.put(request, copy);
      });
      if (keepAlive) keepAlive(saved.catch(function () { return undefined; }));
    }
    return response;
  });
  if (keepAlive) keepAlive(network.catch(function () { return undefined; }));

  return new Promise(function (resolve) {
    var settled = false;
    function answer(response) {
      if (settled) return;
      settled = true;
      resolve(response);
    }
    var timer = setTimeout(function () {
      cachedPage(request)
        .then(function (hit) {
          if (hit) answer(hit);
        })
        .catch(function () { return undefined; });
    }, NETWORK_TIMEOUT_MS);
    network.then(
      function (response) {
        clearTimeout(timer);
        answer(response);
      },
      function () {
        clearTimeout(timer);
        cachedPage(request)
          .then(function (hit) {
            answer(hit || Response.error());
          })
          .catch(function () {
            answer(Response.error());
          });
      },
    );
  });
}

/**
 * Opening /seva: the network answer as it comes (the role landing's redirect included), never cached. When the network
 * fails because the PC is offline, the cached counter page, so the installed app still opens at the counter.
 */
function networkOrCounter(request) {
  return fetch(request).catch(function () {
    return caches
      .open(SEVA_CACHE)
      .then(function (cache) {
        return cache.match(COUNTER_PATH);
      })
      .then(function (hit) {
        return hit || Response.error();
      })
      .catch(function () {
        return Response.error();
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
    if (route === 'network-first') {
      event.respondWith(
        networkFirst(request, function (promise) {
          event.waitUntil(promise);
        }),
      );
    } else if (route === 'network-else-counter') {
      event.respondWith(networkOrCounter(request));
    } else if (route === 'cache-first') {
      event.respondWith(cacheFirst(request));
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    routeRequest: routeRequest,
    networkFirst: networkFirst,
    networkOrCounter: networkOrCounter,
    NETWORK_TIMEOUT_MS: NETWORK_TIMEOUT_MS,
    SEVA_CACHE: SEVA_CACHE,
  };
}
