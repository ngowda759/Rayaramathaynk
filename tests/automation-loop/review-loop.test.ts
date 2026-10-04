import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildComment,
  buildFixContext,
  buildReviewRequestBody,
  classifyCi,
  ciFindings,
  coerceVerdict,
  decisionFor,
  extractOutputText,
  normalizeModelReport,
  parseModelJson,
  planReview,
  resolveApiKey,
  resolveReviewModel,
  reviewApiKeyEnvVar,
  reviewEndpoint,
  reviewMarker,
  reviewModelEnvVar,
  reviewedHeads,
  validateReport,
} from "../../.ai/scripts/review-core.mjs";

/**
 * The review stage of the AI development loop.
 *
 * An external reviewer model is the reviewer and Jules is the fixer, so the
 * loop's decision rules are the contract that keeps those two apart. They are
 * pure functions, so they are tested directly. The two network boundaries — `gh`
 * and the configured reviewer Responses API (OpenRouter's free router by
 * default) — are exercised through the CLI with canned inputs; neither the
 * reviewer nor Jules is ever called.
 */

const root = resolve(process.cwd());
const REQUIRED_CHECKS = ["Lint, typecheck, test, build"];

const PASS_CHECK = {
  name: "Lint, typecheck, test, build",
  state: "SUCCESS",
  bucket: "pass",
};
const FAIL_CHECK = {
  name: "Lint, typecheck, test, build",
  state: "FAILURE",
  bucket: "fail",
};
const PENDING_CHECK = {
  name: "Lint, typecheck, test, build",
  state: "IN_PROGRESS",
  bucket: "pending",
};

/** A well-formed model report, so each test can vary exactly one field. */
function modelReport(overrides = {}) {
  return {
    verdict: "approved",
    summary: "The change does what the brief asks and CI is green.",
    findings: [],
    ...overrides,
  };
}

function facts(overrides = {}) {
  return {
    taskId: "AI-002-T1",
    pr: 25,
    round: 1,
    headSha: "abcdef1234567890abcdef1234567890abcdef12",
    ciStatus: "success",
    reviewedAt: "2026-09-30T10:00:00Z",
    ...overrides,
  };
}

describe("review rounds and head de-duplication", () => {
  const head = "abc1234def5678abc1234def5678abc1234def56";

  it("reviews a fresh head as round 1", () => {
    const plan = planReview({
      comments: [],
      headSha: head,
      maxReviewRounds: 3,
    });
    expect(plan).toMatchObject({ action: "review", round: 1 });
  });

  it("never reviews the same head SHA twice", () => {
    const comments = [{ body: reviewMarker(1, head, "changes-requested") }];
    const plan = planReview({ comments, headSha: head, maxReviewRounds: 3 });
    expect(plan.action).toBe("skip");
    expect(plan.round).toBe(1);
    expect(plan.reason).toContain("already reviewed");
  });

  it("increments the round for a new head SHA after a fix push", () => {
    const comments = [{ body: reviewMarker(1, head, "changes-requested") }];
    const plan = planReview({
      comments,
      headSha: "fff9999aaa8888fff9999aaa8888fff9999aaa88",
      maxReviewRounds: 3,
    });
    expect(plan).toMatchObject({ action: "review", round: 2 });
  });

  it("takes the highest round when a head carries several markers", () => {
    const comments = [
      { body: `Reviewed.\n${reviewMarker(1, "aaa1111", "changes-requested")}` },
      { body: `Re-reviewed.\n${reviewMarker(2, "aaa1111", "approved")}` },
    ];
    const heads = reviewedHeads(comments);
    expect(heads.get("aaa1111")).toMatchObject({
      round: 2,
      verdict: "approved",
    });
  });

  it("ignores markers that are not loop markers", () => {
    const comments = [{ body: "<!-- unrelated note round=9 head=deadbee -->" }];
    expect(reviewedHeads(comments).size).toBe(0);
  });

  it("skips a fourth round because maxReviewRounds is 3", () => {
    const comments = [
      { body: reviewMarker(1, "aaa1111", "changes-requested") },
      { body: reviewMarker(2, "bbb2222", "changes-requested") },
      { body: reviewMarker(3, "ccc3333", "changes-requested") },
    ];
    const plan = planReview({
      comments,
      headSha: "ddd4444",
      maxReviewRounds: 3,
    });
    expect(plan.action).toBe("skip");
    expect(plan.round).toBe(4);
    expect(plan.reason).toContain("maxReviewRounds");
  });
});

describe("CI classification and CI findings", () => {
  it("reports success only when every required check passed", () => {
    expect(classifyCi([PASS_CHECK], REQUIRED_CHECKS).status).toBe("success");
  });

  it("ignores non-required checks such as the loop reporting jobs", () => {
    const ci = classifyCi(
      [
        PASS_CHECK,
        {
          name: "Report merge readiness (no merge)",
          state: "FAILURE",
          bucket: "fail",
        },
      ],
      REQUIRED_CHECKS,
    );
    expect(ci.status).toBe("success");
  });

  it("reports failure for a failed required check", () => {
    const ci = classifyCi([FAIL_CHECK], REQUIRED_CHECKS);
    expect(ci.status).toBe("failure");
    expect(ci.failing).toHaveLength(1);
  });

  it("reports pending while a required check is still running", () => {
    expect(classifyCi([PENDING_CHECK], REQUIRED_CHECKS).status).toBe("pending");
  });

  it("reports unknown when a required check never reported", () => {
    const ci = classifyCi([], REQUIRED_CHECKS);
    expect(ci.status).toBe("unknown");
    expect(ci.missing).toHaveLength(1);
  });

  it("turns a failed required check into a blocker finding naming the run", () => {
    const ci = classifyCi(
      [{ ...FAIL_CHECK, link: "https://example.test/run/1" }],
      REQUIRED_CHECKS,
    );
    const findings = ciFindings(ci);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding).toMatchObject({ severity: "blocker" });
    expect(finding?.summary).toContain("did not pass");
    expect(finding?.suggestion).toContain("https://example.test/run/1");
    expect(finding?.suggestion).toContain("re-run");
  });

  it("turns a missing required check into a blocker finding", () => {
    const finding = ciFindings(classifyCi([], REQUIRED_CHECKS))[0];
    expect(finding?.summary).toContain("has not reported");
  });
});

describe("verdict coercion", () => {
  const failing = classifyCi([FAIL_CHECK], REQUIRED_CHECKS);
  const passing = classifyCi([PASS_CHECK], REQUIRED_CHECKS);
  const unknown = classifyCi([], REQUIRED_CHECKS);

  it("turns a failing build into changes-requested", () => {
    const coerced = coerceVerdict({
      requested: "approved",
      ci: failing,
      round: 1,
      maxReviewRounds: 3,
    });
    expect(coerced).toMatchObject({
      verdict: "changes-requested",
      forced: true,
    });
  });

  it("does not approve when a required check never reported", () => {
    const coerced = coerceVerdict({
      requested: "approved",
      ci: unknown,
      round: 1,
      maxReviewRounds: 3,
    });
    expect(coerced.verdict).toBe("changes-requested");
  });

  it("blocks changes-requested at the round limit instead of looping", () => {
    const coerced = coerceVerdict({
      requested: "changes-requested",
      ci: passing,
      round: 3,
      maxReviewRounds: 3,
    });
    expect(coerced).toMatchObject({ verdict: "blocked", forced: true });
  });

  it("allows changes-requested below the round limit", () => {
    const coerced = coerceVerdict({
      requested: "changes-requested",
      ci: passing,
      round: 2,
      maxReviewRounds: 3,
    });
    expect(coerced).toMatchObject({
      verdict: "changes-requested",
      forced: false,
    });
  });

  it("leaves a green approval alone", () => {
    const coerced = coerceVerdict({
      requested: "approved",
      ci: passing,
      round: 1,
      maxReviewRounds: 3,
    });
    expect(coerced).toMatchObject({ verdict: "approved", forced: false });
  });
});

describe("model report normalization and validation", () => {
  it("records the loop facts rather than trusting the model", () => {
    const report = normalizeModelReport(
      { verdict: "approved", headSha: "deadbeefdeadbeef", pr: 999, round: 7 },
      facts(),
    );
    expect(report).toMatchObject({
      taskId: "AI-002-T1",
      pr: 25,
      round: 1,
      headSha: facts().headSha,
      ciStatus: "success",
    });
  });

  it("normalizes missing finding fields and drops a bogus line number", () => {
    const report = normalizeModelReport(
      modelReport({
        findings: [
          { severity: "catastrophic", file: "", summary: "x", line: 0 },
        ],
      }),
      facts(),
    );
    expect(report.findings[0]).toMatchObject({
      id: "REV-1",
      severity: "major",
      file: "unknown",
    });
    expect(report.findings[0]?.line).toBeUndefined();
  });

  it("rejects a changes-requested report with no findings", () => {
    const report = normalizeModelReport(
      modelReport({ verdict: "changes-requested" }),
      facts(),
    );
    const errors = validateReport(report, facts());
    expect(errors.join("\n")).toContain("must carry at least one finding");
  });

  it("rejects a verdict outside the schema enum", () => {
    const report = normalizeModelReport(
      modelReport({ verdict: "looks-fine" }),
      facts(),
    );
    expect(validateReport(report, facts()).join("\n")).toContain(
      "is not one of",
    );
  });

  it("rejects a report whose head SHA does not match the reviewed head", () => {
    const report = normalizeModelReport(
      modelReport(),
      facts({ headSha: "other-sha" }),
    );
    expect(validateReport(report, facts()).join("\n")).toContain(
      "does not match the reviewed head",
    );
  });

  it("accepts a well-formed changes-requested report", () => {
    const report = normalizeModelReport(
      modelReport({
        verdict: "changes-requested",
        findings: [
          {
            id: "REV-001",
            severity: "major",
            file: "apps/api/src/http/routes/x.ts",
            line: 12,
            summary: "Business logic lives in the route handler.",
            suggestion:
              "Move the rule into the application service and unit-test it there.",
          },
        ],
      }),
      facts(),
    );
    expect(validateReport(report, facts())).toEqual([]);
  });
});

describe("loop decision", () => {
  it("dispatches a fix on changes-requested", () => {
    const decision = decisionFor({
      verdict: "changes-requested",
      ciStatus: "success",
      round: 1,
      maxReviewRounds: 3,
    });
    expect(decision).toMatchObject({ action: "fix", status: "fixing" });
    expect(decision.addLabels).toEqual([]);
  });

  it("blocks at the round limit without dispatching a fix", () => {
    const decision = decisionFor({
      verdict: "changes-requested",
      ciStatus: "success",
      round: 3,
      maxReviewRounds: 3,
    });
    expect(decision.action).toBe("blocked");
    expect(decision.addLabels).toEqual(["ai-blocked"]);
    expect(decision.message).toContain("Human intervention required");
  });

  it("marks ready-to-merge on a green approval and hands the decision to the gate", () => {
    const decision = decisionFor({
      verdict: "approved",
      ciStatus: "success",
      round: 2,
      maxReviewRounds: 3,
    });
    expect(decision).toMatchObject({
      action: "ready",
      status: "ready-to-merge",
    });
    expect(decision.addLabels).toEqual(["ai-ready"]);
    expect(decision.message).toContain("merge gate");
  });

  it("does not mark ready while CI is not green", () => {
    const decision = decisionFor({
      verdict: "approved",
      ciStatus: "pending",
      round: 1,
      maxReviewRounds: 3,
    });
    expect(decision.action).toBe("none");
    expect(decision.addLabels).toEqual([]);
  });

  it("blocks without dispatching a fix on a blocked verdict", () => {
    const decision = decisionFor({
      verdict: "blocked",
      ciStatus: "success",
      round: 1,
      maxReviewRounds: 3,
    });
    expect(decision.action).toBe("blocked");
  });
});

describe("review request and response handling", () => {
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://example.test/schema.json",
    type: "object",
    required: ["verdict"],
    properties: { verdict: { type: "string" } },
  };

  it("requests a strict structured response and strips schema meta keys", () => {
    const body = buildReviewRequestBody({
      model: "openrouter/free",
      instructions: "review it",
      input: "the diff",
      schema,
    });
    expect(body.model).toBe("openrouter/free");
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      strict: true,
    });
    expect(body.text.format.schema).not.toHaveProperty("$schema");
    expect(body.text.format.schema).not.toHaveProperty("$id");
    expect(body.text.format.schema.required).toEqual(["verdict"]);
  });

  it("extracts the assistant text from a Responses API payload", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"verdict":"approved"}' }],
        },
      ],
    };
    expect(extractOutputText(payload)).toBe('{"verdict":"approved"}');
  });

  it("extracts text from a convenience output_text field", () => {
    expect(extractOutputText({ output_text: '{"verdict":"blocked"}' })).toBe(
      '{"verdict":"blocked"}',
    );
  });

  it("surfaces a refusal instead of parsing it as a review", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "I cannot help with that." }],
        },
      ],
    };
    expect(() => extractOutputText(payload)).toThrow(/refused/);
  });

  it("fails when the payload carries no text at all", () => {
    expect(() => extractOutputText({ output: [] })).toThrow(/no text content/);
  });

  it("rejects invalid JSON from the reviewer", () => {
    expect(() => parseModelJson("{ not json")).toThrow(/invalid JSON/);
  });

  it("rejects a JSON payload that is not an object", () => {
    expect(() => parseModelJson('["approved"]')).toThrow(/not an object/);
    expect(() => parseModelJson("")).toThrow(/empty body/);
  });

  it("prefers the final message over a reasoning item in a Responses payload", () => {
    const payload = {
      output: [
        {
          type: "reasoning",
          content: [{ type: "reasoning_text", text: "Let me consider…" }],
        },
        {
          type: "message",
          content: [{ type: "output_text", text: '{"verdict":"approved"}' }],
        },
      ],
    };
    expect(extractOutputText(payload)).toBe('{"verdict":"approved"}');
  });

  it("parses a review wrapped in prose or a fenced code block", () => {
    const fenced =
      'Here is the review:\n```json\n{"verdict":"changes-requested"}\n```\nDone.';
    expect(parseModelJson(fenced)).toEqual({ verdict: "changes-requested" });
    expect(
      parseModelJson('Let me carry out the review. {"verdict":"approved"}'),
    ).toEqual({
      verdict: "approved",
    });
  });

  it("still rejects prose that contains no JSON object", () => {
    expect(() =>
      parseModelJson("Let me carry out the review and report back shortly."),
    ).toThrow(/invalid JSON/);
  });
});

describe("provider-neutral reviewer configuration", () => {
  const openRouterReview = {
    provider: "openrouter",
    endpoint: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    modelEnvVar: "OPENROUTER_REVIEW_MODEL",
  };

  it("selects the credential environment variable from the configured provider", () => {
    expect(reviewApiKeyEnvVar(openRouterReview)).toBe("OPENROUTER_API_KEY");
    // The explicit apiKeyEnvVar wins over the provider-derived default.
    expect(
      reviewApiKeyEnvVar({
        provider: "openrouter",
        apiKeyEnvVar: "CUSTOM_KEY",
      }),
    ).toBe("CUSTOM_KEY");
  });

  it("derives the credential variable from the provider when apiKeyEnvVar is unset", () => {
    expect(reviewApiKeyEnvVar({ provider: "openrouter" })).toBe(
      "OPENROUTER_API_KEY",
    );
    expect(reviewApiKeyEnvVar({ provider: "openai" })).toBe("OPENAI_API_KEY");
  });

  it("defaults to the OpenRouter credential when nothing is configured", () => {
    expect(reviewApiKeyEnvVar({})).toBe("OPENROUTER_API_KEY");
  });

  it("derives the model override variable from the provider when unset", () => {
    expect(reviewModelEnvVar({ provider: "openrouter" })).toBe(
      "OPENROUTER_REVIEW_MODEL",
    );
    expect(reviewModelEnvVar({ provider: "openai" })).toBe(
      "OPENAI_REVIEW_MODEL",
    );
    expect(reviewModelEnvVar(openRouterReview)).toBe("OPENROUTER_REVIEW_MODEL");
  });

  it("reads the API key from the configured environment variable only", () => {
    const resolved = resolveApiKey(openRouterReview, {
      OPENROUTER_API_KEY: "or-key",
      OPENAI_API_KEY: "openai-key",
    });
    expect(resolved).toEqual({
      apiKey: "or-key",
      envVar: "OPENROUTER_API_KEY",
    });
  });

  it("treats a blank or whitespace-only key as absent", () => {
    expect(
      resolveApiKey(openRouterReview, { OPENROUTER_API_KEY: "" }).apiKey,
    ).toBe("");
    expect(
      resolveApiKey(openRouterReview, { OPENROUTER_API_KEY: "   " }).apiKey,
    ).toBe("");
    expect(resolveApiKey(openRouterReview, {}).apiKey).toBe("");
  });

  it("trims a key that carries surrounding whitespace", () => {
    expect(
      resolveApiKey(openRouterReview, { OPENROUTER_API_KEY: "  or-key\n" })
        .apiKey,
    ).toBe("or-key");
  });

  it("builds the Responses endpoint from a base URL", () => {
    expect(reviewEndpoint({ endpoint: "https://openrouter.ai/api/v1" })).toBe(
      "https://openrouter.ai/api/v1/responses",
    );
  });

  it("does not double-append /responses to a full endpoint", () => {
    expect(
      reviewEndpoint({ endpoint: "https://openrouter.ai/api/v1/responses" }),
    ).toBe("https://openrouter.ai/api/v1/responses");
    expect(
      reviewEndpoint({ endpoint: "https://openrouter.ai/api/v1/responses/" }),
    ).toBe("https://openrouter.ai/api/v1/responses");
  });

  it("tolerates a trailing slash on the base URL", () => {
    expect(reviewEndpoint({ endpoint: "https://openrouter.ai/api/v1/" })).toBe(
      "https://openrouter.ai/api/v1/responses",
    );
  });

  it("resolves the model from the override, the env var, then the configured default", () => {
    expect(resolveReviewModel({ review: openRouterReview, env: {} })).toBe(
      "openrouter/free",
    );
    expect(
      resolveReviewModel({
        review: openRouterReview,
        env: { OPENROUTER_REVIEW_MODEL: "some/model" },
      }),
    ).toBe("some/model");
    expect(
      resolveReviewModel({
        review: openRouterReview,
        override: "cli/model",
        env: { OPENROUTER_REVIEW_MODEL: "some/model" },
      }),
    ).toBe("cli/model");
  });

  it("falls through a blank or whitespace-only model override", () => {
    expect(
      resolveReviewModel({
        review: openRouterReview,
        env: { OPENROUTER_REVIEW_MODEL: "" },
      }),
    ).toBe("openrouter/free");
    expect(
      resolveReviewModel({
        review: openRouterReview,
        env: { OPENROUTER_REVIEW_MODEL: "   " },
      }),
    ).toBe("openrouter/free");
    expect(
      resolveReviewModel({ review: openRouterReview, override: "  ", env: {} }),
    ).toBe("openrouter/free");
  });
});

describe("review comment and fix handoff", () => {
  const report = normalizeModelReport(
    modelReport({
      verdict: "changes-requested",
      findings: [
        {
          id: "REV-001",
          severity: "blocker",
          file: "apps/api/src/x.ts",
          line: 9,
          summary: "Secret is returned.",
          suggestion: "Return the DTO instead.",
        },
        {
          id: "REV-002",
          severity: "nit",
          file: "apps/web/src/y.tsx",
          summary: "Naming.",
          suggestion: "Rename.",
        },
      ],
    }),
    facts(),
  );

  it("leads the comment with the dedupe marker", () => {
    const comment = buildComment(
      report,
      decisionFor({
        verdict: "changes-requested",
        ciStatus: "success",
        round: 1,
        maxReviewRounds: 3,
      }),
    );
    expect(comment.split("\n")[0]).toBe(
      reviewMarker(1, report.headSha, "changes-requested"),
    );
    expect(comment).toContain("apps/api/src/x.ts:9");
    expect(comment).toContain("Return the DTO instead.");
    expect(comment).toContain("AI agent");
  });

  it("round-trips: the posted comment makes the next run skip that head", () => {
    const comment = buildComment(
      report,
      decisionFor({
        verdict: "changes-requested",
        ciStatus: "success",
        round: 1,
        maxReviewRounds: 3,
      }),
    );
    const plan = planReview({
      comments: [{ body: comment }],
      headSha: report.headSha,
      maxReviewRounds: 3,
    });
    expect(plan.action).toBe("skip");
  });

  it("hands the fix the same PR and branch, and separates blocking from advisory", () => {
    const context = buildFixContext({
      report,
      pr: 25,
      branch: "automation/ai-002-t1",
      headSha: report.headSha,
      maxReviewRounds: 3,
    });
    expect(context).toContain("Pull request: #25");
    expect(context).toContain("`automation/ai-002-t1`");
    expect(context).toContain("Do **NOT** create another branch");
    expect(context).toContain("Do **NOT** merge");
    expect(context).toContain("REV-001");
    expect(context).toContain("Blocking findings to fix");
    expect(context).toContain("Advisory findings");
    expect(context).toContain("FIXED");
    expect(context).toContain("DECLINED");
    expect(context).toContain("npm run test:e2e");
  });

  it("tells the fixer there is nothing blocking when only advisory findings exist", () => {
    const advisoryOnly = normalizeModelReport(
      modelReport({
        verdict: "changes-requested",
        findings: [
          {
            id: "REV-1",
            severity: "nit",
            file: "a.ts",
            summary: "x",
            suggestion: "y",
          },
        ],
      }),
      facts(),
    );
    const context = buildFixContext({
      report: advisoryOnly,
      pr: 25,
      branch: "automation/x",
      headSha: advisoryOnly.headSha,
      maxReviewRounds: 3,
    });
    expect(context).toContain("None. If the only findings are advisory");
  });
});

describe("review CLI", () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "rayaramathaynk-review-"));
    cpSync(resolve(root, ".ai"), join(scratch, ".ai"), { recursive: true });
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  // The CLI shells out to `gh`. Stub it so the tests are hermetic: no network,
  // and no dependence on an ambient GH_TOKEN that a developer happens to have
  // exported but CI does not.
  function stubGh(pr: Record<string, unknown>): string {
    const bin = join(scratch, "bin");
    mkdirSync(bin, { recursive: true });
    const fixture = join(scratch, "pr.json");
    writeFileSync(fixture, JSON.stringify(pr));
    const script = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'case "$1 $2" in',
      '  "pr view") cat "$AI_LOOP_STUB_PR" ;;',
      '  "pr checks") printf \'%s\' "${AI_LOOP_STUB_CHECKS:-[]}" ;;',
      '  "pr diff") printf \'%s\' "${AI_LOOP_STUB_DIFF:-}" ;;',
      "  *) printf '%s' '' ;;",
      "esac",
      "",
    ].join("\n");
    const gh = join(bin, "gh");
    writeFileSync(gh, script, { mode: 0o755 });
    return bin;
  }

  // A minimal but schema-valid review report, so the CLI's own validation path
  // runs without a network call.
  function canned(verdict: string): string {
    const file = join(scratch, `canned-${verdict}.json`);
    writeFileSync(
      file,
      JSON.stringify({
        verdict,
        summary: `stub ${verdict}`,
        acceptanceCriteria: [
          {
            criterion: "the loop is automatic",
            status: "met",
            evidence: "stub",
          },
        ],
        findings:
          verdict === "approved"
            ? []
            : [
                {
                  id: "REV-1",
                  severity: "major",
                  file: ".ai/scripts/chatgpt-review.mjs",
                  line: 1,
                  summary: "stub finding",
                  suggestion: "stub suggestion",
                },
              ],
      }),
    );
    return file;
  }

  function runReview(
    args: string[],
    env: Record<string, string> = {},
    pr: Record<string, unknown> = {
      number: 19,
      title: "stub",
      body: "",
      headRefName: "automation/ai-development-loop",
      headRefOid: "a".repeat(40),
      baseRefName: "main",
      headRepositoryOwner: { login: "ngowda759" },
      comments: [],
      labels: [],
      isCrossRepository: false,
    },
  ) {
    const bin = stubGh(pr);
    // Start from a clean slate: an ambient review-model variable would otherwise
    // leak into the child and mask the fallback behaviour under test.
    const baseEnv: NodeJS.ProcessEnv = { ...process.env };
    delete baseEnv.OPENROUTER_REVIEW_MODEL;
    delete baseEnv.OPENAI_REVIEW_MODEL;
    return spawnSync(
      "node",
      [resolve(root, ".ai/scripts/chatgpt-review.mjs"), ...args],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...baseEnv,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          AI_LOOP_ROOT: scratch,
          AI_LOOP_STUB_PR: join(scratch, "pr.json"),
          OPENROUTER_API_KEY: "",
          OPENAI_API_KEY: "",
          ...env,
        },
      },
    );
  }

  it("fails safely when OPENROUTER_API_KEY is missing", () => {
    const result = runReview(["--pr", "19"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OPENROUTER_API_KEY is not configured");
    // The failure must name the provider and never leak a key-shaped secret.
    expect(result.stderr).toContain("openrouter");
    expect(result.stderr).not.toMatch(/sk-[A-Za-z0-9]/);
  });

  it("treats a whitespace-only OPENROUTER_API_KEY as missing", () => {
    const result = runReview(["--pr", "19"], { OPENROUTER_API_KEY: "   " });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OPENROUTER_API_KEY is not configured");
  });

  it("does not fall back to OPENAI_API_KEY when OPENROUTER_API_KEY is absent", () => {
    // The OpenRouter provider must never be silently served by a paid OpenAI key.
    const result = runReview(["--pr", "19"], {
      OPENAI_API_KEY: "sk-test-openai",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OPENROUTER_API_KEY is not configured");
    expect(result.stderr).not.toContain("sk-test-openai");
  });

  it("rejects a non-numeric --pr without touching the network", () => {
    const result = runReview(["--pr", "not-a-number"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--pr must be a positive integer");
  });

  it("requires --pr", () => {
    const result = runReview([]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: chatgpt-review.mjs");
  });

  it("plans a fix on the SAME pr and branch when the verdict needs work", () => {
    const result = runReview(
      [
        "--pr",
        "19",
        "--response-file",
        canned("changes-requested"),
        "--dry-run",
      ],
      { OPENROUTER_API_KEY: "test-key" },
    );
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain("verdict: changes-requested");
    expect(out).toContain(
      "fix dispatch: --stage fix --pr 19 --branch automation/ai-development-loop",
    );
    // A fix updates the existing pull request; it never opens a second one.
    expect(out).not.toMatch(/--new-pr|create.*pull request/i);
  });

  it("routes an approval to the human merge gate without dispatching a fix", () => {
    const result = runReview(
      ["--pr", "19", "--response-file", canned("approved"), "--dry-run"],
      {
        OPENROUTER_API_KEY: "test-key",
        AI_LOOP_STUB_CHECKS: JSON.stringify([
          {
            name: "Lint, typecheck, test, build",
            state: "SUCCESS",
            bucket: "pass",
            link: "",
          },
        ]),
      },
    );
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain("verdict: approved");
    expect(out).toContain("fix dispatch: none");
    expect(out).toContain("ai-ready");
  });

  it("runs a round on a red build and reports changes-requested rather than blocking", () => {
    // The reviewer still runs when CI is red, so a fix round is dispatched with
    // the failure attached instead of the loop going straight to blocked.
    const result = runReview(
      ["--pr", "19", "--response-file", canned("approved"), "--dry-run"],
      {
        OPENROUTER_API_KEY: "test-key",
        AI_LOOP_STUB_CHECKS: JSON.stringify([
          {
            name: "Lint, typecheck, test, build",
            state: "FAILURE",
            bucket: "fail",
            link: "https://example.test/run/9",
          },
        ]),
      },
    );
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain("verdict: changes-requested");
    expect(out).not.toContain("verdict: approved");
    expect(out).toContain("fix dispatch: --stage fix --pr 19");
  });

  it("stops for a human at the round limit instead of dispatching another fix", () => {
    // Rounds 1-3 already ran on older heads, so this head would be round 4.
    const comments = [1, 2, 3].map((round) => ({
      body: reviewMarker(round, "a".repeat(40), "changes-requested"),
    }));
    const result = runReview(
      [
        "--pr",
        "19",
        "--response-file",
        canned("changes-requested"),
        "--dry-run",
      ],
      { OPENROUTER_API_KEY: "test-key" },
      {
        number: 19,
        headRefName: "automation/ai-development-loop",
        headRefOid: "b".repeat(40),
        comments,
        isCrossRepository: false,
      },
    );
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain("exceeds maxReviewRounds 3");
    expect(out).not.toContain("fix dispatch: --stage fix");
  });

  it("skips a head SHA that a previous review already covered", () => {
    const sha = "a".repeat(40);
    const result = runReview(
      ["--pr", "19", "--dry-run"],
      { OPENROUTER_API_KEY: "test-key" },
      {
        number: 19,
        headRefName: "automation/ai-development-loop",
        headRefOid: sha,
        comments: [{ body: reviewMarker(1, sha, "approved") }],
        isCrossRepository: false,
      },
    );
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("no review needed");
  });

  // GitHub Actions supplies an empty string for an unset variable, so a blank
  // OPENROUTER_REVIEW_MODEL must not override the configured default. The dry-run
  // body is printed with the resolved model, which is what these assert on.
  describe("review model resolution", () => {
    const CONFIGURED_MODEL = "openrouter/free";

    function resolvedModel(result: { stdout: string; stderr: string }): string {
      const match = /"model": "([^"]*)"/.exec(
        `${result.stdout}${result.stderr}`,
      );
      return match?.[1] ?? "";
    }

    it("falls back to the configured default when OPENROUTER_REVIEW_MODEL is unset", () => {
      const result = runReview(["--pr", "19", "--dry-run"], {
        OPENROUTER_API_KEY: "test-key",
      });
      expect(result.status).toBe(0);
      expect(resolvedModel(result)).toBe(CONFIGURED_MODEL);
    });

    it("falls back to the configured default for an empty OPENROUTER_REVIEW_MODEL", () => {
      const result = runReview(["--pr", "19", "--dry-run"], {
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_REVIEW_MODEL: "",
      });
      expect(result.status).toBe(0);
      expect(resolvedModel(result)).toBe(CONFIGURED_MODEL);
    });

    it("falls back to the configured default for a whitespace-only OPENROUTER_REVIEW_MODEL", () => {
      const result = runReview(["--pr", "19", "--dry-run"], {
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_REVIEW_MODEL: " ",
      });
      expect(result.status).toBe(0);
      expect(resolvedModel(result)).toBe(CONFIGURED_MODEL);
    });

    it("uses an explicitly configured OPENROUTER_REVIEW_MODEL", () => {
      const result = runReview(["--pr", "19", "--dry-run"], {
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_REVIEW_MODEL: "some-model",
      });
      expect(result.status).toBe(0);
      expect(resolvedModel(result)).toBe("some-model");
    });

    it("lets --model take precedence over the configured default", () => {
      const result = runReview(
        ["--pr", "19", "--model", "cli-model", "--dry-run"],
        {
          OPENROUTER_API_KEY: "test-key",
        },
      );
      expect(result.status).toBe(0);
      expect(resolvedModel(result)).toBe("cli-model");
    });

    it("lets --model take precedence over OPENROUTER_REVIEW_MODEL", () => {
      const result = runReview(
        ["--pr", "19", "--model", "cli-model", "--dry-run"],
        {
          OPENROUTER_API_KEY: "test-key",
          OPENROUTER_REVIEW_MODEL: "env-model",
        },
      );
      expect(result.status).toBe(0);
      expect(resolvedModel(result)).toBe("cli-model");
    });
  });

  it("prints the configured provider endpoint in a dry run", () => {
    const result = runReview(["--pr", "19", "--dry-run"], {
      OPENROUTER_API_KEY: "test-key",
    });
    expect(result.status).toBe(0);
    const out = `${result.stdout}${result.stderr}`;
    expect(out).toContain("https://openrouter.ai/api/v1/responses");
    // The OpenAI endpoint must not appear anywhere in the request.
    expect(out).not.toContain("api.openai.com");
  });
});

describe("CI wait script", () => {
  it("requires --pr", () => {
    const result = spawnSync(
      "node",
      [resolve(root, ".ai/scripts/wait-for-ci.mjs")],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: wait-for-ci.mjs");
  });
});

describe("loop state machine transitions", () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "rayaramathaynk-transitions-"));
    cpSync(resolve(root, ".ai"), join(scratch, ".ai"), { recursive: true });
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  function set(args: string[]) {
    return spawnSync(
      "node",
      [resolve(root, ".ai/scripts/loop-state.mjs"), "set", ...args],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, AI_LOOP_ROOT: scratch },
      },
    );
  }

  function status(): string {
    return (
      JSON.parse(
        readFileSync(join(scratch, ".ai/state/loop-state.json"), "utf8"),
      ) as {
        status: string;
      }
    ).status;
  }

  it("walks the autonomous path from implementing to ready-to-merge", () => {
    // The seeded state is `idle`, so the loop is armed to start the next
    // task; the path below is the normal one-task cycle.
    expect(set(["--status", "next-task", "--force"]).status).toBe(0);
    expect(set(["--status", "implementing"]).status).toBe(0);
    expect(set(["--status", "ci-running"]).status).toBe(0);
    expect(set(["--status", "reviewing"]).status).toBe(0);
    expect(set(["--status", "fixing"]).status).toBe(0);
    expect(set(["--status", "ci-running"]).status).toBe(0);
    expect(set(["--status", "reviewing"]).status).toBe(0);
    expect(set(["--status", "ready-to-merge"]).status).toBe(0);
    expect(status()).toBe("ready-to-merge");
  });

  it("refuses a transition the loop does not define", () => {
    // Pin the starting status so the assertion does not depend on whatever the
    // committed state happens to be: `next-task` cannot jump straight to
    // `complete` (the terminal status is spelled `completed`).
    expect(set(["--status", "next-task", "--force"]).status).toBe(0);
    const result = set(["--status", "complete"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "refusing the transition next-task -> complete",
    );
    expect(status()).toBe("next-task");
  });

  it("allows blocking from any state without --force", () => {
    expect(set(["--status", "next-task", "--force"]).status).toBe(0);
    expect(set(["--status", "implementing"]).status).toBe(0);
    expect(set(["--status", "blocked"]).status).toBe(0);
    expect(status()).toBe("blocked");
  });

  it("records a forced transition in the history", () => {
    expect(
      set(["--status", "implementing", "--force", "--note", "recovering"])
        .status,
    ).toBe(0);
    const state = JSON.parse(
      readFileSync(join(scratch, ".ai/state/loop-state.json"), "utf8"),
    ) as {
      history: { note: string }[];
    };
    expect(state.history.at(-1)?.note).toBe("recovering");
  });

  it("allows the human-review-required terminal state", () => {
    expect(set(["--status", "next-task", "--force"]).status).toBe(0);
    expect(set(["--status", "implementing"]).status).toBe(0);
    expect(set(["--status", "ci-running"]).status).toBe(0);
    expect(set(["--status", "reviewing"]).status).toBe(0);
    expect(set(["--status", "ready-to-merge"]).status).toBe(0);
    expect(set(["--status", "human-review-required"]).status).toBe(0);
    expect(status()).toBe("human-review-required");
  });
});

describe("review stage is not dispatched to Jules", () => {
  it("has no Jules review stage in the dispatcher", () => {
    const result = spawnSync(
      "node",
      [
        resolve(root, ".ai/scripts/dispatch-conversation.mjs"),
        "--stage",
        "review",
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unknown stage: review");
  });

  it("never wires the review prompt into the Jules dispatcher", () => {
    const source = readFileSync(
      resolve(root, ".ai/scripts/dispatch-conversation.mjs"),
      "utf8",
    );
    expect(source).not.toContain("review: ['system.md'");
    expect(source).toContain('fix: ["system.md", "fix.md"]');
  });

  it("runs the reviewer from the review workflow, not Jules", () => {
    const workflow = readFileSync(
      resolve(root, ".github/workflows/ai-loop-review.yml"),
      "utf8",
    );
    expect(workflow).toContain("chatgpt-review.mjs");
    expect(workflow).toContain("wait-for-ci.mjs");
    expect(workflow).not.toContain("--stage review");
    // The reviewer reads the pull request as data through the API; it never
    // checks the head out.
    expect(workflow).toContain("resolve-review-pr.mjs");
  });
});

describe("review workflow safety", () => {
  const workflow = readFileSync(
    resolve(root, ".github/workflows/ai-loop-review.yml"),
    "utf8",
  );

  it("never requests contents: write", () => {
    expect(workflow).not.toMatch(/contents:\s*write/);
  });

  it("does not use pull_request_target as a trigger", () => {
    // The word may appear in the explanatory comment; the trigger must not.
    expect(workflow).not.toMatch(/^ {2}pull_request_target:/m);
  });

  it("declares least-privilege permissions", () => {
    expect(workflow).toMatch(
      /permissions:\n {2}contents: read\n {2}checks: read\n {2}pull-requests: write\n {2}issues: write/,
    );
  });

  it("derives the required credential from the configured provider, not a hard-coded OpenAI key", () => {
    // The credential check reads review.apiKeyEnvVar and injects the matching
    // secret; OPENAI_API_KEY must not be required on the normal review path.
    expect(workflow).toContain("Check the reviewer credential");
    expect(workflow).toContain(
      "OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}",
    );
    expect(workflow).toContain("c.review&&c.review.apiKeyEnvVar");
    expect(workflow).not.toContain("secrets.OPENAI_API_KEY");
    expect(workflow).not.toContain("OPENAI_REVIEW_MODEL");
  });

  it("fails clearly when the reviewer credential is absent and never falls back to a paid provider", () => {
    // A missing credential is an infrastructure failure, not a silent skip, and
    // the workflow must say so without switching providers. The variable is
    // interpolated from the config at run time, so assert on the stable text.
    expect(workflow).toContain("steps.creds.outputs.available == 'true'");
    expect(workflow).toMatch(/::error::.*is not configured/);
    expect(workflow).toContain("will not fall back to any paid provider");
    expect(workflow).toContain("The review stage cannot run");
  });
});

describe("dispatcher hard-stop for fix stage", () => {
  it("exits with error when --stage fix is requested", () => {
    const { spawnSync } = require("node:child_process");
    const { resolve } = require("node:path");
    const result = spawnSync(
      "node",
      [
        resolve(__dirname, "../../.ai/scripts/dispatch-conversation.mjs"),
        "--stage",
        "fix",
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Jules same-PR fix continuation is currently unsupported",
    );
  });
});
