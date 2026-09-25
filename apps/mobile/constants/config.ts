import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

export const CONFIG = {
  API_URL: extra.apiUrl || 'http://localhost:3000',
  SUPABASE_URL: extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
};
