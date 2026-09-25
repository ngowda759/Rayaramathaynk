import { supabase } from '../lib/supabase/client';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
}

export const getActiveAnnouncements = async (): Promise<Announcement[]> => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
       console.warn('Announcements query failed:', error.message);
       return [];
    }
    return data || [];
  } catch (error) {
    console.error('Failed to fetch announcements:', error);
    return [];
  }
};
