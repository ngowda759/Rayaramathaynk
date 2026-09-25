import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../../constants/config';

if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or Anon Key is missing. Supabase client will not work properly.');
}

export const supabase = createClient(CONFIG.SUPABASE_URL || 'http://localhost', CONFIG.SUPABASE_ANON_KEY || 'anon-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
