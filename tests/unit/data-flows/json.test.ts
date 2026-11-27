/**
 * @jest-environment node
 */
import { jsonEqual, serializeJson, stableStringify } from "@/lib/data-flows/json";

describe("jsonEqual", () => {
  it("ignores an object key whose value is undefined, like JSON.stringify does", () => {
    // A guru without a Rāghavēndra phase is spread into the event with the key
    // present and undefined. JSON drops it on upload, so the read-back check must
    // not treat the in-memory form as different.
    const payload = { a: 1, b: undefined };
    expect(jsonEqual(JSON.parse(serializeJson(payload)), payload)).toBe(true);
  });

  it("treats an undefined array entry as null, like JSON.stringify does", () => {
    const payload = [1, undefined, 2];
    expect(jsonEqual(JSON.parse(serializeJson(payload)), payload)).toBe(true);
  });

  it("is independent of key order", () => {
    expect(jsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("still reports genuinely different payloads", () => {
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(jsonEqual({ a: 1 }, { a: 1, b: null })).toBe(false);
    expect(jsonEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("distinguishes null from a missing key", () => {
    expect(stableStringify({ a: null })).toBe('{"a":null}');
    expect(stableStringify({ a: undefined })).toBe("{}");
  });
});
