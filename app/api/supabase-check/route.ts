import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const envStatus = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  // If credentials are not fully present, report clearly rather than inventing values
  if (!envStatus.hasUrl || !envStatus.hasAnonKey) {
    return NextResponse.json({
      success: false,
      message: 'Supabase credentials are not fully configured in this environment.',
      envStatus
    }, { status: 503 })
  }

  try {
    const supabase = await createClient()

    // We can't do a full connection check (like fetching from a table)
    // because no schema or tables exist yet according to the instructions.
    // However, instantiating the client without throwing confirms basic setup.
    // For a real ping, typically you might query a system table if allowed,
    // or just rely on the instantiation check.

    // Check admin client creation as well
    let adminClientCreated = false;
    if (envStatus.hasServiceRoleKey) {
      try {
        createAdminClient();
        adminClientCreated = true;
      } catch (err) {
        adminClientCreated = false;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase client instantiated successfully. Note: No tables queried as schema is not created yet.',
      envStatus,
      adminClientCreated
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Failed to instantiate Supabase client.',
      error: error.message
    }, { status: 500 })
  }
}
