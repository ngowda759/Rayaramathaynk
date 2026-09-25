import { supabase } from '../lib/supabase/client';

export interface SiteSettings {
  temple_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  google_maps_link?: string;
}

export const getSiteSettings = async (): Promise<SiteSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.warn('Site settings query failed:', error.message);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch site settings:', error);
    return null;
  }
};

export const getSettingsDocument = async (documentKey: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('settings_documents')
      .select('data')
      .eq('document_key', documentKey)
      .single();

    if (error) {
      console.warn(`Settings document ${documentKey} query failed:`, error.message);
      return null;
    }
    return data?.data || null;
  } catch (error) {
    console.error(`Failed to fetch settings document ${documentKey}:`, error);
    return null;
  }
};
