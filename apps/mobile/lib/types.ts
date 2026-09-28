export interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  start_time?: string;
  published: boolean;
}

export interface Seva {
  id: string;
  title: string;
  description?: string;
  amount: number;
  active: boolean;
  display_order?: number;
}

export interface Pooja {
  id: string;
  title: string;
  time: string;
  is_active: boolean;
  display_order?: number;
}

export interface Media {
  id: string;
  url: string;
  title?: string;
}

export interface Album {
  id: string;
  title: string;
  display_order?: number;
  gallery_media?: Media[];
}

export interface WebsiteSettings {
  templeName?: string;
  aboutText?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  coordinates?: string;
  timings?: {
    morning?: string;
    evening?: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
