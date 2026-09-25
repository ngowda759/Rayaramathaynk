import { supabase } from '../lib/supabase/client';

export interface GalleryMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
  title?: string;
  album_id?: string;
  created_at: string;
}

export const getGalleryMedia = async (): Promise<GalleryMedia[]> => {
  try {
    const { data, error } = await supabase
      .from('gallery_media')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
       console.warn('Gallery query failed:', error.message);
       return [];
    }
    return data || [];
  } catch (error) {
    console.error('Failed to fetch gallery media:', error);
    return [];
  }
};
