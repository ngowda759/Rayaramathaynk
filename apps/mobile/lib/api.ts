import { supabase } from './supabase';
import { Event, Seva, Pooja, Album, WebsiteSettings } from './types';

export async function fetchSevas(): Promise<Seva[]> {
  const { data, error } = await supabase
    .from('sevas')
    .select('*')
    .eq('active', true)
    .gt('amount', 0)
    .order('display_order');

  if (error) {
    console.error('Error fetching sevas:', error);
    return [];
  }
  return data as Seva[];
}

export async function fetchEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('published', true)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }
  return data as Event[];
}

export async function fetchDailyPoojas(): Promise<Pooja[]> {
    const { data, error } = await supabase
      .from('daily_poojas')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
        console.error('Error fetching daily poojas:', error);
        return [];
    }
    return data as Pooja[];
}

export async function fetchGalleryAlbums(): Promise<Album[]> {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*, gallery_media(*)')
    .order('display_order');

  if (error) {
    console.error('Error fetching gallery albums:', error);
    return [];
  }
  return data as Album[];
}

export async function fetchWebsiteSettings(): Promise<WebsiteSettings | null> {
  const { data, error } = await supabase
    .from('website_settings')
    .select('*')
    .eq('key', 'temple_information')
    .single();

  if (error) {
      console.error('Error fetching website settings:', error);
      return null;
  }
  return data?.value as WebsiteSettings;
}