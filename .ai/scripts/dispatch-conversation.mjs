#!/usr/bin/env node
/**
 * Start a Jules conversation for one stage of the AI development loop.
 *
 * The loop's stages are driven by prompts, not by hard-coded behaviour: this
 * script only assembles the prompt from the repository-owned `.ai/prompts/`
 * files and posts it to the Jules API. It never implements, reviews or
 * merges anything itself, and it never prints the API key.
 *
 * Jules is the implementer and the fixer. Reviewing is the external
 * reviewer model's job and is driven by `.ai/scripts/chatgpt-review.mjs`, so
 * there is deliberately no `review` stage here — dispatching Jules to review
 * its own work would make the loop's only authoritative review self-certified.
 *
 * Usage:
 *   node .ai/scripts/dispatch-conversation.mjs --stage implement --task AI-002-T1
 *   node .ai/scripts/dispatch-conversation.mjs --stage fix --pr 42 --branch automation/x --task AI-002-T1
 *   node .ai/scripts/dispatch-conversation.mjs --stage next-task --dry-run
 *
 * Environment:
 *   JULES_API_KEY       bearer token; when absent the script skips cleanly
 *   GITHUB_REPOSITORY   owner/repo, injected by GitHub Actions
 *   GITHUB_REF_NAME     branch name, injected by GitHub Actions
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(
  readFileSync(resolve(root, ".ai", "loop.config.json"), "utf8"),
);

const STAGE_PROMPTS = {
  implement: ["system.md", "implementation.md"],
  fix: ["system.md", "fix.md"],
  "next-task": ["system.md", "next-task.md"],
  architect: ["system.md", "architect.md"],
};

const STAGE_TITLES = {
  implement: "Implement",
  fix: "Fix",
  "next-task": "Next task",
  architect: "Architect",
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function readPrompt(fileName) {
  const relativePath = `.ai/prompts/${fileName}`;
  const absolute = resolve(root, relativePath);
  if (!existsSync(absolute)) {
    console.error(`missing prompt file: ${relativePath}`);
    process.exit(2);
  }
  return readFileSync(absolute, "utf8").trim();
}

function findTask(taskId) {
  const queue = JSON.parse(
    readFileSync(resolve(root, ".ai/state/task-queue.json"), "utf8"),
  );
  const task = queue.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    console.error(`task ${taskId} is not present in .ai/state/task-queue.json`);
    process.exit(2);
  }
  return task;
}

function contextSection(args) {
  const state = JSON.parse(
    readFileSync(resolve(root, ".ai/state/loop-state.json"), "utf8"),
  );
  const lines = [
    "## Loop context",
    "",
    `- stage: ${args.stage}`,
    `- loop id: ${config.loopId}`,
    `- round: ${state.round} of maxReviewRounds ${config.maxReviewRounds}`,
    `- base branch: ${config.baseBranch}`,
    `- branch prefix: ${config.branchPrefix}`,
    `- protected paths: ${config.protectedPaths.join(", ")}`,
  ];
  const taskId =
    typeof args.task === "string" ? args.task : state.currentTaskId;
  if (taskId !== null && taskId !== undefined) {
    const task = findTask(taskId);
    lines.push(
      "",
      "## Task brief",
      "",
      `\`\`\`json\n${JSON.stringify(task, null, 2)}\n\`\`\``,
    );
  }
  if (typeof args.pr === "string")
    lines.push("", "## Pull request", "", `PR #${args.pr}`);
  if (typeof args["context-file"] === "string") {
    if (!existsSync(args["context-file"])) {
      console.error(`context file not found: ${args["context-file"]}`);
      process.exit(2);
    }
    lines.push(
      "",
      "## Supplied context",
      "",
      readFileSync(args["context-file"], "utf8").trim(),
    );
  }
  return lines.join("\n");
}

function buildPrompt(args) {
  const stageFiles = STAGE_PROMPTS[args.stage];
  if (stageFiles === undefined) {
    console.error(
      `unknown stage: ${args.stage} (expected ${Object.keys(STAGE_PROMPTS).join(", ")})`,
    );
    process.exit(2);
  }
  return `${stageFiles.map(readPrompt).join("\n\n---\n\n")}\n\n---\n\n${contextSection(args)}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (typeof args.stage !== "string") {
  console.error(
    "usage: dispatch-conversation.mjs --stage <implement|fix|next-task|architect>",
  );
  process.exit(2);
}

if (args.stage === "fix") {
  console.error(
    "Error: Jules same-PR fix continuation is currently unsupported.",
  );
  process.exit(1);
}

const prompt = buildPrompt(args);
const apiKey = process.env.JULES_API_KEY ?? "";
const repository = process.env.GITHUB_REPOSITORY ?? "ngowda759/Rayaramathaynk";
const branch =
  typeof args.branch === "string"
    ? args.branch
    : (process.env.GITHUB_REF_NAME ?? config.baseBranch);

const payload = {
  source: `sources/github/${repository}`,
  branch: branch,
  initial_message: { content: [{ type: "text", text: prompt }] },
};

// AUTO_CREATE_PR is only appropriate for a brand-new implementation task.
// If the stage is next-task or architect, do not attempt to create a PR.
if (args.stage === "implement") {
  payload.automationMode = "AUTO_CREATE_PR";
}

if (args["dry-run"] === true) {
  console.log("Dry run: no conversation started. Payload that would be sent:");
  console.log(
    JSON.stringify(
      {
        url: "https://jules.googleapis.com/v1alpha/sessions",
        ...payload,
        initial_message: {
          content: [{ type: "text", text: `<${prompt.length} chars>` }],
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (apiKey.length === 0) {
  console.error(
    "Error: JULES_API_KEY is not configured (required for dispatch).",
  );
  process.exit(1);
}

const response = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
  method: "POST",
  headers: {
    "X-Goog-Api-Key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Jules dispatch failed: HTTP ${response.status}`);
  console.error(body.slice(0, 2000));
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  console.error("Jules dispatch returned a non-JSON body; check the API host.");
  process.exit(1);
}

const conversationId = parsed.session_id ?? parsed.id ?? parsed.name ?? null;
console.log(`Jules conversation started for stage "${args.stage}".`);
if (conversationId !== null) {
  console.log(`session_id: ${conversationId}`);
}
