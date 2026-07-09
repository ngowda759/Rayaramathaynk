# Repository Layer

This directory contains the repository layer for data access, providing an abstraction between services and storage.

## Architecture

```
React Components → Services → Repositories → JSON Files (or SQL)
     ↑              ↑           ↑
  (unchanged)  (unchanged)  (implement here)
```

## Purpose

- **Abstraction**: Services don't know where data comes from
- **Migration Ready**: Easy switch from JSON to SQL without changing services
- **Single Responsibility**: Each repository handles one data type

## Repositories

| Repository | Data Type | Storage File |
|------------|-----------|--------------|
| `announcements.repository.ts` | Announcements | `announcements.json` |
| `events.repository.ts` | Events | `events.json` |
| `poojas.repository.ts` | Daily Poojas | `poojas.json` |
| `sevas.repository.ts` | Sevas | `sevas.json` |
| `timings.repository.ts` | Temple Timings | `timings.json` |
| `gallery.repository.ts` | Gallery Albums & Media | `galleryAlbums.json`, `galleryMedia.json` |
| `donations.repository.ts` | Donations | `donations.json` |
| `donationCampaigns.repository.ts` | Donation Campaigns | `donationCampaigns.json` |
| `sevaBookings.repository.ts` | Seva Bookings | `sevaBookings.json` |
| `volunteers.repository.ts` | Volunteers | `volunteers.json` |
| `members.repository.ts` | Members | `members.json` |
| `aaradhanes.repository.ts` | Aaradhanes | `aaradhanes.json` |
| `homepage.repository.ts` | Homepage Config | `homepage.json` |
| `settings.repository.ts` | Site & Finance Settings | `settings.json` |

## Common Methods

All repositories follow a consistent interface:

```typescript
interface BaseRepository<T> {
  getAll(): Promise<T[]>;           // Get all items
  getById(id: string): Promise<T | null>;  // Get single item
  create(data): Promise<T>;          // Create new item
  update(id, data): Promise<T | null>;     // Update item
  delete(id): Promise<boolean>;       // Delete item
  count(): Promise<number>;          // Get count
}
```

## Migrating to SQL

When ready to move from JSON to SQL:

1. **Keep the repository files** - They provide the interface
2. **Update the implementation** - Replace JSON operations with SQL queries
3. **Services remain unchanged** - No modifications needed

### Example: Switching to SQL

```typescript
// Current: repositories/events.repository.ts
async getAll(): Promise<TempleEvent[]> {
  const data = await readJson<EventsData>('events.json');
  return data?.items || [];
}

// Future: repositories/events.repository.ts
async getAll(): Promise<TempleEvent[]> {
  const result = await sqlClient.query('SELECT * FROM events ORDER BY created_at DESC');
  return result.rows;
}
```

## Storage Utility

The `lib/storage.ts` file provides:

- `readJson(filename)` - Read JSON file
- `writeJson(filename, data)` - Write JSON file (atomic)
- `generateId()` - Generate unique IDs

## User Profiles

User data (authentication, roles, permissions) is managed through Firebase Authentication and Firestore. This is separate from the application data repositories.

See:
- `services/auth.service.ts` - Authentication
- `services/user.service.ts` - User profile management
- `lib/auth.ts` - Auth utilities
