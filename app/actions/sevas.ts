"use server";
import { createAdminClient } from '@/lib/supabase/admin';

// These server actions are callable by anyone (the public booking form uses them) and run with the service role,
// so they return only what the public seva list shows, and only active sevas offered online. Internal catalogue
// columns (income ledger, staff ids, visibility, counter-only rules) and counter-only or inactive sevas never leave
// the server.
// `active`, `created_at` and `updated_at` are read by services/seva.service.ts when it maps rows for the booking form.
const PUBLIC_SEVA_COLUMNS =
  'id, name, name_kn, description, category, amount, any_amount, duration, image_url, display_order, firestore_id, active, created_at, updated_at';
const ONLINE_VISIBILITY = ['online', 'both'];

function publicSevasQuery() {
  const supabase = createAdminClient();
  return supabase
    .from('sevas')
    .select(PUBLIC_SEVA_COLUMNS)
    .eq('active', true)
    .in('visibility', ONLINE_VISIBILITY);
}

export async function getAllSevasAction() {
  const { data, error } = await publicSevasQuery();
  if (error) throw error;
  return data;
}

export async function getSevaByIdAction(id: string) {
  const { data, error } = await publicSevasQuery().eq('firestore_id', id).single();
  if (error) throw error;
  return data;
}
