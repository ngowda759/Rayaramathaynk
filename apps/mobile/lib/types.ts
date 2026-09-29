export interface WebsiteSettings {
  id: string;
  temple_name?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  location_lat?: number;
  location_lng?: number;
  opening_time?: string;
  closing_time?: string;
  timings?: { morning: string; evening: string };
  aboutText?: string;
}

export interface Seva {
  id: string;
  title: string;
  description: string;
  amount: number;
}

export interface Pooja {
  id: string;
  title: string;
  time: string;
  description?: string;
}

export interface Event {
  id: string;
  title: string;
  start_date: string;
  start_time?: string;
  description?: string;
  image_url?: string;
}

export interface Album {
  id: string;
  title: string;
  cover_url?: string;
  description?: string;
  gallery_media?: { count?: number; id?: string; url?: string; title?: string }[];
}
