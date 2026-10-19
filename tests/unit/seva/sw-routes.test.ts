/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';
import { NETWORK_TIMEOUT_MS, SEVA_CACHE, inSevaScope, networkFirst, networkOrCounter, routeRequest } from '@/public/seva-sw.js';
import { SEVA_ROUTES } from '@/lib/seva/routes';

const site = 'https://site.example';

describe('counter service worker routing', () => {
  it('serves counter navigations under /seva/counter network-first', () => {
    expect(routeRequest(`${site}/seva/counter`, 'navigate')).toBe('network-first');
    expect(routeRequest(`${site}/seva/counter/today`, 'navigate')).toBe('network-first');
    expect(routeRequest(new URL(`${site}/seva/counter?x=1`), 'navigate')).toBe('network-first');

    expect(routeRequest(`${site}/_next/static/chunks/app-1234.js`, 'no-cors')).toBe('cache-first');
    expect(routeRequest(`${site}/_next/static/css/app.css`, 'cors')).toBe('cache-first');
    expect(routeRequest(`${site}/seva-counter.webmanifest`, 'cors')).toBe('cache-first');
    expect(routeRequest(`${site}/favicon.svg`, 'no-cors')).toBe('cache-first');
    expect(routeRequest(`${site}/favicon.ico`, 'no-cors')).toBe('cache-first');

    expect(routeRequest(`${site}/api/seva/counter/orders`, 'cors')).toBe('bypass');
    expect(routeRequest(`${site}/api/seva/counter/bootstrap`, 'navigate')).toBe('bypass');
  });

  it('opens /seva from the network, and from the cached counter page only when the PC is offline', () => {
    expect(routeRequest(`${site}/seva`, 'navigate')).toBe('network-else-counter');
    expect(routeRequest(`${site}/seva/`, 'navigate')).toBe('network-else-counter');
    expect(routeRequest(`${site}/seva?from=app`, 'navigate')).toBe('network-else-counter');
    expect(routeRequest(`${site}/seva?_rsc=abc`, 'cors')).toBe('bypass'); // in-app data fetch
    expect(routeRequest(`${site}/sevas`, 'navigate')).toBe('bypass'); // the public seva page
    expect(routeRequest(`${site}/seva-sw.js`, 'same-origin')).toBe('bypass');
  });

  it('lets /seva/register, /seva/counterfeit and the old /admin/receipts/counter go to the network', () => {
    expect(routeRequest(`${site}/seva/register`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/seva/12345678-aaaa-4bbb-8ccc-1234567890ab`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/seva/counterfeit`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/admin/receipts/counter`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/admin/receipts/counter/today`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/seva/counter?_rsc=abc`, 'cors')).toBe('bypass'); // in-app data fetch
    expect(routeRequest(`${site}/images/logos/social-preview.png`, 'no-cors')).toBe('bypass');
    expect(routeRequest(`${site}/_next/image?url=x`, 'no-cors')).toBe('bypass');
  });

  it('uses cache version 2, so the copy of the old counter address is dropped', () => {
    expect(SEVA_CACHE).toBe('seva-counter-2');
  });
});

describe('counter install manifest', () => {
  it('the manifest installs one Seva Entry app that starts at /seva (role landing) with scope /seva', () => {
    const raw = readFileSync(path.join(process.cwd(), 'public', 'seva-counter.webmanifest'), 'utf8');
    const manifest = JSON.parse(raw) as {
      name: string;
      short_name: string;
      id: string;
      start_url: string;
      scope: string;
      display: string;
      icons: { src: string }[];
    };
    // One app for every role (owner, 2026-10-20), not only the counter.
    expect(manifest.name).toBe('Seva Entry');
    expect(manifest.short_name).toBe('Seva');
    expect(manifest.id).toBe(SEVA_ROUTES.counter);
    // The id stays the counter address, so a counter PC that already installed the app keeps the same app.
    expect(manifest.start_url).toBe(SEVA_ROUTES.dashboard);
    expect(manifest.scope).toBe(SEVA_ROUTES.dashboard);
    expect(manifest.id).toBe('/seva/counter');
    expect(manifest.start_url).toBe('/seva');
    expect(manifest.scope).toBe('/seva');
    expect(manifest.display).toBe('standalone');
    const srcs = manifest.icons.map((i) => i.src);
    expect(srcs).toEqual(expect.arrayContaining(['/favicon.svg', '/favicon.ico']));
    for (const src of srcs) {
      expect(routeRequest(`${site}${src}`, 'no-cors')).toBe('cache-first');
    }
  });
});

describe('/seva opened offline answers with the cached counter page', () => {
  const landing = `${site}/seva`;
  type G = { fetch?: unknown; caches?: unknown };
  const g = globalThis as unknown as G;
  const saved = { fetch: g.fetch, caches: g.caches };

  function fakeCache(cached: Response | undefined) {
    const put = jest.fn(async () => undefined);
    const match = jest.fn<Promise<Response | undefined>, [unknown]>(async () => cached);
    g.caches = { open: jest.fn(async () => ({ match, put })) };
    return { put, match };
  }

  function failingFetch() {
    g.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
  }

  afterEach(() => {
    g.fetch = saved.fetch;
    g.caches = saved.caches;
  });

  it('online: answers with the network response (the role landing) and caches nothing', async () => {
    const { put, match } = fakeCache(new Response('counter'));
    const landingResponse = new Response('landing', { status: 200 });
    g.fetch = jest.fn(async () => landingResponse);
    const answer = await networkOrCounter(new Request(landing));
    expect(answer).toBe(landingResponse);
    expect(put).not.toHaveBeenCalled();
    expect(match).not.toHaveBeenCalled();
  });

  it('offline: answers with the cached /seva/counter page', async () => {
    const { match } = fakeCache(new Response('counter'));
    failingFetch();
    const answer = await networkOrCounter(new Request(landing));
    expect(await answer.text()).toBe('counter');
    expect(match).toHaveBeenCalledWith('/seva/counter');
  });

  it('offline with no counter page cached: a network error, as without the worker', async () => {
    fakeCache(undefined);
    failingFetch();
    expect((await networkOrCounter(new Request(landing))).type).toBe('error');
  });
});

describe('counter page network-first with a timeout', () => {
  const page = `${site}/seva/counter`;
  type G = { fetch?: unknown; caches?: unknown };
  const g = globalThis as unknown as G;
  const saved = { fetch: g.fetch, caches: g.caches };

  function fakeCache(cached: Response | undefined) {
    const put = jest.fn(async () => undefined);
    const cache = { match: jest.fn(async () => cached), put };
    g.caches = { open: jest.fn(async () => cache) };
    return { put };
  }

  /** A same-origin page response as the browser would hand it to the worker. */
  function pageResponse(body: string): Response {
    const r = new Response(body, { status: 200 });
    Object.defineProperty(r, 'type', { value: 'basic' });
    return r;
  }

  afterEach(() => {
    g.fetch = saved.fetch;
    g.caches = saved.caches;
    jest.useRealTimers();
  });

  it('serves the cached page when the network hangs past the timeout', async () => {
    jest.useFakeTimers();
    fakeCache(new Response('cached'));
    g.fetch = jest.fn(() => new Promise<Response>(() => undefined));
    const answer = networkFirst(new Request(page));
    await jest.advanceTimersByTimeAsync(NETWORK_TIMEOUT_MS);
    expect(await (await answer).text()).toBe('cached');
  });

  it('serves and caches the network page when it answers in time', async () => {
    const { put } = fakeCache(new Response('cached'));
    g.fetch = jest.fn(async () => pageResponse('fresh'));
    const waits: Promise<unknown>[] = [];
    const answer = await networkFirst(new Request(page), (p: Promise<unknown>) => waits.push(p));
    expect(await answer.text()).toBe('fresh');
    await Promise.all(waits);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cache when the network fails, and errors when nothing is cached', async () => {
    fakeCache(new Response('cached'));
    g.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await (await networkFirst(new Request(page))).text()).toBe('cached');

    fakeCache(undefined);
    expect((await networkFirst(new Request(page))).type).toBe('error');
  });
});

describe('the worker answers only inside /seva (A4S security gate, L-1)', () => {
  type Listener = (event: unknown) => void;

  /** Runs public/seva-sw.js as a worker would, with a fake `self`, and returns its fetch listener. */
  function loadWorker() {
    const listeners: Record<string, Listener> = {};
    const cache = { match: jest.fn(async () => new Response('cached')), put: jest.fn(async () => undefined) };
    const sandbox = {
      self: {
        addEventListener: (type: string, fn: Listener) => {
          listeners[type] = fn;
        },
        location: { origin: site },
        skipWaiting: jest.fn(),
        clients: { claim: jest.fn() },
      },
      caches: { open: jest.fn(async () => cache), keys: jest.fn(async () => []), delete: jest.fn() },
      fetch: jest.fn(async () => new Response('network')),
      URL,
      Request,
      Response,
      Promise,
      setTimeout,
      clearTimeout,
    };
    const source = readFileSync(path.join(process.cwd(), 'public', 'seva-sw.js'), 'utf8');
    runInNewContext(source, sandbox);
    return { onFetch: listeners.fetch, fetchSpy: sandbox.fetch };
  }

  function fetchEvent(url: string, mode: string) {
    return { request: { method: 'GET', url, mode }, respondWith: jest.fn(), waitUntil: jest.fn() };
  }

  it('a navigation to /sevas (the public seva page) gets no respondWith', () => {
    const { onFetch } = loadWorker();
    expect(typeof onFetch).toBe('function');
    for (const url of [`${site}/sevas`, `${site}/sevas/abc`, `${site}/seva-booking`, `${site}/sevas?x=1`]) {
      const event = fetchEvent(url, 'navigate');
      onFetch(event);
      expect(event.respondWith).not.toHaveBeenCalled();
    }
  });

  it('still answers /seva, the counter pages and the cache-first files it serves', () => {
    const { onFetch } = loadWorker();
    for (const [url, mode] of [
      [`${site}/seva`, 'navigate'],
      [`${site}/seva/counter`, 'navigate'],
      [`${site}/_next/static/chunks/app-1234.js`, 'no-cors'],
      [`${site}/seva-counter.webmanifest`, 'cors'],
      [`${site}/favicon.svg`, 'no-cors'],
    ]) {
      const event = fetchEvent(url, mode);
      onFetch(event);
      expect(event.respondWith).toHaveBeenCalledTimes(1);
    }
  });

  it('inSevaScope accepts exactly /seva, paths under /seva/ and the cache-first files', () => {
    expect(inSevaScope('/seva')).toBe(true);
    expect(inSevaScope('/seva/')).toBe(true);
    expect(inSevaScope('/seva/register')).toBe(true);
    expect(inSevaScope('/_next/static/css/app.css')).toBe(true);
    expect(inSevaScope('/seva-counter.webmanifest')).toBe(true);
    expect(inSevaScope('/favicon.ico')).toBe(true);
    expect(inSevaScope('/sevas')).toBe(false);
    expect(inSevaScope('/seva-sw.js')).toBe(false);
    expect(inSevaScope('/sevabooking')).toBe(false);
    expect(inSevaScope('/')).toBe(false);
  });
});
