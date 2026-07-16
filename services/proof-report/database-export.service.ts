// Since this runs as a script, we need to handle Firebase differently
// We'll read the data directly from the Firebase SDK structure

import { DatabaseContent } from '@/types/proof-report';
import { TempleEvent } from '@/types/event';
import { Seva } from '@/types/seva';
import { GalleryAlbum, GalleryMedia } from '@/types/gallery';
import { Announcement } from '@/types/announcement';
import { DailyPooja } from '@/types/pooja';
import { SiteSettings } from '@/types/settings';
import { HomepageConfig } from '@/types/homepage';
import { DonationRecord } from '@/types/donation';

export class DatabaseExportService {
  private firebaseConfig: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };

  constructor() {
    this.firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }

  isConfigured(): boolean {
    return !!(
      this.firebaseConfig.apiKey &&
      this.firebaseConfig.projectId &&
      this.firebaseConfig.authDomain &&
      this.firebaseConfig.appId
    );
  }

  async exportDatabase(): Promise<DatabaseContent> {
    if (!this.isConfigured()) {
      console.log('[DatabaseExportService] Firebase not configured, returning empty data');
      return this.getEmptyContent();
    }

    try {
      // Dynamic import to avoid issues when Firebase isn't configured
      const { initializeApp, getApps } = await import('firebase/app');
      const { getFirestore, getDocs, getDoc, doc, collection } = await import('firebase/firestore');

      const firebaseConfig = {
        apiKey: this.firebaseConfig.apiKey,
        authDomain: this.firebaseConfig.authDomain,
        projectId: this.firebaseConfig.projectId,
        storageBucket: this.firebaseConfig.storageBucket,
        messagingSenderId: this.firebaseConfig.messagingSenderId,
        appId: this.firebaseConfig.appId,
      };

      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      const db = getFirestore(app);

      const [
        eventsSnap,
        announcementsSnap,
        sevasSnap,
        poojasSnap,
        donationsSnap,
        galleryAlbumsSnap,
        galleryMediaSnap,
        settingsSnap,
        homepageSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'events')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'announcements')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'sevas')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'dailyPoojas')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'donations')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'galleryAlbums')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'galleryMedia')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'settings', 'config')).catch(() => null),
        getDoc(doc(db, 'homepage', 'config')).catch(() => null),
      ]);

      const events: TempleEvent[] = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TempleEvent));
      const announcements: Announcement[] = announcementsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
      const sevas: Seva[] = sevasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seva));
      const poojas: DailyPooja[] = poojasSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyPooja));
      const donations: DonationRecord[] = donationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DonationRecord));
      const galleryAlbums: GalleryAlbum[] = galleryAlbumsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryAlbum));
      const galleryMedia: GalleryMedia[] = galleryMediaSnap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryMedia));
      const settings: SiteSettings | undefined = settingsSnap?.exists() ? { id: settingsSnap.id, ...settingsSnap.data() } as SiteSettings : undefined;
      const homepage: HomepageConfig | undefined = homepageSnap?.exists() ? { ...homepageSnap.data() } as HomepageConfig : undefined;

      return {
        events,
        announcements,
        sevas,
        poojas,
        donations,
        galleryAlbums,
        galleryMedia,
        settings,
        homepage,
      };
    } catch (error) {
      console.error('[DatabaseExportService] Error exporting database:', error);
      return this.getEmptyContent();
    }
  }

  private getEmptyContent(): DatabaseContent {
    return {
      events: [] as TempleEvent[],
      announcements: [] as Announcement[],
      sevas: [] as Seva[],
      poojas: [] as DailyPooja[],
      donations: [] as DonationRecord[],
      galleryAlbums: [] as GalleryAlbum[],
      galleryMedia: [] as GalleryMedia[],
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
