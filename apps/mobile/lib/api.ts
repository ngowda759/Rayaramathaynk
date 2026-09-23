import { supabase } from './supabase';

export async function fetchSevas() {
  const { data, error } = await supabase
    .from('sevas')
    .select('*')
    .eq('active', true)
    .gt('amount', 0)
    .order('display_order');

  if (error) throw error;
  return data;
}

export async function fetchEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('published', true)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchDailyPoojas() {
    const { data, error } = await supabase
      .from('daily_poojas')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data;
}

export async function fetchGalleryAlbums() {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*, gallery_media(*)')
    .order('display_order');

  if (error) throw error;
  return data;
}
