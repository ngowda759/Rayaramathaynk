/**
 * @jest-environment node
 */
import { createFakeSevaApi } from "../../e2e/seva/fixtures/fake-api";
import type { CounterOrderPayload, IssueResponse } from "@/types/seva";

const NOW = "2026-10-18T05:00:00.000Z"; // 10:30 IST

function order(clientOrderId: string, sevaDates: string[] = ["2026-10-18"]): CounterOrderPayload {
  return {
    clientOrderId,
    devotee: { name: "Ramesh Rao", gotra: { text: "Kashyapa" } },
    receipts: sevaDates.map((sevaDate, i) => ({
      clientReceiptId: `${clientOrderId}-r${i + 1}`,
      sevaDate,
      qrToken: `tok${clientOrderId}${i}`.padEnd(22, "x").slice(0, 22),
      lines: [{ sevaId: "seva-archana", quantity: 1 }],
    })),
    payment: { mode: "cash", cashReceivedPaise: 100000 },
    expectedTotalPaise: 5000 * sevaDates.length,
  };
}

describe("fake seva API", () => {
  it("issues sequential C1 numbers and repeats the same receipts for a repeated clientOrderId", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);

    const first = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-1", ["2026-10-18", "2026-10-19"]), role: "receptionist" });
    expect(first.kind).toBe("json");
    const firstBody = (first.kind === "json" ? first.body : null) as IssueResponse;
    expect(first.kind === "json" && first.status).toBe(200);
    expect(firstBody.duplicate).toBe(false);
    expect(firstBody.receipts.map((r) => r.receiptNo)).toEqual(["C1-023-10-2026/000001", "C1-023-10-2026/000002"]);
    expect(firstBody.receipts.map((r) => [r.position, r.count])).toEqual([[1, 2], [2, 2]]);
    expect(firstBody.receipts[0].orderTotalPaise).toBe(10000);

    const repeat = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-1", ["2026-10-18", "2026-10-19"]), role: "receptionist" });
    const repeatBody = (repeat.kind === "json" ? repeat.body : null) as IssueResponse;
    expect(repeatBody.duplicate).toBe(true);
    expect(repeatBody.receipts.map((r) => r.receiptNo)).toEqual(["C1-023-10-2026/000001", "C1-023-10-2026/000002"]);
    expect(repeatBody.orderId).toBe(firstBody.orderId);

    const next = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-2"), role: "receptionist" });
    const nextBody = (next.kind === "json" ? next.body : null) as IssueResponse;
    expect(nextBody.receipts[0].receiptNo).toBe("C1-023-10-2026/000003");
    expect(api.state.lastNo.C1).toBe(3);
    expect(api.state.receipts).toHaveLength(3);
  });

  it("refuses an order whose expected total no longer matches the catalogue and writes nothing", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);
    const stale = { ...order("o-stale"), expectedTotalPaise: 4000 };
    const res = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: stale, role: "receptionist" });
    expect(res).toEqual({
      kind: "json",
      status: 409,
      body: { error: { code: "price_changed", message: "The rate changed - check the total." } },
    });
    expect(api.state.receipts).toHaveLength(0);
  });

  it("fails the next matching call once with the given kind", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);
    api.failNext("counter/orders", { status: 409, code: "price_changed" });
    api.failNext("/api/seva/counter/bootstrap", "timeout");
    api.failNext("me", "network");

    const failed = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-1"), role: "receptionist" });
    expect(failed).toEqual({
      kind: "json",
      status: 409,
      body: { error: { code: "price_changed", message: "The rate changed - check the total." } },
    });
    expect(api.state.receipts).toHaveLength(0);

    const retried = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-1"), role: "receptionist" });
    expect(retried.kind === "json" && retried.status).toBe(200);

    expect(await api.handle({ method: "GET", path: "/api/seva/counter/bootstrap", body: null, role: "receptionist" })).toEqual({ kind: "abort", reason: "timedout" });
    const bootstrap = await api.handle({ method: "GET", path: "/api/seva/counter/bootstrap", body: null, role: "receptionist" });
    expect(bootstrap.kind === "json" && bootstrap.status).toBe(200);

    expect(await api.handle({ method: "GET", path: "/api/seva/me", body: null, role: "receptionist" })).toEqual({ kind: "abort", reason: "failed" });
    const me = await api.handle({ method: "GET", path: "/api/seva/me", body: null, role: "receptionist" });
    expect(me.kind === "json" && me.status).toBe(200);
  });

  it("records every request", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);
    api.failNext("me", "network");
    await api.handle({ method: "GET", path: "/api/seva/me", body: null, role: "receptionist" });
    await api.handle({ method: "GET", path: "/api/seva/receipts?status=issued", body: null, role: "temple_admin" });
    const body = order("o-9");
    await api.handle({ method: "POST", path: "/api/seva/counter/orders", body, role: "receptionist" });
    await api.handle({ method: "GET", path: "/api/seva/no-such-route", body: null, role: "receptionist" });

    expect(api.requests).toEqual([
      { method: "GET", path: "/api/seva/me", body: null },
      { method: "GET", path: "/api/seva/receipts?status=issued", body: null },
      { method: "POST", path: "/api/seva/counter/orders", body },
      { method: "GET", path: "/api/seva/no-such-route", body: null },
    ]);
  });

  it("answers per role, blocks view-only writes and refuses calls without a role", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);
    const me = await api.handle({ method: "GET", path: "/api/seva/me", body: null, role: "temple_admin_view_only" });
    expect(me.kind === "json" && me.body).toMatchObject({ role: "temple_admin", viewOnly: true });

    const write = await api.handle({ method: "PUT", path: "/api/seva/settings/rules", body: {}, role: "temple_admin_view_only" });
    expect(write.kind === "json" && write.status).toBe(403);
    expect(write.kind === "json" && write.body).toMatchObject({ error: { code: "view_only" } });

    const prasadamAtCounter = await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-p"), role: "prasadam_counter" });
    expect(prasadamAtCounter.kind === "json" && prasadamAtCounter.body).toMatchObject({ error: { code: "forbidden" } });

    const anonymous = await api.handle({ method: "GET", path: "/api/seva/me", body: null });
    expect(anonymous.kind === "json" && anonymous.status).toBe(401);
  });

  it("lets a UI task add or override a route through extend", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);
    api.extend({
      "GET reports/festival": (req) => ({ festival: "Aaradhane", path: req.path }),
    });
    const res = await api.handle({ method: "GET", path: "/api/seva/reports/festival?id=3", body: null, role: "temple_admin" });
    expect(res).toEqual({ kind: "json", status: 200, body: { festival: "Aaradhane", path: "/api/seva/reports/festival?id=3" } });
  });

  it("finds a receipt for the prasadam counter by number and marks it given", async () => {
    const api = createFakeSevaApi();
    api.setNow(NOW);
    await api.handle({ method: "POST", path: "/api/seva/counter/orders", body: order("o-1"), role: "receptionist" });

    const lookup = await api.handle({ method: "GET", path: "/api/seva/prasadam/lookup?q=C1%201", body: null, role: "prasadam_counter" });
    expect(lookup.kind === "json" && lookup.body).toMatchObject({ state: "ready", receipt: { receiptNo: "C1-023-10-2026/000001" } });
    expect(JSON.stringify(lookup.kind === "json" ? lookup.body : null)).not.toMatch(/Paise|amount|total/i);

    const id = api.state.receipts[0].id;
    const given = await api.handle({ method: "POST", path: "/api/seva/prasadam/give", body: { receiptId: id, confirmOffDate: false }, role: "prasadam_counter" });
    expect(given.kind === "json" && given.body).toMatchObject({ state: "already_given" });
    expect(api.state.receipts[0].prasadam).toBe("given");
  });
});
