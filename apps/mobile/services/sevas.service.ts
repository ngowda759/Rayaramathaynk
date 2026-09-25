import { supabase } from '../lib/supabase/client';

export interface Seva {
  id: string;
  name: string;
  description: string;
  amount: number;
  active: boolean;
  displayOrder: number;
  timeings: string;
}

export const getActiveSevas = async (): Promise<Seva[]> => {
  try {
    // Supabase table 'sevas' (or whatever the unified backend is using).
    // From instructions: "The public UI and the Admin Receipt module both query the canonical sevas Firestore collection... via supabase postgres migration".
    const { data, error } = await supabase
      .from('sevas')
      .select('*')
      .eq('active', true)
      .gt('amount', 0)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch sevas:', error);
    return [];
  }
};
