import { getIstDateString } from "@/lib/data-flows/time";

export interface PanchangaData {
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  date: string;
}

export function getCachedPanchanga(date?: string): PanchangaData {
  return {
    tithi: "—",
    nakshatra: "—",
    yoga: "—",
    karana: "—",
    sunrise: "—",
    sunset: "—",
    date: date ?? getIstDateString(),
  };
}

export function getPanchangaWithFallback(
  liveData?: Partial<PanchangaData>
): PanchangaData {
  if (
    liveData?.tithi &&
    liveData?.nakshatra &&
    liveData?.sunrise &&
    liveData?.sunset
  ) {
    return {
      tithi: liveData.tithi,
      nakshatra: liveData.nakshatra,
      yoga: liveData.yoga ?? "—",
      karana: liveData.karana ?? "—",
      sunrise: liveData.sunrise,
      sunset: liveData.sunset,
      date: liveData.date ?? getIstDateString(),
    };
  }

  return getCachedPanchanga(liveData?.date);
}
