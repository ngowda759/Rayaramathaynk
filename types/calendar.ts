export interface Ekadashi {
  date: string;
  day: string;
}

export interface Festival {
  date: string;
  festival: string;
}

export interface CalendarData {
  year: number;
  samvatsara: string;
  ekadashi: Ekadashi[];
  festivals: Festival[];
}
