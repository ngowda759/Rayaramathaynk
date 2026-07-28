/**
 * Test Data Management Utilities - Sprint 5
 * 
 * Provides factories, seed data, and cleanup utilities for E2E tests.
 */

// ==================== FACTORY FUNCTIONS ====================

export interface EventData {
  title: string;
  description: string;
  date: string;
  time?: string;
  location?: string;
  category?: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface UserData {
  name: string;
  email: string;
  password?: string;
  role?: 'devotee' | 'volunteer' | 'admin' | 'super_admin';
}

export interface SevaData {
  name: string;
  description: string;
  price: number;
  duration?: string;
  category?: string;
}

export interface GalleryData {
  title: string;
  description?: string;
  type?: 'image' | 'video';
  url?: string;
  tags?: string[];
}

// ==================== TEST DATA FACTORIES ====================

export class TestDataFactory {
  private counter = 0;

  private generateId(): string {
    return `test_${Date.now()}_${++this.counter}`;
  }

  createEvent(overrides: Partial<EventData> = {}): EventData {
    const id = this.generateId();
    return {
      title: `Test Event ${id}`,
      description: `Description for test event ${id}`,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '10:00 AM',
      location: 'Main Hall',
      category: 'Special',
      status: 'draft',
      ...overrides,
    };
  }

  createUser(overrides: Partial<UserData> = {}): UserData {
    const id = this.generateId();
    return {
      name: `Test User ${id}`,
      email: `test_${id}@test.com`,
      password: 'TestPassword123!',
      role: 'devotee',
      ...overrides,
    };
  }

  createSeva(overrides: Partial<SevaData> = {}): SevaData {
    const id = this.generateId();
    return {
      name: `Test Seva ${id}`,
      description: `Description for test seva ${id}`,
      price: Math.floor(Math.random() * 500) + 100,
      duration: '30 minutes',
      category: 'General',
      ...overrides,
    };
  }

  createGalleryItem(overrides: Partial<GalleryData> = {}): GalleryData {
    const id = this.generateId();
    return {
      title: `Test Gallery Item ${id}`,
      description: `Description for test gallery item ${id}`,
      type: 'image',
      url: `https://example.com/images/${id}.jpg`,
      tags: ['test', 'automation'],
      ...overrides,
    };
  }

  createAnnouncement(overrides: Partial<{ title: string; content: string; priority: string }> = {}): {
    title: string;
    content: string;
    priority: string;
    active: boolean;
  } {
    const id = this.generateId();
    return {
      title: `Test Announcement ${id}`,
      content: `Content for test announcement ${id}`,
      priority: 'normal',
      active: true,
      ...overrides,
    };
  }
}

// ==================== SEED DATA ====================

export const SeedData = {
  events: [
    { title: 'Monthly Aaradhane', category: 'Special', status: 'published' },
    { title: 'Weekend Bhajans', category: 'Regular', status: 'published' },
    { title: 'Festival Preparation', category: 'Special', status: 'draft' },
  ],

  sevas: [
    { name: 'Archana', price: 101, duration: '30 min', category: 'Regular' },
    { name: 'Mahapooja', price: 501, duration: '60 min', category: 'Special' },
    { name: 'Tulaseepooja', price: 251, duration: '45 min', category: 'Regular' },
  ],

  users: [
    { name: 'Admin User', role: 'admin', email: 'admin@test.com' },
    { name: 'Devotee User', role: 'devotee', email: 'devotee@test.com' },
    { name: 'Volunteer User', role: 'volunteer', email: 'volunteer@test.com' },
  ],

  quotes: [
    { text: 'Service to others is the highest duty.', language: 'en', featured: true },
    { text: 'ಸರ್ವರಿಗೂ ಸೇವೆ ಎಂದರೆ ದೊಡ್ಡ ಕರ್ತವ್ಯ', language: 'kn', featured: false },
  ],

  gallery: [
    { title: 'Temple Exterior', type: 'image', tags: ['temple', 'exterior'] },
    { title: 'Morning Aaradhana', type: 'image', tags: ['aaradhana', 'morning'] },
    { title: 'Festival Celebration', type: 'image', tags: ['festival', 'celebration'] },
  ],
};

// ==================== API TEST DATA ====================

export const ApiTestData = {
  invalidEmails: [
    'notanemail',
    '@nodomain.com',
    'noat.com',
    'spaces in@email.com',
    'verylong' + 'a'.repeat(100) + '@test.com',
  ],

  xssPayloads: [
    '<script>alert("XSS")</script>',
    '"><img src=x onerror=alert("XSS")>',
    "javascript:alert('XSS')",
    '<svg onload=alert("XSS")>',
    "'; alert('XSS');//",
  ],

  sqlInjectionPayloads: [
    "'; DROP TABLE events;--",
    "1' OR '1'='1",
    "'; SELECT * FROM users;--",
  ],

  validEmailDomains: ['test.com', 'example.com', 'demo.com'],

  paginationLimits: [10, 25, 50, 100],

  sortFields: ['createdAt', 'title', 'updatedAt', 'date'],
};

// ==================== TEST DATA CLEANUP ====================

export class TestDataCleanup {
  private createdItems: { collection: string; id: string }[] = [];

  track(collection: string, id: string): void {
    this.createdItems.push({ collection, id });
  }

  async cleanup(apiClient: any): Promise<void> {
    console.log(`Cleaning up ${this.createdItems.length} test items...`);
    
    for (const item of this.createdItems) {
      try {
        await apiClient.delete(`${item.collection}/${item.id}`);
      } catch (error) {
        console.warn(`Failed to cleanup ${item.collection}/${item.id}:`, error);
      }
    }
    
    this.createdItems = [];
  }

  clear(): void {
    this.createdItems = [];
  }
}

// ==================== MOCK DATA HELPERS ====================

export class MockDataHelper {
  static generateDateRange(startDays: number, endDays: number): { start: string; end: string } {
    const now = Date.now();
    const start = new Date(now + startDays * 24 * 60 * 60 * 1000);
    const end = new Date(now + endDays * 24 * 60 * 60 * 1000);
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  static generatePhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const prefix = Math.floor(Math.random() * 900) + 100;
    const line = Math.floor(Math.random() * 9000) + 1000;
    return `+1${areaCode}${prefix}${line}`;
  }

  static generateRandomPrice(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static generateKannadaText(length: number = 50): string {
    const kannadaChars = 'ಅಆಇಈಉಊಋಎಏಐಒಓಔಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += kannadaChars[Math.floor(Math.random() * kannadaChars.length)];
    }
    return result;
  }

  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ==================== TEST FIXTURES ====================

export interface TestFixture {
  name: string;
  data: any;
  cleanup?: () => Promise<void>;
}

export class TestFixtureManager {
  private fixtures: Map<string, TestFixture> = new Map();

  register(name: string, data: any, cleanup?: () => Promise<void>): void {
    this.fixtures.set(name, { name, data, cleanup });
  }

  get(name: string): any {
    const fixture = this.fixtures.get(name);
    return fixture?.data;
  }

  async cleanupAll(): Promise<void> {
    for (const fixture of this.fixtures.values()) {
      if (fixture.cleanup) {
        try {
          await fixture.cleanup();
        } catch (error) {
          console.warn(`Failed to cleanup fixture ${fixture.name}:`, error);
        }
      }
    }
    this.fixtures.clear();
  }
}

// ==================== EXPORT DEFAULT FACTORY ====================

export const testDataFactory = new TestDataFactory();
export const testCleanup = new TestCleanup();
export const testFixtures = new TestFixtureManager();

// Helper for cleanup tracking
const createdItems: { collection: string; id: string }[] = [];

export function trackTestData(collection: string, id: string): void {
  createdItems.push({ collection, id });
}

export async function cleanupTestData(): Promise<void> {
  console.log(`Cleaning up ${createdItems.length} tracked test items...`);
  createdItems.length = 0;
}

// Legacy cleanup class for backwards compatibility
class TestCleanup {
  async cleanup(): Promise<void> {
    await cleanupTestData();
  }
}
