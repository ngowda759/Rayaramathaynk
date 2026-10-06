# BOT-003 Chat Audit Report

## 1. Authoritative Production Source
The authoritative source for chat persistence is currently **Firebase Firestore**.
- Chat sessions are stored in the `chat_sessions` collection.
- Messages are stored in the `messages` collection.
- The `services/chat.service.ts` uses the Firebase client (`@/lib/firebase`) to interact with Firestore.

## 2. Current Runtime Source
The application currently uses `services/chat.service.ts` for all chat operations. This service directly imports and uses Firebase SDKs (`addDoc`, `getDocs`, etc.).

## 3. Existing Supabase Destination
A migration script `supabase/migrations/20260930000000_create_ai_tables.sql` already exists. It defines the tables:
- `chat_sessions`: Contains `id`, `firestore_id`, `user_id`, `message_count`, `last_message`, `detected_language`, `created_at`, `updated_at`.
- `chat_messages`: Contains `id`, `firestore_id`, `session_id`, `role`, `content`, `timestamp`, `model`, `latency`, `detected_language`.

These tables are defined correctly and ready to use.

## 4. Historical Data
Historical data in production is stored in Firestore (`chat_sessions` and `messages` collections).
The migration needs to extract this data and map it to Supabase tables using the `firestore_id` field.

## 5. Test / Seed Data
Any test/seed data needs to be carefully identified and not overwritten during the historical migration.

## 6. Legacy / Backup Collections
The `chat_sessions` and `messages` collections in Firestore will be retained as legacy backup collections. No data should be deleted from them.
