import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { validateMigrationCheckpoint, ExpectedMetadata } from "./migrate-all-batched";

export function runGh(command: string): any {
  const result = execSync(`gh ${command}`, { encoding: "utf-8" });
  try {
    return JSON.parse(result);
  } catch {
    return result.trim();
  }
}

export function fetchLatestValidCheckpoint(isDryRun: boolean, expectedBatchSize: number) {
  const workflowName = "firestore-batched-migration.yml";

  console.log(`Searching for latest completed runs of ${workflowName}...`);

  const expectedMetadata: ExpectedMetadata = {
    migrationType: isDryRun ? "dry-run" : "production",
    inventoryVersion: "1.0",
    batchSize: expectedBatchSize,
    checkpointVersion: "1.0"
  };

  // List completed runs, sorting inherently by newest via GH CLI default behavior, grabbing createdAt and workflow info
  const runs = runGh(`run list --workflow=${workflowName} --status completed --json databaseId,headBranch,createdAt,name --limit 20`);

  if (!runs || !Array.isArray(runs) || runs.length === 0) {
    console.log("No valid previous migration checkpoint found. Starting fresh.");
    return null;
  }

  // Ensure deterministic descending order by createdAt
  runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const run of runs) {
    const runId = run.databaseId;
    const branch = run.headBranch;

    // Validate workflow identity
    if (!run.name || run.name !== "Batched Firestore to Supabase Migration") {
       console.warn(`Run ${runId} has wrong workflow name identity (expected 'Batched Firestore to Supabase Migration', got '${run.name}'). Skipping.`);
       continue;
    }

    // Check if artifact exists
    let artifacts;
    try {
      artifacts = runGh(`api repos/{owner}/{repo}/actions/runs/${runId}/artifacts`);
    } catch (err) {
      continue;
    }

    const manifestArtifact = artifacts?.artifacts?.find((a: any) => a.name === "migration-manifest");
    if (!manifestArtifact) {
      continue;
    }

    console.log(`Found migration-manifest artifact on run ${runId}. Downloading...`);

    // Download into a temp directory
    const tempDir = path.join(process.cwd(), "temp-checkpoint");
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      execSync(`gh run download ${runId} -n migration-manifest --dir temp-checkpoint`, { stdio: "ignore" });
    } catch (err) {
      console.warn(`Failed to download artifact from run ${runId}. Skipping.`);
      continue;
    }

    const manifestPath = path.join(tempDir, "migration-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch (err) {
      console.warn(`Manifest from run ${runId} is malformed JSON. Skipping.`);
      continue;
    }

    if (!validateMigrationCheckpoint(manifest, expectedMetadata)) {
      continue;
    }

    // Verify manifest runId matches the artifact's originating workflow run
    // Using string interpolation for safety against types
    if (String(manifest.runId) !== String(runId)) {
      console.warn(`Manifest from run ${runId} claims invalid runId ${manifest.runId}. Skipping copied/invalid manifest.`);
      continue;
    }

    console.log(`Restoring valid checkpoint from run ID: ${runId} on branch: ${branch}`);

    const destDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(manifestPath, path.join(destDir, "migration-manifest.json"));
    fs.rmSync(tempDir, { recursive: true, force: true });

    return { runId, branch };
  }

  console.log("No valid previous migration checkpoint found. Starting fresh.");
  return null;
}

if (require.main === module) {
  // Simple args parsing for fetch-checkpoint
  const isDryRun = process.argv.includes("--dry-run");
  let batchSize = 10;
  const batchSizeIdx = process.argv.indexOf("--batch-size");
  if (batchSizeIdx !== -1 && process.argv.length > batchSizeIdx + 1) {
    batchSize = parseInt(process.argv[batchSizeIdx + 1], 10);
  }

  const result = fetchLatestValidCheckpoint(isDryRun, batchSize);

  // Output github env vars
  const githubEnvPath = process.env.GITHUB_ENV;
  if (githubEnvPath && result) {
    fs.appendFileSync(githubEnvPath, `CHECKPOINT_SOURCE_RUN_ID=${result.runId}\n`);
    fs.appendFileSync(githubEnvPath, `CHECKPOINT_SOURCE_BRANCH=${result.branch}\n`);
  }
}
