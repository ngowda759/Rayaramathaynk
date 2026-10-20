/**
 * @jest-environment node
 */
/**
 * A5-FIX F5-1: the counter reports office-refused outbox items (POST counter/refused) and their set-aside by a
 * temple admin (POST counter/refused/set-aside). The guard and the RPC wrapper are mocked; each test calls the route
 * handler with a NextRequest.
 */
import { NextRequest } from 'next/server';
import { SevaError } from '@/lib/seva/errors';
import { sevaErrorResponse } from '@/lib/seva/server/respond';
import type { SevaActor } from '@/lib/seva/permissions';

jest.mock('server-only', () => ({}), { virtual: true });

const mockRequire = jest.fn();
jest.mock('@/lib/seva/server/auth', () => ({
  SEVA_DEVICE_HEADER: 'x-seva-device',
  requireSevaActor: (...args: unknown[]) => mockRequire(...args),
}));
const mockCallRpc = jest.fn();
jest.mock('@/lib/seva/server/rpc', () => ({ callRpc: (...args: unknown[]) => mockCallRpc(...args) }));
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
jest.mock('@/lib/seva/server/identity', () => ({ getIdentityAdapter: () => ({ getAccessProfile: async () => null }) }));
jest.mock('@/lib/admin-firebase', () => ({ getAdminFirestore: async () => ({}) }));

import { POST as refusedPost } from '@/app/api/seva/counter/refused/route';
import { POST as setAsidePost } from '@/app/api/seva/counter/refused/set-aside/route';
import { counterApi } from '@/services/seva/counter.service';

const DEVICE = { id: '6f9619ff-8b86-4d11-b42d-00c04fc964ff', counterId: 1 };
const RAMESH: SevaActor = { staffId: 'staff-ramesh', uid: 'uid-ramesh', role: 'receptionist', viewOnly: false, staffNo: 23, name: 'Ramesh' };
const ADMIN: SevaActor = { staffId: 'staff-admin', uid: 'uid-admin', role: 'temple_admin', viewOnly: false, staffNo: 1, name: 'Admin' };

const REFUSAL = {
  seq: 4,
  kind: 'order',
  code: 'number_conflict',
  receiptNos: ['OF1-023-10-2026/000004', 'OF1-023-10-2026/000005'],
  totalPaise: 21_050,
  refusedAt: '2026-10-20T06:00:00.000Z',
};

function request(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/seva/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockRequire.mockReset();
  mockCallRpc.mockReset();
});

describe('POST /api/seva/counter/refused', () => {
  it("uses the counter's guard and writes one sync.refused row per item in rupees", async () => {
    mockRequire.mockResolvedValue({ ok: true, actor: RAMESH, device: DEVICE });
    mockCallRpc.mockResolvedValue({ duplicate: false });
    const req = request('counter/refused', { items: [REFUSAL] });
    const res = await refusedPost(req);

    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'counter.issue', { device: 'required', retiredDevice: 'allow' });
    expect(mockCallRpc).toHaveBeenCalledWith('seva_note_sync_refused', {
      p_device_id: DEVICE.id,
      p_item: {
        seq: 4,
        kind: 'order',
        code: 'number_conflict',
        receipt_nos: ['OF1-023-10-2026/000004', 'OF1-023-10-2026/000005'],
        total: '210.50',
        refused_at: '2026-10-20T06:00:00.000Z',
      },
      p_staff_id: RAMESH.staffId,
    });
    expect(await res.json()).toEqual({ results: [{ seq: 4, duplicate: false }] });
  });

  it('refuses a bad item before any SQL, and answers the guard when it refuses', async () => {
    mockRequire.mockResolvedValue({ ok: true, actor: RAMESH, device: DEVICE });
    const bad = await refusedPost(request('counter/refused', { items: [{ ...REFUSAL, code: 'Not A Code' }] }));
    expect(bad.status).toBe(400);
    expect(mockCallRpc).not.toHaveBeenCalled();

    mockRequire.mockResolvedValue({ ok: false, response: sevaErrorResponse(new SevaError('view_only')) });
    const denied = await refusedPost(request('counter/refused', { items: [REFUSAL] }));
    expect(denied.status).toBe(403);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});

describe('POST /api/seva/counter/refused/set-aside', () => {
  it('needs gap.resolve from the PC and writes the set-aside with its reason', async () => {
    mockRequire.mockResolvedValue({ ok: true, actor: ADMIN, device: DEVICE });
    mockCallRpc.mockResolvedValue({ duplicate: true });
    const body = { items: [{ ...REFUSAL, reason: 'Entered in the paper book p.14', setAsideAt: '2026-10-20T07:00:00.000Z' }] };
    const req = request('counter/refused/set-aside', body);
    const res = await setAsidePost(req);

    expect(res.status).toBe(200);
    expect(mockRequire).toHaveBeenCalledWith(req, 'gap.resolve', { device: 'required', retiredDevice: 'allow' });
    expect(mockCallRpc).toHaveBeenCalledWith('seva_note_refused_set_aside', {
      p_device_id: DEVICE.id,
      p_item: expect.objectContaining({
        seq: 4,
        total: '210.50',
        reason: 'Entered in the paper book p.14',
        set_aside_at: '2026-10-20T07:00:00.000Z',
      }),
      p_staff_id: ADMIN.staffId,
    });
    expect(await res.json()).toEqual({ results: [{ seq: 4, duplicate: true }] });
  });

  it('refuses a reason under 3 visible characters', async () => {
    mockRequire.mockResolvedValue({ ok: true, actor: ADMIN, device: DEVICE });
    const res = await setAsidePost(
      request('counter/refused/set-aside', { items: [{ ...REFUSAL, reason: ' ​ ', setAsideAt: '2026-10-20T07:00:00.000Z' }] }),
    );
    expect(res.status).toBe(400);
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});

describe('browser client', () => {
  it('posts the reports to the two routes', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      calls.push({ url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    try {
      const api = counterApi(async () => 'token-1', () => 'device.secret');
      await api.reportRefused([{ ...REFUSAL, kind: 'order' }]);
      await api.reportSetAside([{ ...REFUSAL, kind: 'order', reason: 'Paper book', setAsideAt: '2026-10-20T07:00:00.000Z' }]);
    } finally {
      fetchSpy.mockRestore();
    }
    expect(calls.map((c) => c.url)).toEqual(['/api/seva/counter/refused', '/api/seva/counter/refused/set-aside']);
    expect(calls[0].body).toEqual({ items: [REFUSAL] });
  });
});
