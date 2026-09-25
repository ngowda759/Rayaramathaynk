import { supabase } from '../lib/supabase/client';

export interface TempleEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  image_url?: string;
  is_featured?: boolean;
}

export const getUpcomingEvents = async (): Promise<TempleEvent[]> => {
  try {
    const today = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('start_date', today)
      .eq('published', true)
      .order('start_date', { ascending: true })
      .limit(10);

    if (error) {
      console.warn('Events query failed, table might not exist or be public yet:', error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }
};
