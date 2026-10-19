/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import path from 'path';
import { routeRequest } from '@/public/seva-sw.js';

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
