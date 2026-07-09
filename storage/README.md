# Storage Directory

This directory contains JSON files for application data persistence.

## Purpose

During the migration from Firebase Firestore to SQL database, all application data is stored in JSON files. This provides:

- **Immediate storage** without infrastructure setup
- **Easy backup** - just copy JSON files
- **Simple debugging** - human-readable format
- **Migration ready** - repositories abstract data access

## Files

| File | Description |
|------|-------------|
| `announcements.json` | Temple announcements |
| `events.json` | Temple events |
| `poojas.json` | Daily poojas schedule |
| `sevas.json` | Seva offerings |
| `timings.json` | Temple timings |
| `galleryAlbums.json` | Gallery album metadata |
| `galleryMedia.json` | Gallery media (photos/videos) |
| `donations.json` | Donation records |
| `donationCampaigns.json` | Donation campaigns |
| `sevaBookings.json` | Seva booking requests |
| `volunteers.json` | Volunteer information |
| `members.json` | Temple member records |
| `aaradhanes.json` | Aaradhane events |
| `homepage.json` | Homepage configuration |
| `settings.json` | Site and finance settings |

## Data Format

Each file follows a consistent structure:

```json
{
  "items": [
    {
      "id": "unique-id",
      "field1": "value1",
      "field2": "value2",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Backup

To backup data:
```bash
cp -r storage/ storage-backup-$(date +%Y%m%d)/
```

## Production Note

For production deployments, consider:
1. Setting up a SQL database (PostgreSQL, MySQL, etc.)
2. Moving storage to a mounted volume or object storage
3. Implementing data validation before writes

The repository pattern ensures minimal code changes when migrating.
