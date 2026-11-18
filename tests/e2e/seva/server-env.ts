/**
 * The dev-server environment for the seva e2e suite.
 *
 * Playwright merges `webServer.env` over `process.env`, and Next fills a variable from `.env*` files
 * only when it is not set at all (an empty string counts as set). So every variable the app reads is
 * pinned here: the Supabase values come from the environment the runner set (a local `127.0.0.1`
 * URL with the stack's own throwaway keys), and every other secret is forced to an empty string so a
 * git-ignored `.env.local` with real keys can never reach the dev server.
 *
 * Kept in its own module so `tests/unit/seva/e2e-isolation.test.ts` can call the builder with a
 * fake environment instead of loading the Playwright config (which needs a live local stack).
 */

/** Build the dev-server environment. Throws when a required local Supabase value is missing. */
export function sevaE2EServerEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  function required(name: string): string {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set; run the seva e2e suite through \`npm run test:e2e:seva\``);
    return value;
  }

  return {
    NEXT_TELEMETRY_DISABLED: "1",
    // The local stack the runner started; a `127.0.0.1` URL with the stack's own throwaway keys.
    NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    // The app runtime does not read these; blanked so a stray `.env.local` value cannot be used.
    SUPABASE_DB_URL: "",
    PRISMA_DATABASE_URL: "",
    // Every other secret the app reads: the AI providers, the admin API key and the blob store token
    // (@vercel/blob reads it itself). Blank, so a test can never call a paid or live service.
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GOOGLE_GENERATIVE_API_KEY: "",
    OPENROUTER_API_KEY: "",
    ADMIN_API_KEY: "",
    REPORTS_API_TOKEN: "",
    BLOB_READ_WRITE_TOKEN: "",
  };
}
