import { apiClient } from '../lib/api/client';

export interface PanchangaData {
  date: string;
  tithi?: string;
  paksha?: string;
  nakshatra?: string;
  yoga?: string;
  karana?: string;
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
  rahuKalam?: string;
  yamaganda?: string;
  gulika?: string;
}

export const getTodayPanchanga = async (): Promise<PanchangaData | null> => {
  try {
    // The backend exposes `/api/dashboard/daily-spiritual` which provides:
    // { templeStatus, quote, featuredEvent, announcements, announcement2 }
    // It DOES NOT expose panchanga in `daily-spiritual`!
    // But Raya AI has a multi-source endpoint.
    // The actual Next.js backend generates it internally using `public/data/panchanga/current.json`
    // Wait, the client is mobile, it cannot read `public/data/panchanga/current.json` directly from the filesystem!
    // But it CAN fetch it over HTTP since it's in the Next.js `public` directory.
    // Let's fetch it from `CONFIG.API_URL + '/data/panchanga/current.json'` !

    const response = await apiClient.get('/data/panchanga/current.json');
    const data = response.data;

    if (data) {
       return {
         date: data.date,
         tithi: data.tithi?.name || "—",
         nakshatra: data.nakshatra?.name ? `${data.nakshatra.name} (Pada ${data.nakshatra.pada})` : "—",
         yoga: data.yoga?.name || "—",
         karana: data.karana?.name || "—",
         sunrise: formatTime(data.sun?.sunrise),
         sunset: formatTime(data.sun?.sunset),
       };
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch Panchanga from public json:', error);
    return null;
  }
};

const formatTime = (isoString: string | undefined) => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};
