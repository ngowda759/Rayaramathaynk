import { apiClient } from '../lib/api/client';

export interface PanchangaData {
  date: string;
  tithi: string;
  paksha: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
}

export const getTodayPanchanga = async (): Promise<PanchangaData | null> => {
  try {
    // In the real app we hit the web backend API, or if we have a direct Supabase route, we use it.
    // The web app fetches panchanga via some API or static config.
    // Assuming the Next.js API /api/public/stats or a custom one returns this, we'll implement a fallback mock or fetch.
    // The actual system gets it via `services/panchanga.service.ts` locally. We need to hit an endpoint.

    // For now, let's setup the signature. We'll refine the implementation based on available APIs.
    // We can use Supabase to fetch from `daily_poojas` or `panchanga` if those exist.
    // Wait, the Next.js app has a dedicated panchanga generator or gets it from Firestore.
    // Let's implement a robust fetch wrapper.
    const response = await apiClient.get('/api/dashboard/daily-spiritual');
    return response.data?.panchanga || null;
  } catch (error) {
    console.error('Failed to fetch Panchanga:', error);
    return null;
  }
};
