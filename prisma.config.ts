// Prisma configuration (Prisma 7).
//
// The datasource URL is read from the environment and is NEVER committed. Prisma
// 7 requires the URL to be supplied here or via the CLI, rather than in the
// schema's datasource block.
//
// Which variable to use:
//   PRISMA_DATABASE_URL  preferred. A direct (non-pooled) PostgreSQL connection,
//                        which is what `prisma migrate` needs.
//   SUPABASE_DB_URL      fallback, for environments that already define it.
//
// Why a distinct variable: migrations and introspection need a session that can
// hold DDL locks. The app's runtime pooler URL is transaction-pooled, which is
// the wrong mode for `migrate deploy`. Keep the two separate so a migration can
// never accidentally run through the runtime pooler.
//
// NOTE: `prisma generate` does not need a URL at all, so CI can generate the
// client without any database credentials.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["PRISMA_DATABASE_URL"] ?? process.env["SUPABASE_DB_URL"],
  },
});
