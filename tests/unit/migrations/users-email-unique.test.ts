import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMAIL_WHITESPACE_SQL_U_STRING,
  USERS_EMAIL_CANONICAL_SQL_EXPRESSION,
} from "@/lib/auth/email-normalization";

const ROOT = join(__dirname, "..", "..", "..");
const FILE = join(
  ROOT,
  "supabase/migrations/20261204000000_users_email_lower_btrim_unique.sql",
);
const sql = readFileSync(FILE, "utf8");
const normalize = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

describe("N-05 users.email unique expression index", () => {
  it("creates a unique index with the exact shared canonical expression", () => {
    expect(sql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+users_email_lower_btrim_key/i,
    );
    expect(normalize(sql)).toContain(normalize(USERS_EMAIL_CANONICAL_SQL_EXPRESSION));
    expect(sql).toContain(`U&'${EMAIL_WHITESPACE_SQL_U_STRING}'`);
  });

  it("does not use CONCURRENTLY and does not mutate data", () => {
    expect(sql).not.toMatch(/\bCONCURRENTLY\b/i);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  });
});
