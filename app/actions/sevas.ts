"use server";
import { createAdminClient } from '@/lib/supabase/admin';

export async function getAllSevasAction() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('sevas').select('*');
  if (error) throw error;
  return data;
}

export async function getSevaByIdAction(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('sevas').select('*').eq('firestore_id', id).single();
  if (error) throw error;
  return data;
}
