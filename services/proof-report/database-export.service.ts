import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseContent } from '@/types/proof-report';

/**
 * Reads the application content the proof report summarises, from Supabase.
 *
 * This is a developer utility (`npm run generate:proof-report`), not a runtime request
 * path, so it uses the service-role client directly rather than an API route. It
 * previously read the Firestore collections events, announcements, sevas, dailyPoojas,
 * donations, galleryAlbums, galleryMedia, settings/config and homepage/config; those
 * live in Supabase now, so no Firestore client is used.
 *
 * The returned `DatabaseContent` shape is unchanged, so `proof-report.service.ts`,
 * `temple-validator.service.ts` and `html-generator.service.ts` consume the same
 * fields. Every read degrades to an empty list on error, matching the previous
 * `.catch(() => ({ docs: [] }))` behaviour.
 */
export class DatabaseExportService {
  /** True when the service-role credentials the export needs are present. */
  isConfigured(): boolean {
    return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  async exportDatabase(): Promise<DatabaseContent> {
    if (!this.isConfigured()) {
      console.log('[DatabaseExportService] Supabase not configured, returning empty data');
      return this.getEmptyContent();
    }

    try {
      // Dynamic import so the module stays loadable where `server-only` is unavailable
      // (the proof-report unit test runs under Jest), as the previous Firestore version did.
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const read = async (table: string): Promise<any[]> => {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.warn(`[DatabaseExportService] Could not read ${table}: ${error.message}`);
          return [];
        }
        return data ?? [];
      };

      const [events, announcements, sevas, poojas, donations, galleryAlbums, galleryMedia] =
        await Promise.all([
          read('events'),
          read('announcements'),
          read('sevas'),
          read('daily_poojas'),
          read('donations'),
          read('gallery_albums'),
          read('gallery_media'),
        ]);

      return {
        events,
        announcements,
        sevas,
        poojas,
        donations,
        galleryAlbums,
        galleryMedia,
        settings: await this.readSiteSettings(supabase),
        homepage: await this.readSettingsDocument(supabase, 'homepage'),
      };
    } catch (error) {
      console.error('[DatabaseExportService] Error exporting database:', error);
      return this.getEmptyContent();
    }
  }

  /** `site_settings` is a single snake_case row; the report reads camelCase fields. */
  private async readSiteSettings(
    supabase: SupabaseClient
  ): Promise<Record<string, unknown> | undefined> {
    // Two rows can share an `updated_at` value, so ordering by it alone left
    // `.maybeSingle()` non-deterministic (it could report the stray
    // `firestore_id = 'trustCommittee'` document instead of the temple identity).
    // `id` is the unique primary key, so it is the stable tiebreaker — the same
    // rule `services/settings.service.ts` uses. Neither row is modified.
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn(`[DatabaseExportService] Could not read site_settings: ${error.message}`);
      return undefined;
    }
    if (!data) return undefined;
    return {
      templeName: data.temple_name,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      address: data.address,
    };
  }

  private async readSettingsDocument(
    supabase: SupabaseClient,
    key: string
  ): Promise<Record<string, unknown> | undefined> {
    const { data, error } = await supabase
      .from('settings_documents')
      .select('data')
      .eq('document_key', key)
      .maybeSingle();
    if (error) {
      console.warn(`[DatabaseExportService] Could not read ${key} settings: ${error.message}`);
      return undefined;
    }
    return data ? (data.data as Record<string, unknown>) : undefined;
  }

  private getEmptyContent(): DatabaseContent {
    return {
      events: [],
      announcements: [],
      sevas: [],
      poojas: [],
      donations: [],
      galleryAlbums: [],
      galleryMedia: [],
    };
  }

  getUpcomingEvents(events: any[]): any[] {
    const now = new Date();
    return events
      .filter(e => {
        const endDate = e.endDate?.toDate?.() || new Date(e.endDate);
        return endDate >= now && e.published !== false;
      })
      .sort((a, b) => {
        const aDate = a.startDate?.toDate?.() || new Date(a.startDate);
        const bDate = b.startDate?.toDate?.() || new Date(b.startDate);
        return aDate.getTime() - bDate.getTime();
      });
  }

  getPastEvents(events: any[]): any[] {
    const now = new Date();
    return events
      .filter(e => {
        const endDate = e.endDate?.toDate?.() || new Date(e.endDate);
        return endDate < now && e.published !== false;
      })
      .sort((a, b) => {
        const aDate = a.startDate?.toDate?.() || new Date(a.startDate);
        const bDate = b.startDate?.toDate?.() || new Date(b.startDate);
        return bDate.getTime() - aDate.getTime();
      });
  }

  getFeaturedEvents(events: any[]): any[] {
    return events.filter(e => e.featured && e.published !== false);
  }
}
