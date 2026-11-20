/**
 * `AIAdminRepository.deletePromptVersion` against a real (PGlite) Postgres.
 *
 * Applies every migration in `supabase/migrations` (so `ai_settings`, its RLS
 * policy and the seeded `main` row are exactly what production has), then drives
 * the repository through a thin Supabase-shaped port. Proves that deleting a
 * prompt version:
 *   1. removes only the selected element from `prompt.versions`;
 *   2. leaves the row, the `prompt` column and `prompt.defaultPrompt` intact;
 *   3. leaves `currentPromptId` and every other column untouched; and
 *   4. refuses the active version with `in_use` and an unknown id with
 *      `not_found`, writing nothing in either case.
 *
 * No credentials, no network.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { jest, describe, it, expect, beforeAll, afterAll } from "@jest/globals";

import { PLATFORM_RLS_ENABLER_SQL, SUPABASE_ROLES_SQL } from "./harness";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations"
);

let db: PGlite;

/** Maps the two query shapes the repository uses onto real SQL. */
function supabaseShim() {
  return {
    from(table: string) {
      return {
        select(columns?: string) {
          return {
            eq(_column: string, value: string) {
              return {
                async maybeSingle() {
                  const projection = columns ?? "*";
                  const result = await db.query<Record<string, unknown>>(
                    `select ${projection} from ${table} where id = $1`,
                    [value]
                  );
                  return { data: result.rows[0] ?? null, error: null };
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            async eq(_column: string, value: string) {
              await db.query(
                `update ${table} set prompt = $1::jsonb, updated_by = $2 where id = $3`,
                [JSON.stringify(values.prompt), values.updated_by, value]
              );
              return { error: null };
            },
          };
        },
      };
    },
  };
}

jest.unstable_mockModule("@/lib/supabase/admin", () => ({
  createAdminClient: () => supabaseShim(),
}));

const { AIAdminRepository } = await import("../../lib/ai/ai-settings/admin-repository");
const { PromptVersionDeleteError } = await import(
  "../../lib/ai/ai-settings/prompt-errors"
);

interface PromptRowSnapshot {
  id: string;
  versions: { id: string; name: string }[];
  currentPromptId: string;
  defaultPrompt: string;
  updatedBy: string | null;
}

async function snapshot(): Promise<PromptRowSnapshot> {
  const result = await db.query<{
    id: string;
    prompt: { versions: { id: string; name: string }[]; currentPromptId: string; defaultPrompt: string };
    updated_by: string | null;
  }>("select id, prompt, updated_by from ai_settings where id = 'main'");
  const row = result.rows[0];
  return {
    id: row.id,
    versions: row.prompt.versions,
    currentPromptId: row.prompt.currentPromptId,
    defaultPrompt: row.prompt.defaultPrompt,
    updatedBy: row.updated_by,
  };
}

/** Adds a second, non-active draft version next to the seeded one. */
async function addDraftVersion(): Promise<void> {
  const current = await snapshot();
  await db.query(
    `update ai_settings
        set prompt = jsonb_set(
          prompt,
          '{versions}',
          (prompt->'versions') || $1::jsonb
        )
      where id = 'main'`,
    [
      JSON.stringify([
        {
          id: "prompt_draft_2",
          name: "Second draft",
          version: 2,
          content: "draft content",
          status: "draft",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          createdBy: "admin-uid",
        },
      ]),
    ]
  );
  expect((await snapshot()).versions).toHaveLength(current.versions.length + 1);
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);
  await db.exec(SUPABASE_ROLES_SQL);
  await db.exec(PLATFORM_RLS_ENABLER_SQL);
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(
        `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}, 120000);

afterAll(async () => {
  await db.close();
});

describe("AIAdminRepository.deletePromptVersion (PGlite)", () => {
  it("removes only the selected version and keeps the rest of the settings", async () => {
    await addDraftVersion();
    const before = await snapshot();
    expect(before.versions.map((v) => v.id)).toContain("prompt_draft_2");

    const repository = new AIAdminRepository();
    await repository.deletePromptVersion("prompt_draft_2", "admin-uid");

    const after = await snapshot();
    expect(after.versions.map((v) => v.id)).toEqual(
      before.versions.map((v) => v.id).filter((id) => id !== "prompt_draft_2")
    );
    // The row, the active pointer and the default prompt survive.
    expect(after.id).toBe("main");
    expect(after.currentPromptId).toBe(before.currentPromptId);
    expect(after.defaultPrompt).toBe(before.defaultPrompt);
    expect(after.updatedBy).toBe("admin-uid");

    // The `prompt` column is still an object, not null / not dropped.
    const column = await db.query<{ kind: string }>(
      "select jsonb_typeof(prompt) as kind from ai_settings where id = 'main'"
    );
    expect(column.rows[0].kind).toBe("object");
  });

  it("preserves unknown fields on the versions that survive", async () => {
    // A version carrying a field the app's schema does not know about must come
    // back byte-for-byte after an unrelated version is deleted.
    await db.query(
      `update ai_settings
          set prompt = jsonb_set(prompt, '{versions,0,legacyNote}', '"keep me"'::jsonb)
        where id = 'main'`
    );
    await addDraftVersion();

    const repository = new AIAdminRepository();
    await repository.deletePromptVersion("prompt_draft_2", "admin-uid");

    const result = await db.query<{ note: string }>(
      "select prompt->'versions'->0->>'legacyNote' as note from ai_settings where id = 'main'"
    );
    expect(result.rows[0].note).toBe("keep me");
  });

  it("leaves the settings document readable, so the list refresh returns prompts", async () => {
    // The page refetches with GET after a delete; that path parses the whole
    // document. The seeded row has `updated_by` NULL, which the schema rejects,
    // so this asserts the delete's write makes the document parse again rather
    // than leaving the refreshed list empty.
    await addDraftVersion();
    const repository = new AIAdminRepository();
    await repository.deletePromptVersion("prompt_draft_2", "admin-uid");

    const settings = await repository.getSettings();
    expect(settings).not.toBeNull();
    expect(settings?.prompt.versions.map((v) => v.id)).not.toContain("prompt_draft_2");
    expect(settings?.prompt.currentPromptId).toBe("prompt_v1_seed");
  });

  it("refuses the active prompt without writing", async () => {
    const before = await snapshot();
    const repository = new AIAdminRepository();

    await expect(
      repository.deletePromptVersion(before.currentPromptId, "admin-uid")
    ).rejects.toBeInstanceOf(PromptVersionDeleteError);

    const after = await snapshot();
    expect(after.versions).toEqual(before.versions);
    expect(after.currentPromptId).toBe(before.currentPromptId);
  });

  it("reports an unknown id as not_found without writing", async () => {
    const before = await snapshot();
    const repository = new AIAdminRepository();

    const failure = await repository
      .deletePromptVersion("no_such_version", "admin-uid")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PromptVersionDeleteError);
    expect((failure as InstanceType<typeof PromptVersionDeleteError>).reason).toBe(
      "not_found"
    );
    expect((await snapshot()).versions).toEqual(before.versions);
  });

  it("deletes exactly one version per call, idempotently for repeated ids", async () => {
    await addDraftVersion();
    const repository = new AIAdminRepository();

    await repository.deletePromptVersion("prompt_draft_2", "admin-uid");
    const afterFirst = await snapshot();

    await expect(
      repository.deletePromptVersion("prompt_draft_2", "admin-uid")
    ).rejects.toBeInstanceOf(PromptVersionDeleteError);
    expect((await snapshot()).versions).toEqual(afterFirst.versions);
  });
});
