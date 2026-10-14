// Ensure no browser leakage but support Jest testing in our shared module
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  throw new Error('createAdminClient cannot be called from the browser');
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables for admin client')
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
