import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma client singleton.
//
// `server-only` guarantees this module can never be imported from a Client
// Component. Prisma holds a direct database connection and must not be shipped to
// the browser. This mirrors the existing convention in `lib/supabase/admin.ts`,
// and `scripts/test-boundary.sh` enforces it in CI.
//
// Prisma 7 requires a driver adapter; the URL is no longer passed to the
// constructor directly. `@prisma/adapter-pg` is the PostgreSQL adapter and wraps
// `pg` (the same driver the Supabase migration tooling already uses).
//
// In development, Next.js hot-reloads modules, which would otherwise create a new
// client (and a new connection pool) on every reload. The client is cached on
// `globalThis` to avoid exhausting database connections.

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function databaseUrl(): string {
  const url = process.env.PRISMA_DATABASE_URL ?? process.env.SUPABASE_DB_URL;

  if (!url) {
    throw new Error(
      "Missing database connection string. Set PRISMA_DATABASE_URL (preferred) " +
        "or SUPABASE_DB_URL."
    );
  }

  return url;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl() });

  return new PrismaClient({
    adapter,
    // Logging is opt-in. Never enable query logging by default: it can echo
    // parameter values into logs.
    log:
      process.env.PRISMA_LOG_QUERIES === "true"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

