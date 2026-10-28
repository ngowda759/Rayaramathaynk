/** @jest-environment node */

import { escapeLikePattern, ilikeContainsFilter, quoteFilterValue } from "@/lib/supabase/filters";

describe("PostgREST filter escaping", () => {
  it("quotes and backslash-escapes reserved characters", () => {
    expect(quoteFilterValue("plain")).toBe('"plain"');
    expect(quoteFilterValue("a,b")).toBe('"a,b"');
    expect(quoteFilterValue("a.b(c)")).toBe('"a.b(c)"');
    expect(quoteFilterValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteFilterValue("back\\slash")).toBe('"back\\\\slash"');
  });

  it("escapes LIKE wildcards so a literal % or _ matches itself", () => {
    expect(escapeLikePattern("50%_off")).toBe("50\\%\\_off");
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("builds an inert ilike contains filter", () => {
    // A typed comma must not split the expression into a second condition.
    expect(ilikeContainsFilter("title", "a,b")).toBe('title.ilike."%a,b%"');
    // A typed percent must be a literal percent: LIKE needs `\%`, and the PostgREST
    // quoted value needs `\\` for that backslash, so the wire form is `\\%`.
    expect(ilikeContainsFilter("content", "100%")).toBe('content.ilike."%100\\\\%%"');
  });
});
