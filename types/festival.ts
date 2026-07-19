/**
 * Festival Types
 * Types and data for the Festival Experience feature
 */

export interface Festival {
  /** Unique identifier (URL-safe) */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Date in YYYY-MM-DD format */
  date: string;
  
  /** Day of week */
  dayOfWeek: string;
  
  /** Short description */
  description: string;
  
  /** Extended description */
  details?: string;
  
  /** Religious significance */
  significance?: string;
  
  /** Traditional practices/rituals */
  practices?: string[];
  
  /** Associated deity */
  deity?: string;
  
  /** Whether it's a major festival */
  isMajor: boolean;
  
  /** Associated Aaradhane (if any) */
  aaradhane?: string;
  
  /** Month name */
  month: string;
  
  /** Season */
  season: "spring" | "summer" | "monsoon" | "autumn" | "winter";
}

export interface FestivalCountdown {
  festival: Festival;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isToday: boolean;
  isPast: boolean;
}

export interface FestivalCategory {
  id: string;
  name: string;
  icon: string;
  festivals: Festival[];
}

/**
 * Get festival by ID
 */
export function getFestivalById(id: string, festivals: Festival[]): Festival | undefined {
  return festivals.find(f => f.id === id);
}

/**
 * Get upcoming festivals
 */
export function getUpcomingFestivals(festivals: Festival[], limit = 5): Festival[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return festivals
    .filter(f => new Date(f.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit);
}

/**
 * Get featured festival (next major festival)
 */
export function getFeaturedFestival(festivals: Festival[]): Festival | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingMajor = festivals
    .filter(f => new Date(f.date) >= today && f.isMajor)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return upcomingMajor[0];
}

/**
 * Calculate countdown to a festival
 */
export function calculateCountdown(festival: Festival): FestivalCountdown {
  const now = new Date();
  const festivalDate = new Date(festival.date);
  festivalDate.setHours(0, 0, 0, 0);
  
  const diff = festivalDate.getTime() - now.getTime();
  
  if (diff < 0) {
    return {
      festival,
      daysRemaining: 0,
      hoursRemaining: 0,
      minutesRemaining: 0,
      isToday: false,
      isPast: true,
    };
  }
  
  const daysRemaining = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    festival,
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    isToday: daysRemaining === 0,
    isPast: false,
  };
}

/**
 * Get festivals by month
 */
export function getFestivalsByMonth(festivals: Festival[]): Record<string, Festival[]> {
  return festivals.reduce((acc, festival) => {
    const month = festival.month;
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(festival);
    return acc;
  }, {} as Record<string, Festival[]>);
}

/**
 * Get season color
 */
export function getSeasonColor(season: Festival["season"]): string {
  switch (season) {
    case "spring":
      return "from-green-400 to-emerald-500";
    case "summer":
      return "from-yellow-400 to-orange-500";
    case "monsoon":
      return "from-blue-400 to-cyan-500";
    case "autumn":
      return "from-orange-400 to-red-500";
    case "winter":
      return "from-slate-400 to-blue-500";
    default:
      return "from-amber-400 to-orange-500";
  }
}

/**
 * Month name mapping
 */
export const MONTH_NAMES: Record<number, string> = {
  0: "January",
  1: "February",
  2: "March",
  3: "April",
  4: "May",
  5: "June",
  6: "July",
  7: "August",
  8: "September",
  9: "October",
  10: "November",
  11: "December",
};

/**
 * Season name mapping
 */
export const SEASON_NAMES: Record<Festival["season"], string> = {
  spring: "Spring",
  summer: "Summer",
  monsoon: "Monsoon",
  autumn: "Autumn",
  winter: "Winter",
};
