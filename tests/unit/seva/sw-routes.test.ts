/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import path from 'path';
import { NETWORK_TIMEOUT_MS, networkFirst, routeRequest } from '@/public/seva-sw.js';

const site = 'https://site.example';

describe('counter service worker routing', () => {
  it('routes counter pages network-first, static files cache-first and API calls straight through', () => {
    expect(routeRequest(`${site}/admin/receipts/counter`, 'navigate')).toBe('network-first');
    expect(routeRequest(`${site}/admin/receipts/counter/today`, 'navigate')).toBe('network-first');
    expect(routeRequest(new URL(`${site}/admin/receipts/counter?x=1`), 'navigate')).toBe('network-first');

    expect(routeRequest(`${site}/_next/static/chunks/app-1234.js`, 'no-cors')).toBe('cache-first');
    expect(routeRequest(`${site}/_next/static/css/app.css`, 'cors')).toBe('cache-first');
    expect(routeRequest(`${site}/seva-counter.webmanifest`, 'cors')).toBe('cache-first');
    expect(routeRequest(`${site}/favicon.svg`, 'no-cors')).toBe('cache-first');
    expect(routeRequest(`${site}/favicon.ico`, 'no-cors')).toBe('cache-first');

    expect(routeRequest(`${site}/api/seva/counter/orders`, 'cors')).toBe('bypass');
    expect(routeRequest(`${site}/api/seva/counter/bootstrap`, 'navigate')).toBe('bypass');
  });

  it('leaves everything else to the network', () => {
    expect(routeRequest(`${site}/admin/receipts`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/admin/receipts/counterfeit`, 'navigate')).toBe('bypass');
    expect(routeRequest(`${site}/admin/receipts/counter?_rsc=abc`, 'cors')).toBe('bypass'); // in-app data fetch
    expect(routeRequest(`${site}/images/logos/social-preview.png`, 'no-cors')).toBe('bypass');
    expect(routeRequest(`${site}/_next/image?url=x`, 'no-cors')).toBe('bypass');
  });
});

describe('counter install manifest', () => {
  it('opens the counter as its own window with the site icons', () => {
    const raw = readFileSync(path.join(process.cwd(), 'public', 'seva-counter.webmanifest'), 'utf8');
    const manifest = JSON.parse(raw) as {
      name: string;
      start_url: string;
      scope: string;
      display: string;
      icons: { src: string }[];
    };
    expect(manifest.name).toBe('Seva Counter');
    expect(manifest.start_url).toBe('/admin/receipts/counter');
    expect(manifest.scope).toBe('/admin/receipts/counter');
    expect(manifest.display).toBe('standalone');
    const srcs = manifest.icons.map((i) => i.src);
    expect(srcs).toEqual(expect.arrayContaining(['/favicon.svg', '/favicon.ico']));
    for (const src of srcs) {
      expect(routeRequest(`${site}${src}`, 'no-cors')).toBe('cache-first');
    }
  });
});

describe('counter page network-first with a timeout', () => {
  const page = `${site}/admin/receipts/counter`;
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
