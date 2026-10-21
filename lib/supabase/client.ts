import { createBrowserClient } from '@supabase/ssr'

/**
 * The address the document was entered with, captured once when this module is
 * first evaluated in the browser.
 *
 * Why here: a Supabase recovery link carries a single-use credential in the URL
 * (`?code=`, `?token_hash=`, or `#access_token=`). `createBrowserClient` builds a
 * client whose SDK **auto-initializes in its constructor** and, on a PKCE link,
 * redeems the credential and erases it from the address bar. Any component that
 * reads `window.location` afterwards sees a stripped URL and cannot tell a
 * recovery arrival from an ordinary page visit - which is exactly how a valid
 * reset link came to be reported as "open this page from the reset link in your
 * email".
 *
 * Capturing at this module's scope is the only placement that is *ordered*
 * rather than *lucky*: `createBrowserClient` is defined in this module, so this
 * module has necessarily been evaluated before any client can be constructed.
 * A capture in a page component would instead race the ancestor layout's client.
 *
 * It is a URL (already visible in the address bar and in browser history), never
 * a secret, and it is read only by the reset page to decide whether the page was
 * entered through a recovery link.
 */
const entryLocationHref =
  typeof window !== 'undefined' && typeof window.location !== 'undefined'
    ? window.location.href
    : null

/** The URL the document was entered with, or `null` outside the browser. */
export function getEntryLocationHref(): string | null {
  return entryLocationHref
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}
