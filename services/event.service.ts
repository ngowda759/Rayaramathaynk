import { TempleEvent } from "@/types/event";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Helper function to convert date to timestamp for sorting
function toTimestamp(date: any): number {
  if (!date) return 0;
  if (typeof date === 'string') {
    return new Date(date).getTime();
  }
  if (typeof date === 'number') {
    return date;
  }
  if (date.toDate && typeof date.toDate === 'function') {
    return date.toDate().getTime();
  }
  return 0;
}

function mapSupabaseEventToTempleEvent(event: any): TempleEvent {
  return {
    id: event.firestore_id,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.start_date,
    endDate: event.end_date,
    startTime: event.start_time,
    endTime: event.end_time,
    featured: event.featured,
    published: event.published,
    category: event.category,
    imageUrl: event.image_url,
    status: event.status,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

class EventService {
  async getEvents(): Promise<TempleEvent[]> {
    console.log("[EventService] getEvents called from Supabase");
    
    try {
      const { data, error } = await supabase.from('events').select('*');
      if (error) throw error;

      return data.map(mapSupabaseEventToTempleEvent);
    } catch (error) {
      console.error("[EventService] Error fetching events:", error);
      return [];
    }
  }

  async getEvent(id: string): Promise<TempleEvent | null> {
    try {
      const { data, error } = await supabase.from('events').select('*').eq('firestore_id', id).single();
      if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw error;
      }
      return mapSupabaseEventToTempleEvent(data);
    } catch (error) {
      console.error("[EventService] Error fetching event:", error);
      return null;
    }
  }

  async addEvent(event: TempleEvent) {
    const firestore_id = event.id || crypto.randomUUID();
    const eventToInsert = {
      firestore_id,
      title: event.title,
      description: event.description,
      location: event.location,
      start_date: event.startDate,
      end_date: event.endDate,
      start_time: event.startTime,
      end_time: event.endTime,
      featured: event.featured,
      published: event.published,
      category: event.category,
      image_url: event.imageUrl,
      status: event.status,
      created_at: event.createdAt || new Date().toISOString(),
      updated_at: event.updatedAt || new Date().toISOString(),
    };

    const { data, error } = await supabase.from('events').insert(eventToInsert).select('*').single();
    if (error) {
      console.error("[EventService] Error adding event:", error);
      throw error;
    }
    return mapSupabaseEventToTempleEvent(data);
  }

  async updateEvent(id: string, event: Partial<TempleEvent>) {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (event.title !== undefined) updateData.title = event.title;
    if (event.description !== undefined) updateData.description = event.description;
    if (event.location !== undefined) updateData.location = event.location;
    if (event.startDate !== undefined) updateData.start_date = event.startDate;
    if (event.endDate !== undefined) updateData.end_date = event.endDate;
    if (event.startTime !== undefined) updateData.start_time = event.startTime;
    if (event.endTime !== undefined) updateData.end_time = event.endTime;
    if (event.featured !== undefined) updateData.featured = event.featured;
    if (event.published !== undefined) updateData.published = event.published;
    if (event.category !== undefined) updateData.category = event.category;
    if (event.imageUrl !== undefined) updateData.image_url = event.imageUrl;
    if (event.status !== undefined) updateData.status = event.status;
    if (event.createdAt !== undefined) updateData.created_at = event.createdAt;

    const { data, error } = await supabase.from('events').update(updateData).eq('firestore_id', id).select('*').single();
    if (error) {
      console.error("[EventService] Error updating event:", error);
      throw error;
    }
    return data ? mapSupabaseEventToTempleEvent(data) : null;
  }

  async deleteEvent(id: string) {
    const { error } = await supabase.from('events').delete().eq('firestore_id', id);
    if (error) {
      console.error("[EventService] Error deleting event:", error);
      throw error;
    }
  }

  async getPublishedEvents(): Promise<TempleEvent[]> {
    const events = await this.getEvents();
    return events.filter((event) => event.published !== false).sort((a, b) => toTimestamp(a.startDate) - toTimestamp(b.startDate));
  }

  async getUpcomingEvents(max = 3): Promise<TempleEvent[]> {
    const now = new Date();
    const events = await this.getPublishedEvents();
    return events.filter((event) => toTimestamp(event.endDate) >= now.getTime()).slice(0, max);
  }

  async getPastEvents(): Promise<TempleEvent[]> {
    const now = new Date();
    const events = await this.getPublishedEvents();
    return events.filter((event) => toTimestamp(event.endDate) < now.getTime()).sort((a, b) => toTimestamp(b.startDate) - toTimestamp(a.startDate));
  }

  async getFeaturedEvent(): Promise<TempleEvent | null> {
    const events = await this.getPublishedEvents();
    return events.find((event) => event.featured) ?? null;
  }
}

export const eventService = new EventService();
