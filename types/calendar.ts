export interface Ekadashi {
  date: string;
  day: string;
  name: string;
}

export interface Festival {
  date: string;
  festival: string;
  description?: string;
}

export interface CalendarData {
  year: number;
  samvatsara: string;
  ekadashi: Ekadashi[];
  festivals: Festival[];
}
