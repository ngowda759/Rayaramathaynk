<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture

### Data Access Layer

This project uses a **Repository Pattern** for data access:

```
React Components → Services → Repositories → Storage (JSON/SQL)
     ↑              ↑           ↑
  (unchanged)  (unchanged)  (implement here)
```

**Key Locations:**
- `repositories/` - Repository implementations
- `lib/storage.ts` - JSON storage utilities
- `storage/` - JSON data files

**Important Rules:**
1. **Services** should call **Repositories**, not directly access storage
2. **Repositories** should call `lib/storage.ts` for JSON operations
3. **Components** should call **Services**, never repositories directly

### Firebase Usage

- **Authentication**: Firebase Auth is used (do not modify)
- **User Profiles**: Stored in Firestore `users` collection (managed via `services/auth.service.ts`)
- **Application Data**: Stored in `storage/*.json` files (managed via repositories)

### Date Handling

Dates are stored as ISO strings (not Firebase Timestamps):
```typescript
createdAt: new Date().toISOString()  // "2024-01-01T00:00:00.000Z"
```

When handling dates, use string/Date types, not `firebase.firestore.Timestamp`.
