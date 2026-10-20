# M16 - Collection and table field catalogue
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against `424fdb8` (see Refresh log at the end). Verify against the code before acting on any claim.

## Answers questions about

- "What fields does collection X actually have?" - for all 64 Firestore collections and 24 Supabase tables
- "Who writes field Y and who reads it?" - every writer and reader carries `path:line`
- "Which collections have no TypeScript type at all, so the write site *is* the schema?" (19 of them)
- "Is this field declared in `types/`, or invented at a call site?"
- "Which fields are written but never read back?" (dead writes)
- "Which fields are read but never written?" (seed data, manual entry, or a bug)
- "Does `docs/DATA-MODEL.md` describe the collection the code actually uses?" (usually not)
- "What are the columns, defaults and RLS policies of Supabase table Z?"
- "Which Firestore collection does Supabase table Z mirror, and is anything using it?"
- "Where does the seva / booking / donation / event field list live?"
- "Why does the admin announcement filter use `active` but the service query use `isActive`?"
- "Which document ids exist under `settings/` and what is in each one?"
- "Which queries need a composite index that is not declared?"
- "Which collection is empty because the code writes to a differently-named twin?" (`chat_messages` vs `messages`, `aaradhane` vs `aaradhanes`, `unknown_questions` vs `ai_unknown_questions`)
- "If I add a field, which files must I touch, in what order?"
- "Which Supabase tables have a schema but no reader or writer in the app?"
- "Where is the receipt counter and what fields does it hold?"
- "Which fields disagree in name or case between the Firestore document and the Supabase column meant to replace it?"
- "How do I re-run the field harvester, and what does it miss?"
- "Which fields does the AI retrieval layer depend on?"
- "Where do Raya AI settings, knowledge articles, chat sessions/messages and unknown questions live now?" (Supabase since 2026-10-06 / 10-13 - and which admin screens still read the old Firestore copy)
- "Why does the AI analytics page show stale numbers?" / "Why does chat history not persist?" (faults F-11, F-12)
- "Why does an article written in the admin Knowledge screen not reach the chatbot?" (F-14)
- "What is `settings_documents`, and which `settings/*` document goes where in Supabase?"
- "What does `prisma/schema.prisma` cover, and does the app use Prisma?" (nine tables; no)
- "Which Firestore fields map to which Supabase columns in the ETL, and what does the ETL drop?" (`lib/supabase/migration-mappers.ts`)
- "What does the mobile app read, and will it work?" (Portability notes)
- "Which faults from 2026-09-19 are fixed?" (Faults section, Refresh log)

## Scope and method

This file is the field-level half of the data-model question. M11 lists collections, rules, indexes
and call sites and deliberately stopped short of fields
(`.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md:425-430`
says the field list "is its TypeScript type ... plus the write payload"). This file resolves that
into an actual table per store. The collection and table lists are taken from M11 and not re-derived;
one collection M11 missed is added (`chat_messages`, Firestore - see Coverage).

**The harvester.** `.claude/state/inventory/fields.mjs` - plain Node, built-in modules only,
read-only, no network. Two modes:

```
node .claude/state/inventory/fields.mjs                     # writes .claude/state/inventory/fields.json
node .claude/state/inventory/fields.mjs --expand .claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md
```

The second mode rewrites the tables in this file in place from `.claude/state/inventory/fields.json`, so every `path:line`
below comes from the harvest rather than from hand transcription. The `<!--FIELDS ...-->` /
`<!--COLUMNS ...-->` / `<!--INDEX ...-->` markers around each table are the placeholders it fills;
leave them in place or the tables stop regenerating. **Do not run `--expand` on this file** (see the
Verification log): roughly forty hand corrections - 2026-09-19 and 2026-10-18 - live inside those
blocks and would be overwritten by the harvest that was wrong. Re-run the first mode, then copy rows
across by hand. The 2026-10-18 refresh did exactly that; `.claude/state/inventory/fields.json` still stamps
`"generated": "2026-09-19"` because the date is a literal in the script
(`.claude/state/inventory/fields.mjs:456`).

What the first mode does, over 735 files (775 on 2026-10-18) under `app/ services/ lib/ hooks/ components/ scripts/
seed/ utils/ context/ data/ types/`:

1. resolves collection-name constants per file - `const COLLECTION_NAME = "sevaBookings"`, and
   object maps such as `COLLECTIONS.CHAT_MESSAGES` (`services/ai-analytics.service.ts:44-51`);
2. finds anchors - `collection(db, X)`, `doc(db, X, "<id>")`, `db.collection(X)`,
   `collectionGroup(db, X)`, `.from(X)`; a `doc(db, "settings", "aboutUs")` anchor also opens a
   per-document bucket `settings/aboutUs`;
3. takes a window around each anchor - the **whole file** when the file touches exactly one store
   (true for most services), otherwise 3 lines back and 45 forward, truncated at the next anchor
   belonging to a different store;
4. records a **write** for every top-level key of an object literal handed to
   `setDoc / addDoc / updateDoc / .set / .update / .add / .insert / .upsert`, and a **read** for
   `where('f'`, `orderBy('f'`, `.eq/.gt/.order(...)`, `.select('a,b')`, `data().f`, `<var>.f` where
   `<var>` was bound from a `.data()` call, and destructuring of a snapshot payload;
5. parses `types/**` plus `lib/ai/knowledge/types.ts` for declared interfaces, and
   `supabase/migrations/*.sql` for `CREATE TABLE`, `CREATE POLICY` and `CREATE INDEX`.

**What it cannot see.** Every table below carries the residue of these blind spots, so open the file
before acting on anything load-bearing:

- **Spread writes.** `addDoc(ref, { ...data, createdAt: serverTimestamp() })` yields exactly two
  field names. This is why `sevas`, `bills`, `dailyPoojas`, `members`, `volunteers`, `galleryAlbums`,
  `aaradhane` and `feedback` look almost write-free. For those the declared type is the truth, and
  the "read by" column is the practical field list.
- **Payloads passed through a variable.** `const record = { ... }; .upsert(record)` is invisible:
  `lib/receipt/admin.ts:138`, every `lib/supabase/migration-mappers.ts` row builder, and
  `lib/ai/knowledge/repository.ts:223-237`. (The 2026-09-19 example, `services/chat.service.ts`
  `messageData`, was rewritten as an inline Supabase insert on 2026-10-06 and is now harvested.)
- **Writes through REST helpers or loop variables (added 2026-10-18).** `addDocument` /
  `updateDocument` / `deleteDocument` from `lib/firebase-admin-rest.ts` (the admin knowledge routes)
  and `.from(table)` inside `for (const { table, rows } of ...)` loops (`scripts/migrate-settings.ts`,
  `scripts/migrate-staged-phase1.ts`, `lib/supabase/migration-runner.ts`) are not anchors, so those
  writes are missing from `.claude/state/inventory/fields.json`. The affected tables (`knowledge`, `settings_documents`,
  `site_settings`, `social_links`, `events`) were completed by hand.
- **`ALTER TABLE` is not parsed (added 2026-10-18).** The SQL pass reads `CREATE TABLE` only, so
  type widenings and dropped `NOT NULL`s (`seva_bookings.seva_id`, `donations.campaign_id`,
  `gallery_media.album_id`, three `events` columns) still show their original definition in
  `.claude/state/inventory/fields.json`; the column tables below carry the altered definition by hand.
- **Computed keys.** `` {[`pages.${data.path}`]: increment(1)} `` (`services/pageviews.service.ts:70`)
  and the dotted `trafficSources.*` / `deviceBreakdown.*` paths at `:59-60`.
- **Mappers far from the anchor in a multi-store file.** Single-store files are read whole, so most
  services are exact; multi-store files leak fields across store boundaries. On 2026-10-18 the worst
  offenders are `services/ai-analytics.service.ts` (Firestore `ai_settings` / `ai_token_usage` /
  counts beside four Supabase tables) and `scripts/migrate-staged-phase1.ts`, which files the
  `settings` field names (`templeName`, `facebook`, ...) under `events`. The old
  `lib/ai/ai-settings/repository.ts` leak (`ai_settings` blocks under `unknown_questions`) is gone: that
  file is Supabase-only now.
- **Same-named stores share one bucket.** Firestore `unknown_questions` and the Supabase table of
  that name; likewise `sevas`, `events`, `chat_sessions`, `ai_latency_records`,
  `ai_intent_distribution`. The per-collection note says which writer belongs to which store.
  This is also why the `W`/`R` numbers on a Supabase row of the Index can be non-zero while its
  migration state reads "schema only, no app code" - those counts come from the Firestore twin.
  Twelve tables had **no `.from("<table>")` anywhere in the tree** on 2026-09-19. Re-grepped on
  2026-10-18: nine still have none - `users`, `donations`, `profiles`, `testimonials`,
  `donation_campaigns`, `volunteer_requests`, `gallery_albums`, `gallery_media`, `aaradhanes`;
  `chat_sessions` and `chat_messages` are now live (`services/chat.service.ts`) and `seva_bookings`
  is script-only (`scripts/migrate-seva-bookings-to-supabase.ts`). `ai_knowledge` and
  `settings_documents` are reached through a constant or loop variable, not a literal.
- **One-collection-per-line files leak across lines.** `app/admin/content/page.tsx:89-99` and
  `:119-121,168-169` are arrays with a *different* collection on each line, and the window spills
  one line either way. Six collections there carry cells that belong to a neighbour: verified
  attributions are `events` `date`:90 / `updatedAt`:119 / `active`:168, `announcements`
  `active`:92 / `updatedAt`:120, `gallery` count:93, `sevas` count:94, `poojas` count:95,
  `knowledge` `updatedAt`:121, `testimonials` `approved`:98, `volunteer_requests` count:99
  (unfiltered). Any cell in this file that disagrees with that list is bleed.
- **Seed JSON.** Fields that only ever arrive from `seed/ai/*.json`, `data/exports/*.json` or
  `quotes-seed-data.json` never appear as identifiers in the source tree and are not harvested.
- **`tests/` is not scanned**, so a field used only in a test does not appear.

Regex harvesting over- and under-matches. API noise (`count`, `onConflict`, `merge`, `ascending`,
`head`) is filtered inside the script. Fields marked `declared` were matched against a `types/`
interface; fields marked `not in the type` exist only at a call site and were spot-checked by hand
for the collections that carry business data.

## Index

`F` = fields catalogued (columns, for Supabase), `W` = write sites, `R` = read sites.

Three cautions on this table, added by verification. (1) On a **Firestore** row `F` is the
*harvested* field count, not the number of rows in that collection's table below - the tables also
carry type-declared fields with no call site, so `F` sums to 589 (584 on 2026-09-19) while the
Firestore tables hold 782 rows (735 collection rows + 47 per-document rows; 844 on 2026-09-19). On a
Supabase row `F` *is* the column count from `CREATE TABLE`, and those sum to 313 across 24 tables
(277 across 21 on 2026-09-19). (2) `W` and `R` on a Supabase row are the shared-bucket counts of the
same-named store, which since 2026-10 is usually the Supabase table itself for the AI tables but
still the Firestore twin for `events`, `sevas` and the schema-only tables; read the migration-state
column, not the numbers. The `F`/`W`/`R` columns were regenerated from the 2026-10-18 harvest; the
migration-state column was rewritten by hand. (3) Wherever a subsection says "entry *n*" of `firestore.indexes.json`, *n* is the
**zero-based** array position (`entry 0` = `users` `role`+`createdAt`).

<!--INDEX fs | aaradhane | types/aaradhane.ts#Aaradhane | Firestore only;
fs | aaradhanes | types/aaradhane.ts#Aaradhane | duplicate of `aaradhane`;
fs | ai_intent_distribution | types/ai-analytics.ts#IntentDistributionRecord | legacy: SB write + read; FS read by admin page only;
fs | ai_latency_records | types/ai-analytics.ts#LatencyRecord | legacy: SB write + read; FS read by admin page only;
fs | ai_settings | types/ai-settings.ts#AISettings | superseded by SB `ai_settings`; FS read = analytics kill-switch;
fs | ai_token_usage | types/ai-analytics.ts#TokenUsageRecord | Firestore only, no table;
fs | ai_unknown_questions | types/ai-analytics.ts#UnknownQuestionRecord | no code since 2026-10-13; migration source only;
fs | announcements | types/announcement.ts#Announcement | Firestore only;
fs | articles | - | no code (removed 2026-10);
fs | bills | types/billing.ts#Bill | Firestore only, no table;
fs | bookmarks | types/profile.ts#Bookmark | Firestore only;
fs | chat_messages | - | empty; FS count only (messages now in SB);
fs | chat_metrics | types/analytics.ts#ConversationMetric | Firestore only;
fs | chat_sessions | types/ai.ts#ChatSession | split: FS conversation state / SB summary;
fs | chatTraining | - | Firestore only, write-only since 2026-10-14;
fs | daily_page_stats | - | Firestore only;
fs | dailyPoojas | types/pooja.ts#DailyPooja | Firestore only, table unused;
fs | donation_campaigns | types/donationCampaign.ts#DonationCampaign | Firestore only;
fs | donations | types/donation.ts#DonationRecord | Firestore only;
fs | events | types/event.ts#TempleEvent | dual, diverging;
fs | featuredContent | - | Firestore only;
fs | feedback | types/ai.ts#ChatFeedback | Firestore only;
fs | futurePlans | - | rule only, no code;
fs | gallery | - | Firestore only, counted only;
fs | galleryAlbums | types/gallery.ts#GalleryAlbum | Firestore only;
fs | galleryMedia | types/gallery.ts#GalleryMedia | Firestore only;
fs | guruParampara | types/aaradhane-generator.ts#GuruParamparaCollection | Firestore only;
fs | homepage | types/homepage.ts#HomepageConfig | Firestore only;
fs | intent_feedback | - | Firestore only;
fs | intent_metrics | types/analytics.ts#IntentMetric | Firestore only;
fs | knowledge | lib/ai/knowledge/types.ts#KnowledgeArticle | split brain: admin writes FS, AI reads SB `ai_knowledge`;
fs | knowledge_articles | - | rule only, no code;
fs | knowledge_audit_log | types/knowledge-workflow.ts#AuditLogEntry | Firestore only;
fs | knowledge_categories | - | rule only, no code;
fs | knowledge_committee_approvals | types/knowledge-workflow.ts#CommitteeApproval | Firestore only;
fs | knowledge_drafts | types/knowledge-workflow.ts#DraftArticle | Firestore only;
fs | knowledge_review_comments | types/knowledge-workflow.ts#ReviewComment | Firestore only;
fs | knowledge_versions | types/knowledge-workflow.ts#ArticleVersion | Firestore only;
fs | knowledge_workflow | types/knowledge-workflow.ts#WorkflowArticle | Firestore only;
fs | knowledge_workflow_actions | types/knowledge-workflow.ts#WorkflowAction | Firestore only;
fs | members | types/volunteer.ts#Member | Firestore only;
fs | messages | types/ai.ts#AIMessage | no code (moved to SB `chat_messages` 2026-10-06);
fs | notifications | - | Firestore only;
fs | page_views | - | Firestore only, ~47k docs;
fs | panchanga | - | never in a database;
fs | poojas | - | Firestore only, counted only;
fs | profiles | types/profile.ts#DevoteeProfile | Firestore only;
fs | quotes | types/quote.ts#Quote | Firestore only, no table;
fs | receipts | types/receipt.ts#Receipt | Firestore only, no table;
fs | receiptSevas | types/receiptSeva.ts#ReceiptSeva | Firestore only, no table;
fs | sevaBookings | types/seva-booking.ts#SevaBooking | Firestore live; SB copy by script;
fs | sevas | types/seva.ts#Seva | split brain: SB read / FS write;
fs | settings | types/settings.ts#SiteSettings | partly SB site_settings/social_links; rest copied to settings_documents;
fs | system | - | Firestore only, server SDK;
fs | temple_areas | types/temple-explorer.ts#TempleArea | Supabase only, FS path unused;
fs | test | - | debug leftover;
fs | testimonials | types/homepage.ts#Testimonial | Firestore only;
fs | timings | - | Firestore only;
fs | trust | - | no code (removed 2026-10);
fs | trustCommittee | - | rule only, no code;
fs | unknown_questions | types/analytics.ts#UnknownQuestion | FS: one legacy writer + admin page; SB is main;
fs | users | types/user.ts#UserProfile | Firestore only;
fs | volunteer_requests | types/ai.ts#VolunteerRequest | Firestore only;
fs | volunteers | types/volunteer.ts#Volunteer | Firestore only;
sb | aaradhanes | - | schema only, no app code;
sb | ai_intent_distribution | - | live: written + read by the app (since 2026-10-13);
sb | ai_knowledge | - | live since 2026-10-13: AI reads; admin still writes FS;
sb | ai_latency_records | - | live: written + read by the app (since 2026-10-13);
sb | ai_settings | - | live since 2026-10-12; replaces FS ai_settings;
sb | chat_messages | - | live since 2026-10-06; anon client vs deny-all;
sb | chat_sessions | - | live since 2026-10-06 (summary only); anon client vs deny-all;
sb | daily_poojas | - | script-populated, no reader;
sb | donation_campaigns | - | schema only, no app code;
sb | donations | - | schema only, no app code;
sb | events | - | read + written by the app (anon);
sb | gallery_albums | - | schema only, no app code;
sb | gallery_media | - | schema only, no app code;
sb | profiles | - | schema only, no app code;
sb | settings_documents | - | script-populated (JSONB copy of settings/*), no app code;
sb | seva_bookings | - | script-populated, no app code;
sb | sevas | - | read by the app, written in Firestore;
sb | site_settings | - | read (anon) + written (server action, service role);
sb | social_links | - | read by the app, written by nobody;
sb | temple_areas | - | Supabase only, live;
sb | testimonials | - | schema only, no app code;
sb | unknown_questions | - | main store: three writers, two readers;
sb | users | - | schema only, no app code;
sb | volunteer_requests | - | schema only, no app code-->
| store | kind | type file | F | W | R | migration state | jump |
|---|---|---|---|---|---|---|---|
| `aaradhane` | Firestore | `types/aaradhane.ts#Aaradhane` | 10 | 2 | 9 | Firestore only | [→](#fs-aaradhane) |
| `aaradhanes` | Firestore | `types/aaradhane.ts#Aaradhane` | 1 | 0 | 1 | duplicate of `aaradhane` | [→](#fs-aaradhanes) |
| `ai_intent_distribution` | Firestore | `types/ai-analytics.ts#IntentDistributionRecord` | 9 | 7 | 11 | legacy: SB write + read; FS read by admin page only | [→](#fs-ai_intent_distribution) |
| `ai_latency_records` | Firestore | `types/ai-analytics.ts#LatencyRecord` | 15 | 9 | 11 | legacy: SB write + read; FS read by admin page only | [→](#fs-ai_latency_records) |
| `ai_settings` | Firestore | `types/ai-settings.ts#AISettings` | 14 | 26 | 24 | superseded by SB `ai_settings`; FS read = analytics kill-switch | [→](#fs-ai_settings) |
| `ai_token_usage` | Firestore | `types/ai-analytics.ts#TokenUsageRecord` | 2 | 1 | 5 | Firestore only, no table | [→](#fs-ai_token_usage) |
| `ai_unknown_questions` | Firestore | `types/ai-analytics.ts#UnknownQuestionRecord` | 0 | 0 | 0 | no code since 2026-10-13; migration source only | [→](#fs-ai_unknown_questions) |
| `announcements` | Firestore | `types/announcement.ts#Announcement` | 8 | 3 | 36 | Firestore only | [→](#fs-announcements) |
| `articles` | Firestore | **none** | 0 | 0 | 0 | no code (removed 2026-10) | [→](#fs-articles) |
| `bills` | Firestore | `types/billing.ts#Bill` | 22 | 8 | 30 | Firestore only, no table | [→](#fs-bills) |
| `bookmarks` | Firestore | `types/profile.ts#Bookmark` | 4 | 0 | 6 | Firestore only | [→](#fs-bookmarks) |
| `chat_messages` | Firestore | **none** | 8 | 8 | 11 | empty; FS count only (messages now in SB) | [→](#fs-chat_messages) |
| `chat_metrics` | Firestore | `types/analytics.ts#ConversationMetric` | 2 | 2 | 0 | Firestore only | [→](#fs-chat_metrics) |
| `chat_sessions` | Firestore | `types/ai.ts#ChatSession` | 20 | 20 | 44 | split: FS conversation state / SB summary | [→](#fs-chat_sessions) |
| `chatTraining` | Firestore | **none** | 7 | 17 | 0 | Firestore only, write-only since 2026-10-14 | [→](#fs-chattraining) |
| `daily_page_stats` | Firestore | **none** | 6 | 3 | 3 | Firestore only | [→](#fs-daily_page_stats) |
| `dailyPoojas` | Firestore | `types/pooja.ts#DailyPooja` | 12 | 4 | 35 | Firestore only, table unused | [→](#fs-dailypoojas) |
| `donation_campaigns` | Firestore | `types/donationCampaign.ts#DonationCampaign` | 8 | 3 | 9 | Firestore only | [→](#fs-donation_campaigns) |
| `donations` | Firestore | `types/donation.ts#DonationRecord` | 18 | 10 | 32 | Firestore only | [→](#fs-donations) |
| `events` | Firestore | `types/event.ts#TempleEvent` | 31 | 12 | 128 | dual, diverging | [→](#fs-events) |
| `featuredContent` | Firestore | **none** | 13 | 16 | 14 | Firestore only | [→](#fs-featuredcontent) |
| `feedback` | Firestore | `types/ai.ts#ChatFeedback` | 1 | 0 | 1 | Firestore only | [→](#fs-feedback) |
| `futurePlans` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-futureplans) |
| `gallery` | Firestore | **none** | 2 | 0 | 2 | Firestore only, counted only | [→](#fs-gallery) |
| `galleryAlbums` | Firestore | `types/gallery.ts#GalleryAlbum` | 5 | 3 | 5 | Firestore only | [→](#fs-galleryalbums) |
| `galleryMedia` | Firestore | `types/gallery.ts#GalleryMedia` | 10 | 4 | 16 | Firestore only | [→](#fs-gallerymedia) |
| `guruParampara` | Firestore | `types/aaradhane-generator.ts#GuruParamparaCollection` | 2 | 4 | 3 | Firestore only | [→](#fs-guruparampara) |
| `homepage` | Firestore | `types/homepage.ts#HomepageConfig` | 1 | 1 | 0 | Firestore only | [→](#fs-homepage) |
| `intent_feedback` | Firestore | **none** | 8 | 8 | 8 | Firestore only | [→](#fs-intent_feedback) |
| `intent_metrics` | Firestore | `types/analytics.ts#IntentMetric` | 7 | 5 | 9 | Firestore only | [→](#fs-intent_metrics) |
| `knowledge` | Firestore | `lib/ai/knowledge/types.ts#KnowledgeArticle` | 13 | 7 | 30 | split brain: admin writes FS, AI reads SB `ai_knowledge` | [→](#fs-knowledge) |
| `knowledge_articles` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-knowledge_articles) |
| `knowledge_audit_log` | Firestore | `types/knowledge-workflow.ts#AuditLogEntry` | 8 | 1 | 11 | Firestore only | [→](#fs-knowledge_audit_log) |
| `knowledge_categories` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-knowledge_categories) |
| `knowledge_committee_approvals` | Firestore | `types/knowledge-workflow.ts#CommitteeApproval` | 8 | 10 | 14 | Firestore only | [→](#fs-knowledge_committee_approvals) |
| `knowledge_drafts` | Firestore | `types/knowledge-workflow.ts#DraftArticle` | 9 | 5 | 11 | Firestore only | [→](#fs-knowledge_drafts) |
| `knowledge_review_comments` | Firestore | `types/knowledge-workflow.ts#ReviewComment` | 8 | 9 | 10 | Firestore only | [→](#fs-knowledge_review_comments) |
| `knowledge_versions` | Firestore | `types/knowledge-workflow.ts#ArticleVersion` | 10 | 3 | 25 | Firestore only | [→](#fs-knowledge_versions) |
| `knowledge_workflow` | Firestore | `types/knowledge-workflow.ts#WorkflowArticle` | 19 | 18 | 51 | Firestore only | [→](#fs-knowledge_workflow) |
| `knowledge_workflow_actions` | Firestore | `types/knowledge-workflow.ts#WorkflowAction` | 7 | 7 | 9 | Firestore only | [→](#fs-knowledge_workflow_actions) |
| `members` | Firestore | `types/volunteer.ts#Member` | 2 | 3 | 1 | Firestore only | [→](#fs-members) |
| `messages` | Firestore | `types/ai.ts#AIMessage` | 0 | 0 | 0 | no code (moved to SB `chat_messages` 2026-10-06) | [→](#fs-messages) |
| `notifications` | Firestore | **none** | 14 | 9 | 9 | Firestore only | [→](#fs-notifications) |
| `page_views` | Firestore | **none** | 8 | 8 | 6 | Firestore only, ~47k docs | [→](#fs-page_views) |
| `panchanga` | Firestore | **none** | 0 | 0 | 0 | never in a database | [→](#fs-panchanga) |
| `poojas` | Firestore | **none** | 1 | 0 | 1 | Firestore only, counted only | [→](#fs-poojas) |
| `profiles` | Firestore | `types/profile.ts#DevoteeProfile` | 10 | 7 | 13 | Firestore only | [→](#fs-profiles) |
| `quotes` | Firestore | `types/quote.ts#Quote` | 25 | 7 | 32 | Firestore only, no table | [→](#fs-quotes) |
| `receipts` | Firestore | `types/receipt.ts#Receipt` | 2 | 0 | 4 | Firestore only, no table | [→](#fs-receipts) |
| `receiptSevas` | Firestore | `types/receiptSeva.ts#ReceiptSeva` | 3 | 2 | 1 | Firestore only, no table | [→](#fs-receiptsevas) |
| `sevaBookings` | Firestore | `types/seva-booking.ts#SevaBooking` | 19 | 15 | 60 | Firestore live; SB copy by script | [→](#fs-sevabookings) |
| `sevas` | Firestore | `types/seva.ts#Seva` | 11 | 16 | 39 | split brain: SB read / FS write | [→](#fs-sevas) |
| `settings` | Firestore | `types/settings.ts#SiteSettings` | 91 | 15 | 283 | partly SB site_settings/social_links; rest copied to settings_documents | [→](#fs-settings) |
| `system` | Firestore | **none** | 3 | 3 | 0 | Firestore only, server SDK | [→](#fs-system) |
| `temple_areas` | Firestore | `types/temple-explorer.ts#TempleArea` | 13 | 1 | 14 | Supabase only, FS path unused | [→](#fs-temple_areas) |
| `test` | Firestore | **none** | 2 | 2 | 0 | debug leftover | [→](#fs-test) |
| `testimonials` | Firestore | `types/homepage.ts#Testimonial` | 12 | 5 | 45 | Firestore only | [→](#fs-testimonials) |
| `timings` | Firestore | **none** | 6 | 0 | 6 | Firestore only | [→](#fs-timings) |
| `trust` | Firestore | **none** | 0 | 0 | 0 | no code (removed 2026-10) | [→](#fs-trust) |
| `trustCommittee` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-trustcommittee) |
| `unknown_questions` | Firestore | `types/analytics.ts#UnknownQuestion` | 20 | 38 | 38 | FS: one legacy writer + admin page; SB is main | [→](#fs-unknown_questions) |
| `users` | Firestore | `types/user.ts#UserProfile` | 14 | 81 | 20 | Firestore only | [→](#fs-users) |
| `volunteer_requests` | Firestore | `types/ai.ts#VolunteerRequest` | 3 | 1 | 3 | Firestore only | [→](#fs-volunteer_requests) |
| `volunteers` | Firestore | `types/volunteer.ts#Volunteer` | 2 | 3 | 1 | Firestore only | [→](#fs-volunteers) |
| `aaradhanes` | Supabase | **none** | 15 | 0 | 1 | schema only, no app code | [→](#sb-aaradhanes) |
| `ai_intent_distribution` | Supabase | **none** | 9 | 7 | 11 | live: written + read by the app (since 2026-10-13) | [→](#sb-ai_intent_distribution) |
| `ai_knowledge` | Supabase | **none** | 14 | 9 | 34 | live since 2026-10-13: AI reads; admin still writes FS | [→](#sb-ai_knowledge) |
| `ai_latency_records` | Supabase | **none** | 11 | 9 | 11 | live: written + read by the app (since 2026-10-13) | [→](#sb-ai_latency_records) |
| `ai_settings` | Supabase | **none** | 15 | 26 | 24 | live since 2026-10-12; replaces FS ai_settings | [→](#sb-ai_settings) |
| `chat_messages` | Supabase | **none** | 9 | 8 | 11 | live since 2026-10-06; anon client vs deny-all | [→](#sb-chat_messages) |
| `chat_sessions` | Supabase | **none** | 8 | 20 | 44 | live since 2026-10-06 (summary only); anon client vs deny-all | [→](#sb-chat_sessions) |
| `daily_poojas` | Supabase | **none** | 14 | 0 | 1 | script-populated, no reader | [→](#sb-daily_poojas) |
| `donation_campaigns` | Supabase | **none** | 10 | 3 | 9 | schema only, no app code | [→](#sb-donation_campaigns) |
| `donations` | Supabase | **none** | 16 | 10 | 32 | schema only, no app code | [→](#sb-donations) |
| `events` | Supabase | **none** | 16 | 12 | 128 | read + written by the app (anon) | [→](#sb-events) |
| `gallery_albums` | Supabase | **none** | 10 | 0 | 0 | schema only, no app code | [→](#sb-gallery_albums) |
| `gallery_media` | Supabase | **none** | 15 | 0 | 0 | schema only, no app code | [→](#sb-gallery_media) |
| `profiles` | Supabase | **none** | 16 | 7 | 13 | schema only, no app code | [→](#sb-profiles) |
| `settings_documents` | Supabase | **none** | 7 | 0 | 0 | script-populated (JSONB copy of settings/*), no app code | [→](#sb-settings_documents) |
| `seva_bookings` | Supabase | **none** | 21 | 0 | 1 | script-populated, no app code | [→](#sb-seva_bookings) |
| `sevas` | Supabase | **none** | 12 | 16 | 39 | read by the app, written in Firestore | [→](#sb-sevas) |
| `site_settings` | Supabase | **none** | 10 | 6 | 8 | read (anon) + written (server action, service role) | [→](#sb-site_settings) |
| `social_links` | Supabase | **none** | 18 | 0 | 15 | read by the app, written by nobody | [→](#sb-social_links) |
| `temple_areas` | Supabase | **none** | 16 | 1 | 14 | Supabase only, live - full CRUD, `W` undercounts (see note) | [→](#sb-temple_areas) |
| `testimonials` | Supabase | **none** | 13 | 5 | 45 | schema only, no app code | [→](#sb-testimonials) |
| `unknown_questions` | Supabase | **none** | 18 | 38 | 38 | main store: three writers, two readers | [→](#sb-unknown_questions) |
| `users` | Supabase | **none** | 10 | 81 | 20 | schema only, no app code | [→](#sb-users) |
| `volunteer_requests` | Supabase | **none** | 10 | 1 | 3 | schema only, no app code | [→](#sb-volunteer_requests) |
<!--END-->

## Firestore collections

One subsection per collection, alphabetical. Each carries four header lines - declared type, rule,
index, migration state - then the field table, then the notes that the table cannot express.

### fs `aaradhane`

**Declared type:** `types/aaradhane.ts#Aaradhane` (`types/aaradhane.ts:1`)  
**Rule:** `firestore.rules:125`  
**Index:** none  
**Migration:** Firestore only. The Supabase `aaradhanes` table exists but no app code touches it.

<!--FIELDS aaradhane | types/aaradhane.ts#Aaradhane-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | `services/aaradhane.service.ts:227` | - | declared |
| `createdBy` | `string` | yes | `services/aaradhane.service.ts:227` | - | declared |
| `dates` | `string[]` | yes | - | `lib/ai/retrieval/aaradhane.ts:37` | declared |
| `description` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:44` | declared |
| `displayOrder` | `number` | yes | - | `services/aaradhane.service.ts:164`<br>`lib/ai/retrieval/aaradhane.ts:66` | declared |
| `guruName` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:42` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | - | - | declared, **no call site** |
| `isUpcoming` | `boolean` | yes | - | - | declared, **no call site** |
| `offerings` | `string[]` | yes | - | `lib/ai/retrieval/aaradhane.ts:47` | declared |
| `rituals` | `string[]` | yes | - | `lib/ai/retrieval/aaradhane.ts:46` | declared |
| `sevaDetails` | `AaradhaneSeva[]` | yes | - | - | declared, **no call site** |
| `significance` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:45` | declared |
| `title` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:41` | declared |
<!--END-->

The create payload is a spread (`services/aaradhane.service.ts:227-231`), so only `createdBy` and
`createdAt` are visible as writes; the real written shape is `Aaradhane` minus `id/createdAt/createdBy`.
`updateAaradhane` (`:241`) passes the caller's object straight through with no `updatedAt`, so
aaradhane documents have no modification timestamp at all. The reader that matters is the AI
retriever, `lib/ai/retrieval/aaradhane.ts:37-47`.

### fs `aaradhanes`

**Declared type:** `types/aaradhane.ts#Aaradhane` (same shape as `aaradhane`)  
**Rule:** `firestore.rules:130`  
**Index:** none  
**Migration:** Firestore only - a duplicate of `aaradhane` kept for delete fallback.

<!--FIELDS aaradhanes | types/aaradhane.ts#Aaradhane-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | - | - | declared, **no call site** |
| `createdBy` | `string` | yes | - | - | declared, **no call site** |
| `dates` | `string[]` | yes | - | - | declared, **no call site** |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | `services/aaradhane.service.ts:175` | declared |
| `guruName` | `string` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | - | - | declared, **no call site** |
| `isUpcoming` | `boolean` | yes | - | - | declared, **no call site** |
| `offerings` | `string[]` | yes | - | - | declared, **no call site** |
| `rituals` | `string[]` | yes | - | - | declared, **no call site** |
| `sevaDetails` | `AaradhaneSeva[]` | yes | - | - | declared, **no call site** |
| `significance` | `string` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

Nothing creates documents here. `services/aaradhane.service.ts:175` lists it and `:262` deletes from
it when the delete against `aaradhane` missed (`:249-266`). Two collections, one concept - a rename
that was never finished. Since 2026-09-29 a read-only diagnostic counts both side by side
(`scripts/check-collisions.ts:12-13`), and the batched ETL maps both onto the one Supabase table
`aaradhanes` with the same mapper (`scripts/migrate-all-batched.ts:115-116`).

### fs `ai_intent_distribution`

**Declared type:** `types/ai-analytics.ts#IntentDistributionRecord` (`types/ai-analytics.ts:44`)  
**Rule:** `firestore.rules:213`  
**Index:** `firestore.indexes.json` entry 18, single-field `timestamp` DESC - a no-op, Firestore indexes single fields automatically.  
**Migration (2026-10-18):** **legacy Firestore read only.** The writer and the service reader are both on the Supabase table now (`services/ai-analytics.service.ts:170-182` insert, `:372` select); the only Firestore reader left is the admin analytics page, `app/admin/ai/analytics/page.tsx:305-310`.

<!--FIELDS ai_intent_distribution | types/ai-analytics.ts#IntentDistributionRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `category` | `IntentCategory` | yes | `services/ai-analytics.service.ts:174` (sb) | `services/ai-analytics.service.ts:399` (sb) | declared |
| `confidence` | `number` | yes | `services/ai-analytics.service.ts:176` (sb) | `services/ai-analytics.service.ts:401` (sb) | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intent` | `Intent` | yes | `services/ai-analytics.service.ts:173` (sb) | `services/ai-analytics.service.ts:398` (sb) | declared |
| `language` | `"en" \| "kn" \| "mixed"` | yes | `services/ai-analytics.service.ts:175` (sb) | `services/ai-analytics.service.ts:382`<br>`services/ai-analytics.service.ts:400` (sb) | declared |
| `messageId` | `string` | yes | `services/ai-analytics.service.ts:178` (sb, as `message_id`) | `services/ai-analytics.service.ts:397` (sb, from `message_id`) | declared |
| `sessionId` | `string` | yes | `services/ai-analytics.service.ts:177` (sb, as `session_id`) | `services/ai-analytics.service.ts:396` (sb, from `session_id`) | declared |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:179` (sb) | `app/admin/ai/analytics/page.tsx:308` (fs)<br>`services/ai-analytics.service.ts:375-385` (sb) | declared |
<!--END-->

Refreshed by hand on 2026-10-18 (the Verification log warns against `--expand`). Every cell marked
(sb) is a Supabase column access, read back through the camelCase mapper at
`services/ai-analytics.service.ts:394-403`; the Firestore collection receives no writes from the
application any more. The snake_case rows that used to sit in this table now live under sb
`ai_intent_distribution`, and the `addedToKnowledge` / `reviewed` window-bleed rows went with the
Firestore `ai_unknown_questions` writer. Consequence: `app/admin/ai/analytics/page.tsx:305-310`
charts whatever Firestore held before the BOT-004 migration (2026-10-13) and never grows - fault F-12.

### fs `ai_latency_records`

**Declared type:** `types/ai-analytics.ts#LatencyRecord` (`types/ai-analytics.ts:27`)  
**Rule:** `firestore.rules:207`  
**Index:** entry 16, single-field `timestamp` DESC (no-op).  
**Migration (2026-10-18):** **legacy Firestore read only** - the same split as `ai_intent_distribution`. Writer `services/ai-analytics.service.ts:134-146` and service reader `:325-353` are Supabase; `app/admin/ai/analytics/page.tsx:313-318` still reads Firestore.

<!--FIELDS ai_latency_records | types/ai-analytics.ts#LatencyRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `errorType` | `"timeout" \| "rate_limit" \| "api_error" \|` | no | - | `services/ai-analytics.service.ts:352` (sb, from `error_type`) | declared |
| `generationTime` | `number` | yes | - | `services/ai-analytics.service.ts:349` (sb) | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intent` | `Intent` | **no** (was yes) | - | - | declared optional on 2026-10-13, comment "Deprecated/Removed in Supabase schema" (`types/ai-analytics.ts:36`); **no call site** |
| `intentDetectionTime` | `number` | yes | - | `services/ai-analytics.service.ts:347` (sb) | declared |
| `messageId` | `string` | **no** (was yes) | - | - | declared optional (`types/ai-analytics.ts:30`); **no call site**, no column |
| `retrievalTime` | `number` | yes | - | `services/ai-analytics.service.ts:348` (sb) | declared |
| `sessionId` | `string` | yes | - | `services/ai-analytics.service.ts:345` (sb) | declared |
| `success` | `boolean` | yes | `services/ai-analytics.service.ts:141` (sb) | `services/ai-analytics.service.ts:351` (sb) | declared |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:145` (sb) | `app/admin/ai/analytics/page.tsx:316` (fs)<br>`services/ai-analytics.service.ts:328-334` (sb) | declared |
| `totalLatency` | `number` | yes | - | `services/ai-analytics.service.ts:346` (sb) | declared |
<!--END-->

Refreshed by hand on 2026-10-18. The snake_case write rows (`total_latency`, `intent_detection_time`,
`retrieval_time`, `generation_time`, `error_type`, `model`, `session_id`) now live under sb
`ai_latency_records`, where they belong. `getLatencyMetrics` no longer accepts an `intent` filter
(`services/ai-analytics.service.ts:318-320` takes `Omit<AnalyticsQueryParams, "intent">`), which is
why `intent` and `messageId` became optional in the type: neither has a column.

### fs `ai_settings`

**Declared type:** `types/ai-settings.ts#AISettings` (`types/ai-settings.ts:340`) - but see below: the type now describes the Supabase row.  
**Rule:** `firestore.rules:226` - **`allow write: if true`**, world-writable (unchanged).  
**Index:** none  
**Migration (2026-10-18):** **superseded by Supabase `ai_settings`** (BOT-001, commit `fae5d51`, 2026-10-06). The AI settings repositories no longer touch Firestore. Two Firestore call sites survive: the analytics kill-switch reader `services/ai-analytics.service.ts:63-72` and the legacy seed `scripts/seed-ai-settings.ts:504`.

<!--FIELDS ai_settings | types/ai-settings.ts#AISettings-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aiBehavior` | `AIBehaviorSettings` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
| `aiResponses` | `AIResponses` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
| `enabled`, `trackLatency`, `trackIntentDistribution`, `trackUnknownQuestions`, `trackTokenUsage` | `AIAnalyticsSettings` (`types/ai-analytics.ts:248`) | - | **nobody** | `services/ai-analytics.service.ts:71` (whole first document cast) | the analytics switches; never written - fault F-13 |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intents` | `IntentSettings` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
| `prompt` | `PromptSettings` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
| `templeInformation` | `TempleInformation` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
| `templePolicies` | `TemplePolicies` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
| `updatedAt` | `Date` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared |
| `updatedBy` | `string` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared |
| `visitorInformation` | `VisitorInformation` | yes | `scripts/seed-ai-settings.ts:504` (seed) | - | declared; Firestore copy is legacy |
<!--END-->

Until 2026-10-06 this was one document, `ai_settings/main`, holding eight nested blocks written one
at a time by `lib/ai/ai-settings/repository.ts` and read by `lib/ai/ai-settings/admin-repository.ts`.
Both files were rewritten onto the Supabase table (`lib/ai/ai-settings/repository.ts:41-79`,
`lib/ai/ai-settings/admin-repository.ts:39-78`), so the multi-store leak that filed these blocks
under `unknown_questions` is gone too (the UNCLEAR entry on it is resolved). `AISettings` gained
`general`, `safety` and `extendedBehavior` (`types/ai-settings.ts:340-354`), which exist only in
Supabase.

What is left in Firestore is dangerous rather than dead. `getAnalyticsSettings()`
(`services/ai-analytics.service.ts:57-77`) reads the **first document of the whole collection** and
casts it to `AIAnalyticsSettings`. If `ai_settings/main` from the legacy seed is still there, it has
no `enabled` key, so `!settings.enabled` is true and `recordTokenUsage` / `recordLatency` /
`recordIntentDistribution` / `recordUnknownQuestion` (`:102`, `:127`, `:163`, `:197`) all return `""`
without writing. Only when the collection is empty does the default (`enabled: true`) apply. The
`timestamp` row that used to sit here was `ai_token_usage` bleed from `:108` and has been dropped.

### fs `ai_token_usage`

**Declared type:** `types/ai-analytics.ts#TokenUsageRecord` (`types/ai-analytics.ts:10`)  
**Rule:** `firestore.rules:201`  
**Index:** entry 17, single-field `timestamp` DESC (no-op).  
**Migration:** Firestore only - no Supabase table exists for token usage.

<!--FIELDS ai_token_usage | types/ai-analytics.ts#TokenUsageRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `estimatedCost` | `number` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `inputTokens` | `number` | yes | - | - | declared, **no call site** |
| `intent` | `Intent` | yes | - | `services/ai-analytics.service.ts:293` | declared |
| `language` | `"en" \| "kn" \| "mixed"` | yes | - | - | declared, **no call site** |
| `messageId` | `string` | yes | - | - | declared, **no call site** |
| `model` | `string` | yes | - | - | declared, **no call site** |
| `outputTokens` | `number` | yes | - | - | declared, **no call site** |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:109` | `services/ai-analytics.service.ts:284`<br>`services/ai-analytics.service.ts:287`<br>`services/ai-analytics.service.ts:296`<br>+1 more | declared |
| `totalTokens` | `number` | yes | - | - | declared, **no call site** |
<!--END-->

Only `timestamp` and `intent` surface at call sites; the rest of the record goes in through a
variable at `services/ai-analytics.service.ts:109`, so `TokenUsageRecord` is the schema. Cost
reporting reads it at `:279-302`.

### fs `ai_unknown_questions`

**Declared type:** `types/ai-analytics.ts#UnknownQuestionRecord` (`types/ai-analytics.ts:58`)  
**Rule:** **none**  
**Index:** none  
**Migration (2026-10-18):** **no application code left.** The parallel name survives only as an unused constant (`services/ai-analytics.service.ts:48`) and as a migration *source*: `scripts/migrate-ai-analytics.ts:57-65` copies it into the Supabase `unknown_questions` table alongside the Firestore `unknown_questions` collection.

<!--FIELDS ai_unknown_questions | types/ai-analytics.ts#UnknownQuestionRecord-->
_No call site since 2026-10-13 (commit `3d0d3b2`, BOT-004). The declared type survives as the camelCase shape that `services/ai-analytics.service.ts:444-457` builds from Supabase `unknown_questions` rows - see that table._
<!--END-->

Until the BOT-004 analytics migration, `services/ai-analytics.service.ts` updated documents here
(`reviewed`, `reviewedBy`, `reviewedAt`, `addedToKnowledge`, `knowledgeArticleId`) that nothing in
the app ever created. `recordUnknownQuestion` (`:194-230`) and `markUnknownQuestionReviewed`
(`:235-262`) now write the Supabase `unknown_questions` table, mapping `reviewed` to
`status = 'reviewed'` and `knowledgeArticleId` to `added_to_knowledge_article_id`, and the reader
(`:415-464`) derives `reviewed` from `status` and `addedToKnowledge` from the article id. The four
"written, never read" fields this collection contributed to the orphan count are gone.
`UnknownQuestionRecord.feedback` / `.userAgent` (`types/ai-analytics.ts:72-73`) remain declared and
unwritten.

### fs `announcements`

**Declared type:** `types/announcement.ts#Announcement` (`types/announcement.ts:1`)  
**Rule:** `firestore.rules:45`  
**Index:** entry 11 `active` ASC + `priority` ASC; entry 12 `publishedAt` DESC.  
**Migration:** Firestore only - no Supabase table.

<!--FIELDS announcements | types/announcement.ts#Announcement-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:92`<br>`app/admin/content/page.tsx:169` | not in the type (`:168` is the **`events`** draft query - bleed, removed) |
| `createdAt` | `any` | no | `services/announcement.service.ts:58` | `services/announcement.service.ts:37`<br>`services/announcement.service.ts:48`<br>`services/announcement.service.ts:28`<br>+11 more | declared |
| `date` | `?` inferred | - | - | ~~`app/admin/content/page.tsx:90`~~ | **bleed** - `:90` is the `events` upcoming-count; no announcement carries `date` |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `isActive` | `boolean` | yes | - | `services/announcement.service.ts:48`<br>`services/announcement.service.ts:27`<br>`services/daily-spiritual.service.ts:389`<br>+2 more | declared |
| `link` | `string` | no | - | `services/announcement.service.ts:26`<br>`lib/ai/retrieval/announcements.ts:39` | declared |
| `message` | `string` | yes | - | `services/announcement.service.ts:25`<br>`lib/ai/retrieval/announcements.ts:38` | declared |
| `title` | `string` | yes | - | `app/admin/content/page.tsx:191`<br>`services/announcement.service.ts:24`<br>+1 more | declared (`app/admin/content/page.tsx:180` is the `events` draft mapper - bleed) |
| `updatedAt` | `any` | no | `services/announcement.service.ts:58`<br>`services/announcement.service.ts:63` | `app/admin/content/page.tsx:119`<br>`app/admin/content/page.tsx:120`<br>`app/admin/content/page.tsx:182`<br>+2 more | declared |
<!--END-->

**The field-name fault.** The type and every service query use `isActive`
(`services/announcement.service.ts:48`, `lib/ai/retrieval/announcements.ts:59`,
`services/daily-spiritual.service.ts:389`), but the declared composite index names `active`, and
`app/admin/content/page.tsx:92,169` filters on `active` too. The index also orders by `priority`,
which no document carries and no type declares. Net effect: the real query (`isActive` +
`orderBy createdAt desc`) has no index and throws `FAILED_PRECONDITION`, while the declared index
covers a query nobody runs. The `date` read at `app/admin/content/page.tsx:90` is an `events` filter
that the harvester pulled in from the neighbouring line.

### fs `articles`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration (2026-10-18):** **no code left anywhere** - removed 2026-10, see Refresh log.

<!--FIELDS articles-->
_No call site. Until 2026-10-06 `scripts/seed-ai-knowledge.ts` read `published` / `category` from this collection and wrote `tags`, `version`, `createdBy`, `createdAt`, `updatedAt` back into it. The script now upserts the `seed/ai/*.json` files straight into Supabase `ai_knowledge` (`scripts/seed-ai-knowledge.ts:94-106`, `onConflict: 'slug'`) and never opens Firestore._
<!--END-->

Kept as a heading so old links resolve. The collection was a second, abandoned home for knowledge
articles next to `knowledge`. It is not even in the dump list (`scripts/dump-firestore-live.ts:213` names
`knowledge` and `knowledge_articles`, not `articles`), so whatever it still holds in the live project
is invisible to every tool in the repo.

### fs `bills`

**Declared type:** `types/billing.ts#Bill` (`types/billing.ts:25`)  
**Rule:** `firestore.rules:142`  
**Index:** none  
**Migration:** Firestore only - no Supabase table, although bills carry money.

<!--FIELDS bills | types/billing.ts#Bill-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `amountPaid` | `number` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:50` | declared |
| `balanceDue` | `number` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:51` | declared |
| `billDate` | `Timestamp \| Date` | yes | - | `services/billing.service.ts:38` | declared |
| `createdAt` | `Timestamp \| FieldValue` | yes | - | `services/billing.service.ts:94`<br>`services/billing.service.ts:111`<br>`services/billing.service.ts:122`<br>+1 more | declared |
| `createdBy` | `string` | yes | - | `services/billing.service.ts:58` | declared |
| `customerAddress` | `string` | no | - | `services/billing.service.ts:43` | declared |
| `customerEmail` | `string` | no | - | `services/billing.service.ts:41` | declared |
| `customerGstin` | `string` | no | - | `services/billing.service.ts:44` | declared |
| `customerName` | `string` | yes | - | `services/billing.service.ts:121`<br>`services/billing.service.ts:40` | declared |
| `customerPhone` | `string` | no | - | `services/billing.service.ts:42` | declared |
| `discountAmount` | `number` | yes | - | `services/billing.service.ts:48` | declared |
| `dueDate` | `Timestamp \| Date` | yes | - | `services/billing.service.ts:134`<br>`services/billing.service.ts:135`<br>`services/billing.service.ts:39` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `invoiceNumber` | `string` | yes | - | `services/billing.service.ts:37` | declared |
| `items` | `BillItem[]` | yes | - | `services/billing.service.ts:45` | declared |
| `notes` | `string` | no | - | `services/billing.service.ts:55` | declared |
| `paymentStatus` | `PaymentStatus` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:53` | declared |
| `payments` | `BillPayment[]` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:54` | declared |
| `status` | `BillStatus` | yes | `services/billing.service.ts:226`<br>`services/billing.service.ts:258` | `services/billing.service.ts:110`<br>`services/billing.service.ts:133`<br>`services/billing.service.ts:52` | declared |
| `subtotal` | `number` | yes | - | `services/billing.service.ts:46` | declared |
| `taxAmount` | `number` | yes | - | `services/billing.service.ts:47` | declared |
| `totalAmount` | `number` | yes | - | `services/billing.service.ts:49` | declared |
| `updatedAt` | `Timestamp \| FieldValue` | yes | `services/billing.service.ts:226`<br>`services/billing.service.ts:258` | `services/billing.service.ts:57` | declared |
<!--END-->

Create and update go through spreads (`services/billing.service.ts:101,216`), so most fields appear
read-only; `Bill` is the truth and the mapper at `:37-58` is the practical reader. Three queries
combine `where` with `orderBy` and have no composite index: `status` + `createdAt` (`:108-110`),
`customerName` + `createdAt` (`:119-122`), and `status in` + `dueDate <` + `orderBy dueDate`
(`:131-135`). `amountPaid`, `balanceDue`, `payments` and `paymentStatus` are recomputed on every
payment at `:258`.

### fs `bookmarks`

**Declared type:** `types/profile.ts#Bookmark` (`types/profile.ts:55`)  
**Rule:** **none** - falls through to the default deny, so client SDK access fails.  
**Index:** none  
**Migration:** Firestore only. Supabase keeps bookmarks as a `jsonb` column on `profiles` instead.

<!--FIELDS bookmarks | types/profile.ts#Bookmark-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `Date` | yes | - | `services/profile.service.ts:395` | declared |
| `description` | `string` | no | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `itemId` | `string` | yes | - | `services/profile.service.ts:364` | declared |
| `thumbnail` | `string` | no | - | - | declared, **no call site** |
| `title` | `string` | yes | - | - | declared, **no call site** |
| `type` | `BookmarkType` | yes | - | `services/profile.service.ts:387` | declared |
| `uid` | `?` inferred | - | - | `services/profile.service.ts:363`<br>`services/profile.service.ts:384`<br>`services/profile.service.ts:387` | not in the type |
| `url` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

`services/profile.service.ts:333-395`. Documents carry a `uid` owner field (`:363,384,387`) that no
security rule enforces, and the query at `:384-387` pairs `uid` with `type` with no composite index.
The `title`, `description`, `thumbnail` and `url` fields declared on `Bookmark` never appear at a
call site - the write goes in as a whole object.

### fs `chat_messages`

**Declared type:** none.  
**Rule:** **none**  
**Index:** entry 15, `sessionId` ASC + `timestamp` DESC - declared on *this* name.  
**Migration (2026-10-18):** still empty in Firestore. Since commit `224875d` (2026-10-06) chat messages are saved to the **Supabase** table of the same name; see sb `chat_messages`.

<!--FIELDS chat_messages-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `timestamp` | `?` inferred | - | - | `services/ai-analytics.service.ts:636`<br>`services/ai-analytics.service.ts:637` | not in the type; Firestore count query |
<!--END-->

**Not in M11's list of 63 - added here.** `services/ai-analytics.service.ts:634-639` counts documents in
a Firestore collection literally named `chat_messages`, resolved from `COLLECTIONS.CHAT_MESSAGES`
(`:51`). Before 2026-10-06 every message went to Firestore `messages`; now every message goes to the
Supabase `chat_messages` table (`services/chat.service.ts:109-118`). Either way nothing writes this
Firestore collection, so the admin "total messages" figure is still always zero - the name finally
matches the real store, but the count still asks the wrong database (fault F-12).

### fs `chat_metrics`

**Declared type:** `types/analytics.ts#ConversationMetric` (`types/analytics.ts:17`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS chat_metrics | types/analytics.ts#ConversationMetric-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `averageConfidence` | `number` | yes | - | - | declared, **no call site** |
| `date` | `string` | yes | `services/analytics.service.ts:54` | - | declared |
| `fallbackQueries` | `number` | yes | - | - | declared, **no call site** |
| `languageBreakdown` | `{` | yes | - | - | declared, **no call site** |
| `successfulQueries` | `number` | yes | - | - | declared, **no call site** |
| `timestamp` | `?` inferred | - | `services/analytics.service.ts:54` | - | not in the type |
| `totalQueries` | `number` | yes | - | - | declared, **no call site** |
| `unknownQuestions` | `number` | yes | - | - | declared, **no call site** |
<!--END-->

Write-only. `services/analytics.service.ts:47-56` appends one document per conversation
(`{...data, timestamp, date}`) and nothing anywhere reads the collection back. With no rule, the
client write is denied outright, so this is dead code that also fails silently (`:58`).

### fs `chat_sessions`

**Declared type:** `types/ai.ts#ChatSession` (`types/ai.ts:15`)  
**Rule:** `firestore.rules:186` - public create.  
**Index:** entry 14, `userId` ASC + `updatedAt` DESC - its only user, `services/chat.service.ts`, moved to Supabase on 2026-10-06, so the index is now unused.  
**Migration (2026-10-18):** **split.** `services/chat.service.ts` (session summary: count, last message) writes and reads the Supabase table since commit `224875d`; `services/conversation.service.ts` (conversational state) still writes and reads these Firestore documents, and three admin screens still count them here.

<!--FIELDS chat_sessions | types/ai.ts#ChatSession-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `number` | yes | `services/conversation.service.ts:112` | `app/admin/ai/analytics/page.tsx:342`<br>`app/admin/ai/page.tsx:105`<br>`services/ai-analytics.service.ts:624-625`<br>+1 more | declared |
| `detectedLanguage` | `DetectedLanguage` | no | - | - | declared; Firestore never stores it (Supabase `detected_language` does) |
| `error` | `?` inferred | - | - | `app/admin/ai/page.tsx:72` | not in the type; dashboard bleed |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intent` | `?` inferred | - | - | `app/admin/ai/analytics/page.tsx:373` | not in the type; dashboard bleed |
| `lastIntent` | `?` inferred | - | `services/conversation.service.ts:161`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:71` | not in the type |
| `lastMessage` | `string` | no | - | - | declared; written only to Supabase now |
| `lastTopic` | `?` inferred | - | `services/conversation.service.ts:161`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:72` | not in the type |
| `messageCount` | `number` | yes | - | - | declared; written only to Supabase now |
| `messages` | `?` inferred | - | `services/conversation.service.ts:161`<br>`services/conversation.service.ts:199`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:74`<br>`services/conversation.service.ts:194` | not in the type |
| `preferredLanguage` | `?` inferred | - | `services/conversation.service.ts:161` | `services/conversation.service.ts:73` | not in the type |
| `success` | `?` inferred | - | - | `app/admin/ai/page.tsx:50`<br>`app/admin/ai/page.tsx:68` | not in the type; dashboard bleed |
| `updatedAt` | `number` | yes | `services/conversation.service.ts:112`<br>`services/conversation.service.ts:161`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:79` | declared |
| `userId` | `string \| null` | yes | - | `services/conversation.service.ts:70` | declared |
<!--END-->

Refreshed by hand on 2026-10-18. Before 2026-10-06 two writers with different shapes shared these
documents; now they share nothing. `services/chat.service.ts:7-99` creates and updates sessions in
Supabase keyed by `firestore_id = crypto.randomUUID()` (`:9-16`), while
`services/conversation.service.ts:161` and `:348` keep writing `messages` (an embedded array),
`lastIntent`, `lastTopic`, `preferredLanguage` here under whatever id the caller passes. A session
therefore lives in two databases with no shared row. The admin conversation counters
(`app/admin/ai/page.tsx:96`, `app/admin/ai/analytics/page.tsx:333`, `app/admin/page.tsx:107`,
`services/ai-analytics.service.ts:622-628`) count only the Firestore half - fault F-12. The
`success`, `error` and `intent` rows come from admin dashboard code in the same window and are not
session fields.

### fs `chatTraining`

**Declared type:** none - the admin form is the schema.  
**Rule:** **none**  
**Index:** none  
**Migration (2026-10-18):** Firestore only, and now **write-only**: the AI reader was deleted with `lib/ai/firebaseChat.ts` (commit `2891323`, 2026-10-14). `lib/supabase/migration-inventory.ts:23` classifies it `EXCLUDE_SYSTEM`, so it will not move to Supabase either.

<!--FIELDS chatTraining-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | `app/admin/ai/training/page.tsx:221`<br>`app/admin/ai/training/page.tsx:232`<br>`app/admin/ai/training/page.tsx:267` | - | not in the type |
| `category` | `?` inferred | - | `app/admin/ai/training/page.tsx:221`<br>`app/admin/ai/training/page.tsx:232` | - | not in the type |
| `createdAt` | `?` inferred | - | `app/admin/ai/training/page.tsx:149`<br>`app/admin/ai/training/page.tsx:221` | - | not in the type |
| `keywords` | `?` inferred | - | `app/admin/ai/training/page.tsx:221`<br>`app/admin/ai/training/page.tsx:232` | - | not in the type |
| `priority` | `?` inferred | - | `app/admin/ai/training/page.tsx:221`<br>`app/admin/ai/training/page.tsx:232` | - | not in the type |
| `response` | `?` inferred | - | `app/admin/ai/training/page.tsx:221`<br>`app/admin/ai/training/page.tsx:232` | - | not in the type |
| `updatedAt` | `?` inferred | - | `app/admin/ai/training/page.tsx:149`<br>`app/admin/ai/training/page.tsx:221`<br>`app/admin/ai/training/page.tsx:232`<br>+1 more | - | not in the type |
<!--END-->

Written at `app/admin/ai/training/page.tsx:149` (import of defaults) and `:221-232` (create/edit),
toggled at `:267`, listed back by the same page at `:125`. Until 2026-10-14 the AI read it at
`lib/ai/firebaseChat.ts:152-158` (`where active == true` + `orderBy priority`, no declared index).
That file is gone and no other AI module queries `chatTraining`, so every field here is now
**written, never read** outside the admin page that wrote it: the "AI Training" screen edits
responses Raya AI no longer consults.

### fs `daily_page_stats`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS daily_page_stats-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `date` | `?` inferred | - | `services/pageviews.service.ts:62` | - | not in the type |
| `deviceType` | `?` inferred | - | - | `services/pageviews.service.ts:60` | not in the type |
| `lastUpdated` | `?` inferred | - | `services/pageviews.service.ts:62` | - | not in the type |
| `pageViews` | `?` inferred | - | `services/pageviews.service.ts:62` | - | not in the type |
| `path` | `?` inferred | - | - | `services/pageviews.service.ts:71` | not in the type |
| `referrer` | `?` inferred | - | - | `services/pageviews.service.ts:59` | not in the type |
<!--END-->

Two document shapes share the collection: `<YYYY-MM-DD>` holding `date`, `pageViews` (an
`increment(1)`) and `lastUpdated` (`services/pageviews.service.ts:62-65`), and `<YYYY-MM-DD>_pages`
holding computed keys of the form `pages.<path>` (`:70`). The `trafficSources.*` and
`deviceBreakdown.*` field paths are built at `:59-60` and then never used - dead code. Computed keys
are invisible to the harvester, so the `path`, `referrer` and `deviceType` rows below are the
*inputs* to those keys, not stored fields.

### fs `dailyPoojas`

**Declared type:** `types/pooja.ts#DailyPooja` (`types/pooja.ts:1`)  
**Rule:** **none** - client access denied by default.  
**Index:** none  
**Migration:** Firestore only. `daily_poojas` exists in Supabase and `scripts/migrate-daily-poojas.ts` fills it, but nothing reads it.

<!--FIELDS dailyPoojas | types/pooja.ts#DailyPooja-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `category` | `PoojaCategory` | yes | - | `services/pooja.service.ts:26`<br>`scripts/migrate-daily-poojas.ts:72`<br>`scripts/migrate-daily-poojas.ts:85` | declared |
| `createdAt` | `string` | yes | `services/pooja.service.ts:63`<br>`scripts/seed-poojas.ts:95` | `services/pooja.service.ts:32`<br>`services/pooja.service.ts:33`<br>`services/pooja.service.ts:34`<br>+2 more | declared |
| `createdBy` | `string` | yes | `services/pooja.service.ts:63`<br>`scripts/seed-poojas.ts:95` | `services/pooja.service.ts:35`<br>`scripts/migrate-daily-poojas.ts:91` | declared |
| `days` | `string[]` | yes | - | `services/pooja.service.ts:30`<br>`scripts/migrate-daily-poojas.ts:74`<br>`scripts/migrate-daily-poojas.ts:89` | declared |
| `description` | `string` | yes | - | `services/pooja.service.ts:23`<br>`scripts/migrate-daily-poojas.ts:69`<br>`scripts/migrate-daily-poojas.ts:82` | declared |
| `displayOrder` | `number` | yes | - | `services/pooja.service.ts:44`<br>`services/pooja.service.ts:29`<br>`scripts/migrate-daily-poojas.ts:88` | declared |
| `duration` | `string` | yes | - | `services/pooja.service.ts:25`<br>`scripts/migrate-daily-poojas.ts:71`<br>`scripts/migrate-daily-poojas.ts:84` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `isActive` | `boolean` | yes | - | `services/pooja.service.ts:28`<br>`scripts/migrate-daily-poojas.ts:87` | declared |
| `notes` | `string` | yes | - | `services/pooja.service.ts:31`<br>`scripts/migrate-daily-poojas.ts:90` | declared |
| `sevaAmount` | `number` | yes | - | `services/pooja.service.ts:27`<br>`scripts/migrate-daily-poojas.ts:73`<br>`scripts/migrate-daily-poojas.ts:86` | declared |
| `startTime` | `string` | yes | - | `services/pooja.service.ts:24`<br>`scripts/migrate-daily-poojas.ts:70`<br>`scripts/migrate-daily-poojas.ts:83` | declared |
| `title` | `string` | yes | - | `services/pooja.service.ts:22`<br>`scripts/migrate-daily-poojas.ts:68`<br>`scripts/migrate-daily-poojas.ts:81` | declared |
<!--END-->

Create and update are spreads (`services/pooja.service.ts:63,76`); the mapper at `:22-35` is the
practical field list and `scripts/migrate-daily-poojas.ts:68-91` is the second, independent copy of
the same mapping. Note `duration` is a `string` here (`"45 min"`), not a number as in `sevas`.

### fs `donation_campaigns`

**Declared type:** `types/donationCampaign.ts#DonationCampaign` (`types/donationCampaign.ts:1`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only; the Supabase `donation_campaigns` table has no app code.

<!--FIELDS donation_campaigns | types/donationCampaign.ts#DonationCampaign-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | `services/donationCampaign.service.ts:49` | declared |
| `createdAt` | `string` | yes | `services/donationCampaign.service.ts:108` | `services/donationCampaign.service.ts:55` | declared |
| `description` | `string` | yes | - | `services/donationCampaign.service.ts:41` | declared |
| `displayOrder` | `number` | yes | - | `services/donationCampaign.service.ts:69`<br>`services/donationCampaign.service.ts:52` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | - | `services/donationCampaign.service.ts:43` | declared |
| `suggestedAmount` | `number` | yes | - | `services/donationCampaign.service.ts:46` | declared |
| `title` | `string` | yes | - | `services/donationCampaign.service.ts:39` | declared |
| `updatedAt` | `string` | yes | `services/donationCampaign.service.ts:108`<br>`services/donationCampaign.service.ts:125` | `services/donationCampaign.service.ts:57` | declared |
<!--END-->

`docs/DATA-MODEL.md:450` documents this as `donationCampaigns` (camelCase) and gives it
`goalAmount`, `currentAmount`, `startDate` and `endDate`. The code uses `donation_campaigns`
(`services/donationCampaign.service.ts:68`) and none of those four fields exist; the real fields are
`suggestedAmount` and `displayOrder`. With no rule, every client read of this collection is denied.

### fs `donations`

**Declared type:** `types/donation.ts#DonationRecord` (`types/donation.ts:13`)  
**Rule:** `firestore.rules:119`  
**Index:** entry 9 `userId` + `collectedAt`; entry 10 `status` + `collectedAt`.  
**Migration:** Firestore only; the Supabase `donations` table has no app code.

<!--FIELDS donations | types/donation.ts#DonationRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `address` | `string` | yes | - | `services/donation.service.ts:20` | declared |
| `adminRemarks` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:28` | declared |
| `amount` | `number` | yes | - | `app/admin/page.tsx:179`<br>`services/donation.service.ts:21`<br>`hooks/useDonationNotifications.ts:52` | declared |
| `campaignId` | `string` | yes | - | `services/donation.service.ts:23` | declared |
| `collectedAt` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:30` | declared |
| `collectedBy` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:29` | declared |
| `createdAt` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:46`<br>`services/donation.service.ts:31`<br>`hooks/useDonationNotifications.ts:35`<br>+1 more | declared |
| `donorName` | `string` | yes | - | `services/donation.service.ts:17`<br>`hooks/useDonationNotifications.ts:51` | declared |
| `email` | `string` | yes | - | `app/admin/page.tsx:177`<br>`app/api/public/stats/route.ts:58`<br>`services/donation.service.ts:18` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `message` | `string` | yes | - | `services/donation.service.ts:24` | declared |
| `name` | `?` inferred | - | - | `services/donation.service.ts:17` | not in the type |
| `paymentMethod` | `?` inferred | - | - | `services/donation.service.ts:25` | not in the type |
| `paymentMode` | `PaymentMode` | yes | - | `services/donation.service.ts:25`<br>`hooks/useDonationNotifications.ts:54` | declared |
| `phone` | `string` | yes | - | `app/admin/page.tsx:178`<br>`app/api/public/stats/route.ts:59`<br>`services/donation.service.ts:19` | declared |
| `purpose` | `string` | yes | - | `services/donation.service.ts:22`<br>`hooks/useDonationNotifications.ts:53` | declared |
| `receiptNumber` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:27` | declared |
| `status` | `DonationStatus` | yes | `services/donation.service.ts:39`<br>`services/donation.service.ts:68` | `app/admin/page.tsx:172`<br>`app/api/public/stats/route.ts:52`<br>`services/donation.service.ts:26` | declared |
| `updatedAt` | `string` | yes | `services/donation.service.ts:39`<br>`services/donation.service.ts:68`<br>`services/donation.service.ts:73` | `services/donation.service.ts:32` | declared |
<!--END-->

Both declared indexes are dead: no document carries `userId`, and `services/donation.service.ts:46`
orders by `createdAt` with no `where`. The mapper at `:17-32` accepts two spellings for two fields -
`donorName` or `name` (`:17`), `paymentMode` or `paymentMethod` (`:25`) - which is the signature of
two different writers having existed. `hooks/useDonationNotifications.ts:35-54` is a live listener
reading `createdAt`, `donorName`, `amount`, `purpose` and `paymentMode`.

### fs `events`

**Declared type:** `types/event.ts#TempleEvent` (`types/event.ts:8`)  
**Rule:** `firestore.rules:50`  
**Index:** entry 6 `published` + `startDate` (used); entry 7 `featured` + `startDate` (unused).  
**Migration:** **Dual and diverging.** `services/event.service.ts:46-123` reads and writes the Supabase table through the anon client; the admin pages, the aaradhane generator and the AI retriever all still use Firestore.

<!--FIELDS events | types/event.ts#TempleEvent-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:168` | not in the type |
| `autoGenerated` | `?` inferred | - | - | `lib/aaradhane/firestore-admin.ts:34`<br>`lib/aaradhane/firestore-admin.ts:58`<br>`lib/aaradhane/firestore-admin.ts:97`<br>+6 more | not in the type |
| `category` | `string` | no | - | `services/daily-spiritual.service.ts:320`<br>`services/daily-spiritual.service.ts:362`<br>`lib/aaradhane/firestore-admin.ts:36`<br>+4 more | declared |
| `createdAt` | `Timestamp` | no | `lib/aaradhane/firestore.ts:296`<br>`lib/aaradhane/firestore.ts:452`<br>`scripts/generate-events-firestore.ts:219`<br>+1 more | - | declared |
| `date` | `?` inferred | - | - | `app/admin/content/page.tsx:90`<br>`app/admin/page.tsx:111`<br>`app/api/public/stats/route.ts:45` | not in the type |
| `description` | `string` | yes | - | `services/daily-spiritual.service.ts:315`<br>`services/daily-spiritual.service.ts:357`<br>`lib/ai/retrieval/events.ts:42` | declared |
| `endDate` | `Timestamp` | yes | `scripts/import-events.ts:64` | `services/daily-spiritual.service.ts:302`<br>`services/daily-spiritual.service.ts:342`<br>`lib/ai/retrieval/events.ts:44`<br>+1 more | declared |
| `endTime` | `string` | no | - | `services/daily-spiritual.service.ts:319`<br>`services/daily-spiritual.service.ts:361`<br>`lib/ai/retrieval/events.ts:46` | declared |
| `featured` | `boolean` | yes | - | `services/daily-spiritual.service.ts:294`<br>`lib/ai/retrieval/events.ts:48` | declared |
| `firestore_id` | `?` inferred | - | - | `services/event.service.ts:58`<br>`services/event.service.ts:114`<br>`services/event.service.ts:123` | not in the type |
| `guru` | `?` inferred | - | - | `lib/aaradhane/firestore-admin.ts:56`<br>`lib/aaradhane/firestore-admin.ts:95`<br>`lib/aaradhane/firestore.ts:71`<br>+3 more | not in the type |
| `id` | `string` | no | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | no | - | `services/daily-spiritual.service.ts:321`<br>`services/daily-spiritual.service.ts:363` | declared |
| `location` | `string` | yes | - | `lib/ai/retrieval/events.ts:47` | declared |
| `name` | `?` inferred | - | - | `scripts/check-collections.ts:47`<br>`scripts/check-collections.ts:58` | not in the type |
| `published` | `boolean` | yes | - | `services/daily-spiritual.service.ts:295`<br>`services/daily-spiritual.service.ts:332`<br>`lib/ai/retrieval/events.ts:67`<br>+1 more | declared |
| `raghavendraPhase` | `?` inferred | - | - | `scripts/generate-events-firestore.ts:171`<br>`scripts/generate-events-firestore.ts:180` | not in the type |
| `startDate` | `Timestamp` | yes | `scripts/import-events.ts:64` | `services/daily-spiritual.service.ts:301`<br>`services/daily-spiritual.service.ts:341`<br>`lib/aaradhane/firestore-admin.ts:43`<br>+30 more | declared |
| `startTime` | `string` | no | - | `services/daily-spiritual.service.ts:318`<br>`services/daily-spiritual.service.ts:360`<br>`lib/ai/retrieval/events.ts:45` | declared |
| `status` | `EventStatus` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | `services/daily-spiritual.service.ts:314`<br>`services/daily-spiritual.service.ts:356`<br>`lib/aaradhane/firestore-admin.ts:55`<br>+9 more | declared |
| `updatedAt` | `Timestamp` | no | `lib/aaradhane/firestore.ts:284`<br>`lib/aaradhane/firestore.ts:296`<br>`lib/aaradhane/firestore.ts:438`<br>+3 more | `app/admin/content/page.tsx:119` | declared |
| `year` | `?` inferred | - | - | `lib/aaradhane/firestore-admin.ts:35`<br>`lib/aaradhane/firestore-admin.ts:57`<br>`lib/aaradhane/firestore-admin.ts:96`<br>+8 more | not in the type |
<!--END-->

The aaradhane generator writes four fields no type declares - `autoGenerated`, `guru`, `year`,
`raghavendraPhase` (`lib/aaradhane/firestore.ts:47-49,71-73`, `lib/aaradhane/firestore-admin.ts:34-36`,
`scripts/generate-events-firestore.ts:162-180`) - and uses them as the idempotency key when
regenerating a year. Neither the Supabase `events` table nor `TempleEvent` has a column or property
for any of them, so a Firestore→Supabase migration silently drops the generator's bookkeeping. The
admin counters query `date` (`app/admin/content/page.tsx:90`, `app/admin/page.tsx:111`,
`app/api/public/stats/route.ts:45`), a field neither the type nor any writer produces - those
"upcoming events" counts are always zero. `active` (`app/admin/content/page.tsx:168`) is likewise
ot an event field; the real flag is `published`. One more Firestore reader the harvest attributes
here: `getNextUpcomingEvent` (`lib/firebase.ts:156`, reading `published`, `startDate`, `endDate`,
`title`) - but nothing imports it (grep, 0 callers), so it is dead code.

### fs `featuredContent`

**Declared type:** none - `app/admin/featured/page.tsx` is the whole definition.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS featuredContent-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `contentId` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:118` | not in the type |
| `contentType` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:119` | not in the type |
| `createdAt` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:129` | not in the type |
| `description` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:121` | not in the type |
| `endDate` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:128` | not in the type |
| `imageUrl` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:122` | not in the type |
| `isActive` | `?` inferred | - | `app/admin/featured/page.tsx:218`<br>`app/admin/featured/page.tsx:235` | `app/admin/featured/page.tsx:126` | not in the type |
| `linkLabel` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:124` | not in the type |
| `linkUrl` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:123` | not in the type |
| `priority` | `?` inferred | - | `app/admin/featured/page.tsx:218`<br>`app/admin/featured/page.tsx:235` | `app/admin/featured/page.tsx:109`<br>`app/admin/featured/page.tsx:125` | not in the type |
| `startDate` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:127` | not in the type |
| `title` | `?` inferred | - | `app/admin/featured/page.tsx:218` | `app/admin/featured/page.tsx:120` | not in the type |
| `updatedAt` | `?` inferred | - | `app/admin/featured/page.tsx:218`<br>`app/admin/featured/page.tsx:235` | `app/admin/featured/page.tsx:130` | not in the type |
<!--END-->

Entirely self-contained in one file: written at `app/admin/featured/page.tsx:218` and `:235`, read
field-by-field at `:118-130`, queried `orderBy priority asc` at `:109`. No rule, so the admin page
depends on the default-deny not applying - it uses the client SDK, so this page cannot work in
production unless a rule is added.

### fs `feedback`

**Declared type:** `types/ai.ts#ChatFeedback` (`types/ai.ts:48`)  
**Rule:** `firestore.rules:245`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS feedback | types/ai.ts#ChatFeedback-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `comment` | `string` | no | - | - | declared, **no call site** |
| `createdAt` | `number` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `messageId` | `string` | yes | - | - | declared, **no call site** |
| `rating` | `"helpful" \| "not_helpful" \| null` | yes | - | `services/chat.service.ts:331` | declared |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

Written as a spread (`services/chat.service.ts:309-314`), so `ChatFeedback` is the schema. Only
`rating` is ever read back, and by a full-collection scan at `:325-334` rather than a query - which
will get slower without bound.

### fs `futurePlans`

**Declared type:** none.  
**Rule:** `firestore.rules:155`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS futurePlans-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** The future-plans data lives in the document
`settings/futurePlans` (`app/(public)/future-plans/page.tsx:108`, seeded by
`scripts/seed-future-plans.ts:71`). The rule at `firestore.rules:155` protects an empty name; see
`settings/futurePlans` below for the real fields.

### fs `gallery`

**Declared type:** none.  
**Rule:** `firestore.rules:55`  
**Index:** entry 8 `category` + `featured` - unused.  
**Migration:** Firestore only.

<!--FIELDS gallery-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:92` | not in the type |
| `date` | `?` inferred | - | - | `app/admin/content/page.tsx:90` | not in the type |
<!--END-->

Only ever counted, never read field-by-field (`app/admin/content/page.tsx:93`,
`services/dashboard.service.ts:23`). The media the site actually renders is in `galleryMedia`. The
`active` and `date` rows are neighbouring-line noise from the admin counter block. `docs/DATA-MODEL.md:280`
documents a full `GalleryItem` shape (`url`, `thumbnailUrl`, `tags`, `featured`) that exists nowhere
in the code.

### fs `galleryAlbums`

**Declared type:** `types/gallery.ts#GalleryAlbum` (`types/gallery.ts:30`)  
**Rule:** `firestore.rules:61`  
**Index:** none  
**Migration:** Firestore only; the Supabase `gallery_albums` table has no app code.

<!--FIELDS galleryAlbums | types/gallery.ts#GalleryAlbum-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `coverImage` | `string` | yes | - | `app/admin/media/page.tsx:101`<br>`app/admin/media/page.tsx:104` | declared |
| `createdAt` | `any` | no | `services/gallery.service.ts:137` | `app/admin/media/page.tsx:108` | declared |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | `services/gallery.service.ts:114` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `slug` | `string` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | `app/admin/media/page.tsx:106` | declared |
| `updatedAt` | `any` | no | `services/gallery.service.ts:137`<br>`services/gallery.service.ts:143` | - | declared |
<!--END-->

Create and update are spreads (`services/gallery.service.ts:137,143`); `app/admin/media/page.tsx:101-108`
is the field-by-field reader. `slug`, `description` and `active` are declared and written but never
read anywhere in TypeScript.

### fs `galleryMedia`

**Declared type:** `types/gallery.ts#GalleryMedia` (`types/gallery.ts:42`)  
**Rule:** `firestore.rules:66`  
**Index:** none  
**Migration:** Firestore only; the Supabase `gallery_media` table has no app code.

<!--FIELDS galleryMedia | types/gallery.ts#GalleryMedia-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `albumId` | `string` | yes | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:90`<br>`services/gallery.service.ts:182`<br>`hooks/useGallery.ts:37` | declared |
| `altText` | `string` | yes | - | - | declared, **no call site** |
| `caption` | `?` inferred | - | - | `app/admin/media/page.tsx:89` | not in the type |
| `category` | `GalleryCategory` | yes | - | - | declared, **no call site** |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | `services/gallery.service.ts:157`<br>`services/gallery.service.ts:182`<br>`services/gallery.service.ts:194`<br>+2 more | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imagePath` | `string` | yes | - | - | declared, **no call site** |
| `imageUrl` | `?` inferred | - | - | `app/admin/media/page.tsx:87` | not in the type |
| `isFeatured` | `boolean` | yes | - | `services/gallery.service.ts:194` | declared |
| `tags` | `string[]` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | `app/admin/media/page.tsx:89` | declared |
| `type` | `"photo" \| "video"` | yes | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:88` | declared |
| `uploadedAt` | `any` | no | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:91` | declared |
| `uploadedBy` | `string` | yes | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:92` | declared |
| `url` | `?` inferred | - | - | `app/admin/media/page.tsx:87` | not in the type |
| `videoUrl` | `string` | no | - | - | declared, **no call site** |
<!--END-->

**Two live problems.** (1) Three queries need composite indexes that are not declared: `albumId` +
`orderBy displayOrder` (`services/gallery.service.ts:182`), `isFeatured` + `orderBy displayOrder`
(`:194`), and the same pair again in `hooks/useGallery.ts:37-38`. (2) The admin reader uses `url`,
`imageUrl` and `caption` (`app/admin/media/page.tsx:87-89`) where the type declares `imagePath` and
`altText` - so the admin media grid reads fields the service never writes and falls back to blanks.

### fs `guruParampara`

**Declared type:** `types/aaradhane-generator.ts#GuruParamparaCollection` (`types/aaradhane-generator.ts:78`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS guruParampara | types/aaradhane-generator.ts#GuruParamparaCollection-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `gurus` | `GuruParamparaRecord[]` | yes | `scripts/seed-guru-parampara.ts:378`<br>`scripts/seed-guru-to-firestore.ts:327` | `lib/aaradhane/firestore-source.ts:98`<br>`lib/aaradhane/firestore-source.ts:42`<br>`lib/aaradhane/firestore-source.ts:82` | declared |
| `heading` | `string` | no | - | - | declared, **no call site** |
| `headingKannada` | `string` | no | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `subheading` | `string` | no | - | - | declared, **no call site** |
| `subheadingKannada` | `string` | no | - | - | declared, **no call site** |
| `updatedAt` | `string` | no | `scripts/seed-guru-parampara.ts:378`<br>`scripts/seed-guru-to-firestore.ts:327` | - | declared |
<!--END-->

A single document whose id is misspelled: `guruParampara/aaradhanaes`
(`lib/aaradhane/firestore-source.ts:33`). It holds one `gurus` array of `GuruParamparaRecord`
(`types/aaradhane-generator.ts:31`) that drives the whole aaradhane calendar generator. Seeded by
`scripts/seed-guru-parampara.ts:378` and `scripts/seed-guru-to-firestore.ts:327`, which both write
`gurus` and `updatedAt`. With no rule, the client read at `lib/aaradhane/firestore-source.ts:42` is
denied - the generator only works through the admin SDK path (`lib/aaradhane/firestore-admin.ts`).

### fs `homepage`

**Declared type:** `types/homepage.ts#HomepageConfig` (`types/homepage.ts:1`)  
**Rule:** `firestore.rules:149`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS homepage | types/homepage.ts#HomepageConfig-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `announcement` | `string` | yes | - | - | declared, **no call site** |
| `announcement2` | `string` | yes | - | - | declared, **no call site** |
| `contactEmail` | `string` | yes | - | - | declared, **no call site** |
| `contactPhone` | `string` | yes | - | - | declared, **no call site** |
| `dailyQuote` | `{` | no | - | - | declared, **no call site** |
| `dashboardFeaturedEvent` | `{` | no | - | - | declared, **no call site** |
| `donationCTA` | `{` | no | - | - | declared, **no call site** |
| `donationSubtitle` | `string` | yes | - | - | declared, **no call site** |
| `donationTitle` | `string` | yes | - | - | declared, **no call site** |
| `eveningClose` | `string` | yes | - | - | declared, **no call site** |
| `eveningOpen` | `string` | yes | - | - | declared, **no call site** |
| `eveningSchedule` | `string[]` | yes | - | - | declared, **no call site** |
| `featuredFestival` | `string` | yes | - | - | declared, **no call site** |
| `featuredFestivalDescription` | `string` | yes | - | - | declared, **no call site** |
| `featuredFestivalRef` | `{` | no | - | - | declared, **no call site** |
| `featuredSeva` | `{` | no | - | - | declared, **no call site** |
| `festivalDate` | `string` | yes | - | - | declared, **no call site** |
| `festivalScheduleNote` | `string` | yes | - | - | declared, **no call site** |
| `footerCopyright` | `string` | yes | - | - | declared, **no call site** |
| `heroImage` | `string` | yes | - | - | declared, **no call site** |
| `heroPrimaryButton` | `string` | yes | - | - | declared, **no call site** |
| `heroSecondaryButton` | `string` | yes | - | - | declared, **no call site** |
| `heroStats` | `{` | no | - | - | declared, **no call site** |
| `heroSubtitle` | `string` | yes | - | - | declared, **no call site** |
| `heroTitle` | `string` | yes | - | - | declared, **no call site** |
| `isTempleOpen` | `boolean` | yes | - | - | declared, **no call site** |
| `morningClose` | `string` | yes | - | - | declared, **no call site** |
| `morningOpen` | `string` | yes | - | - | declared, **no call site** |
| `morningSchedule` | `string[]` | yes | - | - | declared, **no call site** |
| `panchanga` | `{` | no | - | - | declared, **no call site** |
| `templeAddress` | `string` | yes | - | - | declared, **no call site** |
| `templeLocation` | `string` | yes | - | - | declared, **no call site** |
| `templeName` | `string` | yes | - | - | declared, **no call site** |
| `testimonials` | `Testimonial[]` | no | - | - | declared, **no call site** |
| `todaySeva` | `string` | yes | - | - | declared, **no call site** |
| `todaySevaTime` | `string` | yes | - | - | declared, **no call site** |
| `updatedAt` | `any` | no | `services/homepage.service.ts:46` | - | declared |
<!--END-->

A single document, `homepage/config` (`services/homepage.service.ts:11-12`). The entire
`HomepageConfig` - 38 top-level fields including nested `panchanga`, `featuredSeva`, `donationCTA`,
`heroStats` and an embedded `testimonials` array - is written in one merged `setDoc` at `:44-50`, so
only `updatedAt` shows as a write. `getHomepage` (`:17-27`) merges the stored document over
`getDefaultConfig()`, which means a missing field is silently replaced by a default rather than
surfacing as an error.

### fs `intent_feedback`

**Declared type:** none in `types/` - declared inline at `services/analytics.service.ts:181-191`.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS intent_feedback-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `adminId` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `correctIntent` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:254`<br>`services/analytics.service.ts:258` | not in the type |
| `detectedIntent` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:254`<br>`services/analytics.service.ts:257` | not in the type |
| `isCorrect` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:247`<br>`services/analytics.service.ts:248`<br>`services/analytics.service.ts:253` | not in the type |
| `notes` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `question` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `sessionId` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `timestamp` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:240` | not in the type |
<!--END-->

Admin corrections of the AI's intent detection. Written at `services/analytics.service.ts:204`, read
back at `:239-258` to compute an accuracy rate. The inline `IntentFeedback` interface is exported
from a service file rather than from `types/`, against the `types/` convention in AGENTS.md.

### fs `intent_metrics`

**Declared type:** `types/analytics.ts#IntentMetric` (`types/analytics.ts:31`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS intent_metrics | types/analytics.ts#IntentMetric-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `averageConfidence` | `number` | yes | - | - | declared, **no call site** |
| `confidence` | `?` inferred | - | `services/analytics.service.ts:166` | - | not in the type |
| `count` | `number` | yes | - | - | declared, **no call site** |
| `date` | `?` inferred | - | `services/analytics.service.ts:166` | `services/analytics.service.ts:308` | not in the type |
| `fallback` | `?` inferred | - | - | `services/analytics.service.ts:324`<br>`services/analytics.service.ts:325` | not in the type |
| `fallbackRate` | `number` | yes | - | - | declared, **no call site** |
| `intent` | `string` | yes | `services/analytics.service.ts:166` | - | declared |
| `timestamp` | `?` inferred | - | `services/analytics.service.ts:166` | `services/analytics.service.ts:292`<br>`services/analytics.service.ts:298` | not in the type |
| `total` | `?` inferred | - | - | `services/analytics.service.ts:323`<br>`services/analytics.service.ts:325` | not in the type |
| `usedFallback` | `?` inferred | - | `services/analytics.service.ts:166` | `services/analytics.service.ts:302`<br>`services/analytics.service.ts:313` | not in the type |
<!--END-->

**The written document and the declared type share no field at all.** The writer
(`services/analytics.service.ts:166-171`) stores `intent`, `confidence`, `usedFallback`, `date`,
`timestamp`; `IntentMetric` declares `intent`, `count`, `averageConfidence`, `fallbackRate`. The
reader at `:291-325` aggregates the written shape into something resembling the type, so the type
describes the *return value*, not the stored document. `fallback` and `total` below are locals of
that aggregation, not fields.

### fs `knowledge`

**Declared type:** `lib/ai/knowledge/types.ts#KnowledgeArticle` (`lib/ai/knowledge/types.ts:54`)  
**Rule:** `firestore.rules:258`  
**Index:** entry 21, `approved` + `category` + `title` + `__name__` (the `__name__` key was added by commit `2ec7d3a`, 2026-09-23). Its only user, `lib/ai/knowledge/repository.ts`, left Firestore on 2026-10-06, so the index is now unused.  
**Migration (2026-10-18):** **split brain.** Raya AI reads Supabase `ai_knowledge` (`lib/ai/knowledge/repository.ts:16`, commit `fdaff98`); the admin knowledge CRUD, the seed importer and the coverage report still read and write **this** Firestore collection. See fault F-14.

<!--FIELDS knowledge | lib/ai/knowledge/types.ts#KnowledgeArticle-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:134`<br>`app/admin/content/page.tsx:146` | not in the type; content-list bleed |
| `approved` | `boolean` | yes | `app/api/admin/knowledge/route.ts:109`<br>`app/api/admin/knowledge/[id]/route.ts:66` | `app/api/ai/knowledge/coverage/route.ts:82`<br>`app/api/ai/knowledge/import/route.ts:74`<br>`app/api/admin/knowledge/route.ts:38` | declared |
| `category` | `KnowledgeCategory` | yes | `app/api/admin/knowledge/route.ts:107`<br>`app/api/ai/knowledge/import/route.ts:116` (spread) | `app/api/ai/knowledge/coverage/route.ts:89-92`<br>`app/api/ai/knowledge/import/route.ts:77-78`<br>`app/api/admin/knowledge/route.ts:33` | declared |
| `content` | `string` | yes | `app/api/admin/knowledge/route.ts:105` | `app/api/admin/knowledge/route.ts:35` | declared |
| `createdAt` | `Date` | yes | `app/api/ai/knowledge/import/route.ts:116`<br>`app/api/admin/knowledge/route.ts:110` | `app/api/admin/knowledge/route.ts:39` | declared |
| `createdBy` | `?` inferred | - | `app/api/ai/knowledge/import/route.ts:116` | - | not in the type |
| `id` | `string` | yes | `app/api/ai/knowledge/import/route.ts:116` (stored inside the doc too) | - | declared; doc id |
| `image` | `?` inferred | - | - | `app/admin/featured/page.tsx:189` | not in the type; featured-list bleed |
| `imageUrl` | `?` inferred | - | - | `app/admin/featured/page.tsx:156`<br>`app/admin/featured/page.tsx:167`<br>`app/admin/featured/page.tsx:178` | not in the type; featured-list bleed |
| `kannadaContent` | `string` | no | - | `app/api/admin/knowledge/route.ts:36` | declared |
| `kannadaTitle` | `string` | no | - | `app/api/admin/knowledge/route.ts:32` | declared |
| `keywords` | `string[]` | yes | `app/api/admin/knowledge/route.ts:106` | `app/api/admin/knowledge/route.ts:34` | declared |
| `language` | `KnowledgeLanguage` | yes | `app/api/admin/knowledge/route.ts:108` | `app/api/admin/knowledge/route.ts:37` | declared |
| `lastReviewed` | `Date` | no | - | - | declared, **no Firestore call site** (Supabase `last_reviewed` only) |
| `name` | `?` inferred | - | - | `app/admin/featured/page.tsx:177` | not in the type; featured-list bleed |
| `slug` | `string` | yes | `app/api/admin/knowledge/route.ts:103` | `app/api/admin/knowledge/route.ts:30` | declared |
| `status` | `?` inferred | - | - | `app/admin/content/page.tsx:158` | not in the type; content-list bleed |
| `tags` | `?` inferred | - | `app/api/ai/knowledge/import/route.ts:116` | - | not in the type |
| `title` | `string` | yes | `app/api/admin/knowledge/route.ts:104`<br>`app/api/ai/knowledge/coverage/route.ts:90` | `app/admin/content/page.tsx:132`<br>`app/admin/content/page.tsx:144`<br>`app/admin/content/page.tsx:156`<br>+5 more | declared |
| `updatedAt` | `Date` | yes | `app/api/ai/knowledge/import/route.ts:116`<br>`app/api/admin/knowledge/route.ts:111`<br>`app/api/ai/knowledge/coverage/route.ts:90` | `app/admin/content/page.tsx:119-121`<br>+4 more | declared |
| `version` | `?` inferred | - | `app/api/ai/knowledge/import/route.ts:116` | - | not in the type |
<!--END-->

Refreshed by hand on 2026-10-18. The rows citing `app/api/admin/knowledge/*` were added by hand: those
routes go through the REST helpers in `lib/firebase-admin-rest.ts` (`addDocument`, `updateDocument`,
`deleteDocument`, `getDocuments`), which the harvester does not recognise as anchors, so they were
missing from the 2026-09-19 table as well. The `lib/ai/knowledge/repository.ts` cells that used to
fill `content`, `keywords`, `language`, `lastReviewed`, `slug` and `createdAt` moved to sb
`ai_knowledge`.

What a knowledge article now is depends on who you ask:

- The admin **Knowledge** screen lists Firestore (`app/api/admin/knowledge/route.ts:22`) merged with
  seed articles and Supabase pending rows (`getPendingArticles`, imported at `:4`); creates in
  Firestore with `approved: true` (`:102-112`); updates and deletes in Firestore
  (`app/api/admin/knowledge/[id]/route.ts:59-67`, `:98`); but opens a single article from
  **Supabase** by id (`app/api/admin/knowledge/[id]/route.ts:22`, `getArticleById`) - a Firestore doc
  id is never a Supabase `uuid`, so editing an article the screen itself created returns
  "Article not found".
- **Raya AI** answers from Supabase `ai_knowledge` only (`lib/ai/knowledge/repository.ts:55-103`,
  `approved = true`), falling back to `SEED_ARTICLES` when the table is empty.
- The **import** button (`app/api/ai/knowledge/import/route.ts:73-123`) and the **coverage** report
  (`app/api/ai/knowledge/coverage/route.ts:81-92`) still read and write Firestore, while
  `scripts/seed-ai-knowledge.ts:94-106` seeds the same `seed/ai/*.json` files into Supabase.

So an article an administrator writes today is never seen by the chatbot until someone re-runs
`scripts/migrate-ai-knowledge.ts` (`knowledge` -> `ai_knowledge`, `:46-50`). The type still lives
under `lib/ai/knowledge/`, re-exported by `types/knowledge.ts:14`; `kannadaTitle` / `kannadaContent`
now have a home in Supabase (`kannada_title`, `kannada_content`) but no admin form sets them.

### fs `knowledge_articles`

**Declared type:** none.  
**Rule:** `firestore.rules:263`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS knowledge_articles-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** Rule only - a placeholder for a schema that was never built.

### fs `knowledge_audit_log`

**Declared type:** `types/knowledge-workflow.ts#AuditLogEntry` (`types/knowledge-workflow.ts:115`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_audit_log | types/knowledge-workflow.ts#AuditLogEntry-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `action` | `string` | yes | - | `services/knowledge-workflow.service.ts:620` | declared |
| `entityId` | `string` | yes | - | `services/knowledge-workflow.service.ts:611`<br>`services/knowledge-workflow.service.ts:619` | declared |
| `entityType` | `"article" \| "version" \| "workflow" \| "co` | yes | - | `services/knowledge-workflow.service.ts:610`<br>`services/knowledge-workflow.service.ts:618` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `ipAddress` | `string` | no | - | - | declared, **no call site** |
| `metadata` | `Record<string, unknown>` | no | - | `services/knowledge-workflow.service.ts:625` | declared |
| `newState` | `Record<string, unknown>` | no | - | `services/knowledge-workflow.service.ts:624` | declared |
| `performedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:588` | `services/knowledge-workflow.service.ts:612`<br>`services/knowledge-workflow.service.ts:622` | declared |
| `performedBy` | `string` | yes | - | `services/knowledge-workflow.service.ts:621` | declared |
| `previousState` | `Record<string, unknown>` | no | - | `services/knowledge-workflow.service.ts:623` | declared |
| `userAgent` | `string` | no | - | - | declared, **no call site** |
<!--END-->

`services/knowledge-workflow.service.ts:609-612` queries `entityType` + `entityId` +
`orderBy performedAt desc` - a three-field query with no index, on a collection with no rule.
`ipAddress` and `userAgent` are declared and never written.

### fs `knowledge_categories`

**Declared type:** none.  
**Rule:** `firestore.rules:268`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS knowledge_categories-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** Categories are a union type instead
(`lib/ai/knowledge/types.ts:7-49`).

### fs `knowledge_committee_approvals`

**Declared type:** `types/knowledge-workflow.ts#CommitteeApproval` (`types/knowledge-workflow.ts:92`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_committee_approvals | types/knowledge-workflow.ts#CommitteeApproval-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `approvals` | `CommitteeMemberApproval[]` | yes | `services/knowledge-workflow.service.ts:430`<br>`services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:471`<br>`services/knowledge-workflow.service.ts:474`<br>`services/knowledge-workflow.service.ts:563` | declared |
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:430` | `services/knowledge-workflow.service.ts:549`<br>`services/knowledge-workflow.service.ts:560` | declared |
| `completedAt` | `Date` | no | `services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:567` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:430` | `services/knowledge-workflow.service.ts:550`<br>`services/knowledge-workflow.service.ts:566` | declared |
| `currentApprovals` | `number` | yes | `services/knowledge-workflow.service.ts:430`<br>`services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:562` | declared |
| `deadline` | `Date` | no | - | `services/knowledge-workflow.service.ts:565` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `requiredApprovals` | `number` | yes | `services/knowledge-workflow.service.ts:430` | `services/knowledge-workflow.service.ts:501`<br>`services/knowledge-workflow.service.ts:503`<br>`services/knowledge-workflow.service.ts:561` | declared |
| `status` | `"pending" \| "approved" \| "rejected"` | yes | `services/knowledge-workflow.service.ts:430`<br>`services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:564` | declared |
<!--END-->

`services/knowledge-workflow.service.ts:430` opens the ballot, `:507` appends each member's vote into
the `approvals` array and recomputes `currentApprovals` and `status`. `deadline` is declared and read
(`:565`) but never written by any code path.

### fs `knowledge_drafts`

**Declared type:** `types/knowledge-workflow.ts#DraftArticle` (`types/knowledge-workflow.ts:196`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_drafts | types/knowledge-workflow.ts#DraftArticle-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `category` | `KnowledgeCategory` | yes | - | `services/knowledge-workflow.service.ts:1049` | declared |
| `content` | `string` | yes | - | `services/knowledge-workflow.service.ts:1048` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:1020` | `services/knowledge-workflow.service.ts:1052` | declared |
| `createdBy` | `string` | yes | - | `services/knowledge-workflow.service.ts:1040`<br>`services/knowledge-workflow.service.ts:1054` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `keywords` | `string[]` | yes | - | `services/knowledge-workflow.service.ts:1050` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `services/knowledge-workflow.service.ts:1051` | declared |
| `lastSavedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:1013`<br>`services/knowledge-workflow.service.ts:1020` | `services/knowledge-workflow.service.ts:1055` | declared |
| `title` | `string` | yes | - | `services/knowledge-workflow.service.ts:1047` | declared |
| `updatedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:1013`<br>`services/knowledge-workflow.service.ts:1020` | `services/knowledge-workflow.service.ts:1041`<br>`services/knowledge-workflow.service.ts:1053` | declared |
<!--END-->

Editor autosave. `services/knowledge-workflow.service.ts:1039-1041` queries `createdBy` +
`orderBy updatedAt desc` with no index. The draft body (`title`, `content`, `category`, `keywords`,
`language`) goes in as a spread at `:1013`, so only the two timestamps show as writes.

### fs `knowledge_review_comments`

**Declared type:** `types/knowledge-workflow.ts#ReviewComment` (`types/knowledge-workflow.ts:77`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_review_comments | types/knowledge-workflow.ts#ReviewComment-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:380`<br>`services/knowledge-workflow.service.ts:387` | declared |
| `content` | `string` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:389` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:381`<br>`services/knowledge-workflow.service.ts:391` | declared |
| `createdBy` | `string` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:390` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `resolved` | `boolean` | yes | `services/knowledge-workflow.service.ts:351`<br>`services/knowledge-workflow.service.ts:410` | `services/knowledge-workflow.service.ts:392` | declared |
| `resolvedAt` | `Date` | no | `services/knowledge-workflow.service.ts:410` | `services/knowledge-workflow.service.ts:394` | declared |
| `resolvedBy` | `string` | no | `services/knowledge-workflow.service.ts:410` | `services/knowledge-workflow.service.ts:393` | declared |
| `versionId` | `string` | no | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:388` | declared |
<!--END-->

Two queries pair `articleId` with `orderBy createdAt` and have no index
(`services/knowledge-workflow.service.ts:379-381`, `:547-550`).

### fs `knowledge_versions`

**Declared type:** `types/knowledge-workflow.ts#ArticleVersion` (`types/knowledge-workflow.ts:31`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_versions | types/knowledge-workflow.ts#ArticleVersion-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:96` | `services/knowledge-workflow.service.ts:89`<br>`services/knowledge-workflow.service.ts:124`<br>`services/knowledge-workflow.service.ts:131`<br>+1 more | declared |
| `category` | `KnowledgeCategory` | yes | - | `services/knowledge-workflow.service.ts:136`<br>`services/knowledge-workflow.service.ts:165` | declared |
| `changeDescription` | `string` | yes | - | `services/knowledge-workflow.service.ts:140`<br>`services/knowledge-workflow.service.ts:169` | declared |
| `content` | `string` | yes | - | `services/knowledge-workflow.service.ts:134`<br>`services/knowledge-workflow.service.ts:163` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:96` | `services/knowledge-workflow.service.ts:138`<br>`services/knowledge-workflow.service.ts:167` | declared |
| `createdBy` | `string` | yes | - | `services/knowledge-workflow.service.ts:139`<br>`services/knowledge-workflow.service.ts:168` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `keywords` | `string[]` | yes | - | `services/knowledge-workflow.service.ts:135`<br>`services/knowledge-workflow.service.ts:164` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `services/knowledge-workflow.service.ts:137`<br>`services/knowledge-workflow.service.ts:166` | declared |
| `title` | `string` | yes | - | `services/knowledge-workflow.service.ts:133`<br>`services/knowledge-workflow.service.ts:162` | declared |
| `version` | `number` | yes | `services/knowledge-workflow.service.ts:96` | `services/knowledge-workflow.service.ts:90`<br>`services/knowledge-workflow.service.ts:125`<br>`services/knowledge-workflow.service.ts:94`<br>+2 more | declared |
<!--END-->

`services/knowledge-workflow.service.ts:88-90` (next version number) and `:123-125` (history) both
query `articleId` + `orderBy version desc` with no index. The version body is a spread at `:96`, so
`title`/`content`/`keywords`/`category`/`language`/`changeDescription` show as read-only - the
readers at `:133-140` and `:162-169` are the field list.

### fs `knowledge_workflow`

**Declared type:** `types/knowledge-workflow.ts#WorkflowArticle` (`types/knowledge-workflow.ts:132`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_workflow | types/knowledge-workflow.ts#WorkflowArticle-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `__name__` | `?` inferred | - | - | `services/knowledge-workflow.service.ts:518` | not in the type |
| `category` | `KnowledgeCategory` | yes | - | `services/knowledge-workflow.service.ts:720`<br>`services/knowledge-workflow.service.ts:771`<br>`services/knowledge-workflow.service.ts:788`<br>+1 more | declared |
| `committeeApprovals` | `CommitteeApproval` | no | - | - | declared, **no call site** |
| `content` | `string` | yes | - | `services/knowledge-workflow.service.ts:715`<br>`services/knowledge-workflow.service.ts:718`<br>`services/knowledge-workflow.service.ts:787`<br>+1 more | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:792`<br>`services/knowledge-workflow.service.ts:845` | declared |
| `createdBy` | `string` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:775`<br>`services/knowledge-workflow.service.ts:795`<br>`services/knowledge-workflow.service.ts:848` | declared |
| `currentVersion` | `number` | yes | `services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:729` | `services/knowledge-workflow.service.ts:733`<br>`services/knowledge-workflow.service.ts:799`<br>`services/knowledge-workflow.service.ts:852` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `isArchived` | `boolean` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:802`<br>`services/knowledge-workflow.service.ts:855` | declared |
| `isFeatured` | `boolean` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:801`<br>`services/knowledge-workflow.service.ts:854` | declared |
| `keywords` | `string[]` | yes | - | `services/knowledge-workflow.service.ts:719`<br>`services/knowledge-workflow.service.ts:789`<br>`services/knowledge-workflow.service.ts:842` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `services/knowledge-workflow.service.ts:721`<br>`services/knowledge-workflow.service.ts:790`<br>`services/knowledge-workflow.service.ts:843` | declared |
| `lastReviewedAt` | `Date` | no | - | - | declared, **no call site** |
| `lastReviewedBy` | `string` | no | - | - | declared, **no call site** |
| `publishedAt` | `Date` | no | - | `services/knowledge-workflow.service.ts:794`<br>`services/knowledge-workflow.service.ts:847` | declared |
| `reviewedAt` | `?` inferred | - | - | `services/knowledge-workflow.service.ts:798`<br>`services/knowledge-workflow.service.ts:851` | not in the type |
| `reviewedBy` | `?` inferred | - | - | `services/knowledge-workflow.service.ts:797`<br>`services/knowledge-workflow.service.ts:850` | not in the type |
| `slug` | `string` | yes | - | `services/knowledge-workflow.service.ts:785`<br>`services/knowledge-workflow.service.ts:838` | declared |
| `status` | `WorkflowStatus` | yes | `services/knowledge-workflow.service.ts:522`<br>`services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:220`<br>`services/knowledge-workflow.service.ts:767`<br>`services/knowledge-workflow.service.ts:791`<br>+1 more | declared |
| `title` | `string` | yes | - | `services/knowledge-workflow.service.ts:715`<br>`services/knowledge-workflow.service.ts:717`<br>`services/knowledge-workflow.service.ts:786`<br>+1 more | declared |
| `updatedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:522`<br>`services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:729`<br>+1 more | `services/knowledge-workflow.service.ts:778`<br>`services/knowledge-workflow.service.ts:793`<br>`services/knowledge-workflow.service.ts:846` | declared |
| `updatedBy` | `string` | yes | `services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:729`<br>`services/knowledge-workflow.service.ts:737` | `services/knowledge-workflow.service.ts:796`<br>`services/knowledge-workflow.service.ts:849` | declared |
| `versionId` | `string` | yes | `services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:672`<br>`services/knowledge-workflow.service.ts:729` | `services/knowledge-workflow.service.ts:724`<br>`services/knowledge-workflow.service.ts:800`<br>`services/knowledge-workflow.service.ts:853` | declared |
<!--END-->

The editorial twin of `knowledge`: the same article exists in both, in two different shapes, with no
synchronisation code between them. `:518` orders by the `__name__` document-id sentinel (a Firestore
pseudo-field, not a stored one). `:1038` queries `createdBy` + `orderBy updatedAt desc` with no
index. `lastReviewedBy`/`lastReviewedAt` are declared on the type, but the stored fields are
`reviewedBy`/`reviewedAt`; the mapper at `:797-798` renames them on the way out, so the declared
names never exist in a document.

### fs `knowledge_workflow_actions`

**Declared type:** `types/knowledge-workflow.ts#WorkflowAction` (`types/knowledge-workflow.ts:48`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_workflow_actions | types/knowledge-workflow.ts#WorkflowAction-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `action` | `WorkflowActionType` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:327` | declared |
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:319`<br>`services/knowledge-workflow.service.ts:326` | declared |
| `comment` | `string` | no | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:332` | declared |
| `fromStatus` | `WorkflowStatus` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:328` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `newVersionId` | `string` | no | - | - | declared, **no call site** |
| `performedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:320`<br>`services/knowledge-workflow.service.ts:331` | declared |
| `performedBy` | `string` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:330` | declared |
| `previousVersionId` | `string` | no | - | - | declared, **no call site** |
| `toStatus` | `WorkflowStatus` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:329` | declared |
<!--END-->

The state-transition log. `services/knowledge-workflow.service.ts:318-320` queries `articleId` +
`orderBy performedAt desc` with no index. `previousVersionId` and `newVersionId` are declared and
never written.

### fs `members`

**Declared type:** `types/volunteer.ts#Member` (`types/volunteer.ts:1`)  
**Rule:** `firestore.rules:174`  
**Index:** none  
**Migration:** Firestore only - no Supabase table (the `volunteer_requests` table covers volunteers only).

<!--FIELDS members | types/volunteer.ts#Member-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `address` | `string` | yes | - | - | declared, **no call site** |
| `createdAt` | `string` | yes | `services/volunteer.service.ts:66` | `services/volunteer.service.ts:42` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `memberId` | `string` | yes | - | - | declared, **no call site** |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `phone` | `string` | yes | - | - | declared, **no call site** |
| `sex` | `"Male" \| "Female" \| "Other"` | yes | - | - | declared, **no call site** |
| `updatedAt` | `string` | yes | `services/volunteer.service.ts:66`<br>`services/volunteer.service.ts:73` | - | declared |
<!--END-->

Create and update are spreads (`services/volunteer.service.ts:66,73`); the written shape is
`MemberRequest` (`types/volunteer.ts:13`) plus `createdAt`/`updatedAt`. `services/volunteer.service.ts:42`
orders by `createdAt` with no `where`, so no index is needed.

### fs `messages`

**Declared type:** `types/ai.ts#AIMessage` (`types/ai.ts:5`)  
**Rule:** `firestore.rules:237`  
**Index:** **none for this name** - entry 15 declares `sessionId` + `timestamp` on `chat_messages` instead.  
**Migration (2026-10-18):** **no application code left** - removed 2026-10, see Refresh log. `saveMessage` / `getSessionMessages` moved to Supabase `chat_messages` in commit `224875d` (2026-10-06). The collection survives as a migration *source*: `scripts/migrate-all-batched.ts:120` maps it with `mapChatMessage` (`lib/supabase/migration-mappers.ts:549-560`).

<!--FIELDS messages | types/ai.ts#AIMessage-->
_No call site since 2026-10-06. The 2026-09-19 payload was `sessionId`, `id`, `role`, `content`, `timestamp`, `model`, `latency` (the old `services/chat.service.ts:91-99`); `AI_FIELD_SPECS.messages` (`lib/supabase/migration-mappers.ts:447-457`) lists the same set plus `detectedLanguage` as the fields the ETL carries into Supabase._
<!--END-->

The standing fault on this collection - the history query (`sessionId` + `orderBy timestamp`) throwing
`FAILED_PRECONDITION` because the composite index was declared on `chat_messages` instead - is
**FIXED (2026-10-18) by removal**: the query now runs against Supabase, where
`idx_chat_messages_session_id` exists. It was replaced by a different failure: the anon client the
browser uses cannot read or write a deny-all table (fault F-11).

### fs `notifications`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS notifications-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `approved` | `?` inferred | - | - | `services/testimonial.service.ts:400` | not in the type |
| `createdAt` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `image` | `?` inferred | - | - | `services/testimonial.service.ts:399` | not in the type |
| `location` | `?` inferred | - | - | `services/testimonial.service.ts:396` | not in the type |
| `message` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `name` | `?` inferred | - | - | `services/testimonial.service.ts:395` | not in the type |
| `quote` | `?` inferred | - | - | `services/testimonial.service.ts:397` | not in the type |
| `read` | `?` inferred | - | `services/testimonial.service.ts:361`<br>`services/testimonial.service.ts:437` | `services/testimonial.service.ts:431` | not in the type |
| `readAt` | `?` inferred | - | `services/testimonial.service.ts:437` | - | not in the type |
| `relatedId` | `?` inferred | - | `services/testimonial.service.ts:361` | `services/testimonial.service.ts:429` | not in the type |
| `relatedType` | `?` inferred | - | `services/testimonial.service.ts:361` | `services/testimonial.service.ts:430` | not in the type |
| `title` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `type` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `years` | `?` inferred | - | - | `services/testimonial.service.ts:398` | not in the type |
<!--END-->

Written only when a public testimonial arrives (`services/testimonial.service.ts:361`), read back at
`:429-431` and marked read at `:437`. The `name`, `location`, `quote`, `years`, `image` and
`approved` rows below are testimonial fields harvested from `:395-400` by window proximity - treat
them as belonging to `testimonials`, not to a notification document. Real fields: `type`, `title`,
`message`, `relatedId`, `relatedType`, `read`, `readAt`, `createdAt`.

### fs `page_views`

**Declared type:** none - `services/pageviews.service.ts:46-55` is the schema.  
**Rule:** `firestore.rules:193` - public create.  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS page_views-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `country` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:51` | not in the type |
| `date` | `?` inferred | - | `services/pageviews.service.ts:46` | - | not in the type |
| `deviceType` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:49` | not in the type |
| `language` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:50` | not in the type |
| `path` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:47` | not in the type |
| `referrer` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:48` | not in the type |
| `timestamp` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:115` | not in the type |
| `visitorId` | `?` inferred | - | `services/pageviews.service.ts:46` | - | not in the type |
<!--END-->

The largest collection in the project: `data/firestore-dump/README.md` (2026-09-19 snapshot only - never committed to this clone) puts it near 47,000
documents, which is why one full `npm run firestore:dump` exhausts the free-tier 50k daily read
quota. `visitorId` comes from `getOrCreateVisitorId()` and is folded into the unique-visitor set
(`services/pageviews.service.ts:126-129` - corrected 2026-10-18, this sentence used to call it
never queried); `date` is written but never filtered on. The analytics reader at `:114-115` orders by `timestamp` only.

### fs `panchanga`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** never lived in a database.

<!--FIELDS panchanga-->
_No field observed at any call site and no declared type._
<!--END-->

**Documented at `docs/DATA-MODEL.md:708-746` with a complete field list (`tithi`, `nakshatra`, `yoga`,
`karana`, `sunrise`, `sunset`, `rahuKaal`, `yamaganda`, `isEkadashi`, ...), and no code has ever
queried it.** The data is 730 JSON files under `data/panchanga/<year>/` plus
`public/data/panchanga/current.json`, read by `lib/ai/retrieval/panchanga.ts:42` and
`lib/aaradhane/panchanga.ts:65`. Anyone planning a Supabase migration from this document will
migrate an empty collection.

### fs `poojas`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS poojas-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:92` | not in the type |
<!--END-->

Referenced exactly once, as a document count on the admin content dashboard
(`app/admin/content/page.tsx:95`). Distinct from `dailyPoojas`, which is the collection
`services/pooja.service.ts` actually uses - so the admin "poojas" tile counts a collection the pooja
admin never writes to. The `active` row is neighbouring-line noise.

### fs `profiles`

**Declared type:** `types/profile.ts#DevoteeProfile` (`types/profile.ts:38`)  
**Rule:** **none** - client access denied by default.  
**Index:** none  
**Migration:** Firestore only; the Supabase `profiles` table exists with no app code and folds
`bookmarks` into a `jsonb` column.

<!--FIELDS profiles | types/profile.ts#DevoteeProfile-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `bio` | `string` | no | - | - | declared, **no call site** |
| `bookmarks` | `Bookmark[]` | yes | - | - | declared, **no call site** |
| `createdAt` | `Timestamp \| Date` | yes | - | - | declared, **no call site** |
| `device` | `?` inferred | - | - | `services/profile.service.ts:180`<br>`services/profile.service.ts:181` | not in the type |
| `email` | `string` | yes | - | `services/profile.service.ts:111` | declared |
| `favorites` | `string[]` | yes | `services/profile.service.ts:269`<br>`services/profile.service.ts:290` | - | declared |
| `gotra` | `string` | no | - | - | declared, **no call site** |
| `language` | `?` inferred | - | - | `services/profile.service.ts:166`<br>`services/profile.service.ts:167` | not in the type |
| `nakshatra` | `string` | no | - | - | declared, **no call site** |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `notifications` | `?` inferred | - | - | `services/profile.service.ts:175`<br>`services/profile.service.ts:176` | not in the type |
| `phone` | `string` | no | - | - | declared, **no call site** |
| `preferences` | `UserPreferences` | yes | - | `services/profile.service.ts:114`<br>`services/profile.service.ts:115` | declared |
| `profileImage` | `string` | no | - | - | declared, **no call site** |
| `recentlyViewed` | `string[]` | yes | `services/profile.service.ts:314` | - | declared |
| `theme` | `?` inferred | - | - | `services/profile.service.ts:172`<br>`services/profile.service.ts:173` | not in the type |
| `timezone` | `?` inferred | - | - | `services/profile.service.ts:169`<br>`services/profile.service.ts:170` | not in the type |
| `uid` | `string` | yes | - | - | declared, **no call site** |
| `updatedAt` | `Timestamp \| Date` | yes | `services/profile.service.ts:141`<br>`services/profile.service.ts:269`<br>`services/profile.service.ts:290`<br>+1 more | - | declared |
<!--END-->

`services/profile.service.ts:106-121` writes with `{ merge: true }` (the `merge` key is a `setDoc`
option, filtered out of the table). The nested preference keys are read individually at `:166-181` -
`preferences.language`, `.timezone`, `.theme`, `.notifications`, `.device` - so a partial write of
`preferences` silently drops the others. `favorites` (`:269,290`) and `recentlyViewed` (`:314`) are
array fields written with `arrayUnion`-style replacement and never read back through a typed path.

### fs `quotes`

**Declared type:** `types/quote.ts#Quote` (`types/quote.ts:107`)  
**Rule:** `firestore.rules:274`  
**Index:** entry 19 `active` + `priority`; entry 20 `active` + `category` + `priority`.  
**Migration:** Firestore only - no Supabase table.

<!--FIELDS quotes | types/quote.ts#Quote-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | `services/quote.service.ts:263`<br>`services/quote.service.ts:198` | declared |
| `author` | `string` | no | - | `services/quote.service.ts:195` | declared |
| `category` | `QuoteCategory` | yes | - | `services/quote.service.ts:266`<br>`services/quote.service.ts:190` | declared |
| `content` | `QuoteContent` | yes | - | `services/quote.service.ts:193` | declared |
| `createdAt` | `string` | yes | `services/quote.service.ts:367`<br>`scripts/seed-quotes.ts:821` | `services/quote.service.ts:210` | declared |
| `createdBy` | `string` | no | - | `services/quote.service.ts:212` | declared |
| `displayFrom` | `string` | no | - | `services/quote.service.ts:205` | declared |
| `displayTo` | `string` | no | - | `services/quote.service.ts:206` | declared |
| `displayWeight` | `number` | yes | - | `services/quote.service.ts:207` | declared |
| `eventRules` | `{` | no | - | `services/quote.service.ts:204` | declared |
| `featured` | `boolean` | yes | - | `services/quote.service.ts:274`<br>`services/quote.service.ts:199` | declared |
| `festivalNames` | `FestivalName[]` | yes | - | `services/quote.service.ts:201` | declared |
| `festivalOnly` | `boolean` | yes | - | `services/quote.service.ts:278`<br>`services/quote.service.ts:200` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `language` | `QuoteLanguage` | yes | - | `services/quote.service.ts:270`<br>`services/quote.service.ts:192` | declared |
| `panchangaRules` | `PanchangaRules` | no | - | `services/quote.service.ts:203` | declared |
| `priority` | `number` | yes | - | `services/quote.service.ts:191` | declared |
| `rotationGroup` | `string` | no | - | `services/quote.service.ts:208` | declared |
| `slug` | `string` | yes | - | `services/quote.service.ts:349`<br>`services/quote.service.ts:188` | declared |
| `source` | `string` | yes | - | `services/quote.service.ts:194` | declared |
| `stats` | `{` | no | `services/quote.service.ts:367`<br>`scripts/seed-quotes.ts:821` | `services/quote.service.ts:209` | declared |
| `tags` | `string[]` | yes | - | `services/quote.service.ts:197` | declared |
| `title` | `string` | yes | - | `services/quote.service.ts:189` | declared |
| `updatedAt` | `string` | yes | `services/quote.service.ts:367`<br>`services/quote.service.ts:385`<br>`scripts/seed-quotes.ts:821` | `services/quote.service.ts:211` | declared |
| `verseNumber` | `number` | no | - | `services/quote.service.ts:196` | declared |
| `weekdayOnly` | `Weekday \| null` | yes | - | `services/quote.service.ts:282`<br>`services/quote.service.ts:202` | declared |
<!--END-->

The richest schema in the repo. `services/quote.service.ts:263-283` builds up to six equality
`where` constraints (`active`, `category`, `language`, `featured`, `festivalOnly`, `weekdayOnly`)
and then deliberately omits `orderBy` - the comment at `:287` says "sort in memory" and `:296` sorts
by `priority` in JavaScript. That is why the two declared composite indexes (`active`+`priority`,
`active`+`category`+`priority`) are never used: no query pairs a `where` with an `orderBy`. The
mapper at `:188-212` is the field list; `stats` is a nested counter object updated at `:367`.

### fs `receipts`

**Declared type:** `types/receipt.ts#Receipt` (`types/receipt.ts:11`)  
**Rule:** `firestore.rules:102` - server write only.  
**Index:** none  
**Migration:** Firestore only, despite holding money.

<!--FIELDS receipts | types/receipt.ts#Receipt-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | `lib/receipt/admin.ts:134` | `app/api/admin/receipts/route.ts:44`<br>`app/api/admin/receipts/route.ts:51`<br>`app/api/admin/receipts/route.ts:39` | declared |
| `createdBy` | `string` | yes | `lib/receipt/admin.ts:135` | - | declared |
| `devoteeAddress` | `string` | no | `lib/receipt/admin.ts:126` | - | declared |
| `devoteeEmail` | `string` | no | `lib/receipt/admin.ts:125` | - | declared |
| `devoteeName` | `string` | yes | `lib/receipt/admin.ts:123` | - | declared |
| `devoteePhone` | `string` | no | `lib/receipt/admin.ts:124` | - | declared |
| `emailDelivery` | `{ status: "not_requested" \| "pending" \| ` | no | - | - | declared, **no call site** - genuinely never written, `lib/receipt/admin.ts:121-136` omits it |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `items` | `ReceiptItem[]` | yes | `lib/receipt/admin.ts:127` | - | declared; built at `:104-110` (`sevaId`, `sevaName`, `rate`, `quantity`, `amount`) |
| `notes` | `string` | no | `lib/receipt/admin.ts:133` | - | declared |
| `paymentMode` | `PaymentMode` | yes | `lib/receipt/admin.ts:131` | - | declared |
| `paymentReference` | `string` | no | `lib/receipt/admin.ts:132` | - | declared |
| `receiptNumber` | `string` | yes | `lib/receipt/admin.ts:122` | - | declared; value allocated in a transaction at `:44-57` |
| `sevaIds` | `?` inferred | - | `lib/receipt/admin.ts:128` | `app/api/admin/receipts/route.ts:55` | not in the type - a denormalised filter key |
| `subtotal` | `number` | yes | `lib/receipt/admin.ts:129` | - | declared |
| `totalAmount` | `number` | yes | `lib/receipt/admin.ts:130` | - | declared |
| `whatsappDelivery` | `{ status: "not_requested" \| "pending" \| ` | no | - | - | declared, **no call site** - genuinely never written, `lib/receipt/admin.ts:121-136` omits it |
<!--END-->

Admin SDK only. Created by the receipt engine at `lib/receipt/admin.ts:139`, from the object literal
built at `:121-136`; the harvester could not see it because the payload goes through the variable
`receiptDoc`, so the write column above was filled in by hand on 2026-09-19. Listed at
`app/api/admin/receipts/route.ts:38-55` with an optional `sevaIds` filter and an `orderBy createdAt`.
The two nested delivery blocks (`emailDelivery`, `whatsappDelivery`, `types/receipt-extensions.ts:9`)
are **not** in that payload - nothing in the repository writes them, so a receipt on disk has no
delivery state at all. Fourteen of the seventeen fields are written here and read by nothing:
`app/api/admin/receipts/route.ts` returns whole documents to the client, which is why no per-field
read shows up. **Missing index.** That route composes `where("sevaIds", "array-contains", …)`
(`:55`) with `orderBy("createdAt", "desc")` (`:39`) and an optional `createdAt` range (`:44,51`);
an `array-contains` plus an order-by on another field needs a composite index, and
`firestore.indexes.json` declares nothing for `receipts`, so filtering the receipt list by seva
throws `FAILED_PRECONDITION`.

### fs `receiptSevas`

**Declared type:** `types/receiptSeva.ts#ReceiptSeva` (`types/receiptSeva.ts:1`)  
**Rule:** `firestore.rules:85` - the **only** rule block in the file that validates a payload.  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS receiptSevas | types/receiptSeva.ts#ReceiptSeva-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `amount` | `number` | yes | - | - | declared, **no call site** |
| `createdAt` | `string` | yes | `scripts/seed-receipt-sevas.ts:110` | - | declared |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `name` | `string` | yes | - | `scripts/seed-receipt-sevas.ts:100` | declared |
| `updatedAt` | `string` | yes | `scripts/seed-receipt-sevas.ts:110` | - | declared |
<!--END-->

eant as the receipt line-item catalogue, separate from `sevas` - but since 2026-09-07 the receipt book uses `sevas` instead (fault F-23), so this collection is seed-only. Seeded idempotently by
`scripts/seed-receipt-sevas.ts:98-110`, which checks `name` before inserting. he admin API at
`app/api/admin/receipt-sevas/route.ts:75` (create) and `app/api/admin/receipt-sevas/[id]/route.ts:55`
(patch) does **not** write here: both files set `RECEIPT_SEVAS_COLLECTION = "sevas"` (`:13`, `:12`), so
the harvest filing them under `sevas` is correct (corrected by verification 2026-10-18; the earlier
claim that they target `receiptSevas` was wrong).

### fs `sevaBookings`

**Declared type:** `types/seva-booking.ts#SevaBooking` (`types/seva-booking.ts:9`)  
**Rule:** `firestore.rules:113`  
**Index:** entry 4 `userId` + `preferredDate` DESC; entry 5 `status` + `createdAt` DESC.  
**Migration:** the app is Firestore only; since 2026-09-21 the Supabase `seva_bookings` table is filled by `scripts/migrate-seva-bookings-to-supabase.ts` (see that table). A read-only diagnostic, `scripts/diagnostic-sevaBookings.ts:7`, dumps the collection for checking. The 2026-10-18 harvest adds read cells for thirteen fields from `scripts/migrate-seva-bookings-to-supabase.ts:82-105`; they are the ETL, not app code, and were deliberately not copied into the table below.

<!--FIELDS sevaBookings | types/seva-booking.ts#SevaBooking-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | `services/sevaBooking.service.ts:36` | `app/api/public/receipts/route.ts:28`<br>`app/api/public/receipts/route.ts:62`<br>`services/sevaBooking.service.ts:43`<br>+2 more | declared |
| `gotra` | `string` | no | - | `services/sevaBooking.service.ts:18` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `nakshatra` | `string` | no | - | `services/sevaBooking.service.ts:19` | declared |
| `notes` | `string` | yes | - | `app/api/public/receipts/route.ts:56`<br>`services/sevaBooking.service.ts:22` | declared |
| `paymentDate` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:60`<br>`services/sevaBooking.service.ts:26` | declared |
| `paymentMethod` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:61`<br>`services/sevaBooking.service.ts:27` | declared |
| `paymentReference` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:36`<br>`services/sevaBooking.service.ts:24` | declared |
| `paymentStatus` | `PaymentStatus` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:59`<br>`services/sevaBooking.service.ts:25` | declared |
| `preferredDate` | `string` | yes | - | `app/api/public/receipts/route.ts:55`<br>`services/sevaBooking.service.ts:21` | declared |
| `raashi` | `string` | no | - | `services/sevaBooking.service.ts:20` | declared |
| `sevaAmount` | `number` | yes | - | `app/api/public/receipts/route.ts:50`<br>`services/sevaBooking.service.ts:13` | declared |
| `sevaId` | `string` | yes | - | `app/api/public/receipts/route.ts:48`<br>`services/sevaBooking.service.ts:11` | declared |
| `sevaTitle` | `string` | yes | - | `app/api/public/receipts/route.ts:49`<br>`services/sevaBooking.service.ts:12` | declared |
| `status` | `SevaBookingStatus` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:78`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:57`<br>`services/sevaBooking.service.ts:23` | declared |
| `updatedAt` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:78`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:63`<br>`services/sevaBooking.service.ts:29` | declared |
| `userEmail` | `string` | yes | - | `app/api/public/receipts/route.ts:35`<br>`services/sevaBooking.service.ts:16` | declared |
| `userId` | `string` | yes | - | `app/api/public/receipts/route.ts:51`<br>`services/sevaBooking.service.ts:55`<br>`services/sevaBooking.service.ts:14` | declared |
| `userName` | `string` | yes | - | `app/api/public/receipts/route.ts:52`<br>`services/sevaBooking.service.ts:15` | declared |
| `userPhone` | `string` | yes | - | `app/api/public/receipts/route.ts:34`<br>`services/sevaBooking.service.ts:17` | declared |
<!--END-->

**Index mismatch.** `services/sevaBooking.service.ts:55` queries `userId` + `orderBy createdAt desc`,
but the declared index pairs `userId` with `preferredDate`, so "my bookings" throws. **Doc
mismatch.** `docs/DATA-MODEL.md:130-134` names the devotee fields `devoteeName`, `devoteeEmail`,
`devoteePhone`; the code uses `userName`, `userEmail`, `userPhone` (`types/seva-booking.ts:14-17`).
The document also claims `preferredTime`, `statusHistory`, `paymentId`, `paymentMode`, `bookedBy`,
`confirmedBy` and `confirmedAt` - none exist. `app/api/public/receipts/route.ts:20-63` reads this
collection (not `receipts`) to build public receipts, so a booking is also the receipt record.

### fs `sevas`

**Declared type:** `types/seva.ts#Seva` (`types/seva.ts:1`); the write shape is `SevaRequest` (`types/seva.ts:25`).  
**Rule:** `firestore.rules:76`  
**Index:** entry 2 `category` + `displayOrder` (unused); entry 3 `active` + `displayOrder` (used by `lib/ai/retrieval/sevas.ts:124-127`).  
**Migration:** **Split brain.** Reads come from Supabase (`app/actions/sevas.ts:6,13`, called by `services/seva.service.ts:11,44`); writes go to Firestore (`:76,81`).

<!--FIELDS sevas | types/seva.ts#Seva-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/admin/content/page.tsx:92`<br>`app/api/admin/receipt-sevas/route.ts:38`<br>`lib/ai/retrieval/sevas.ts:126`<br>+3 more | declared |
| `amount` | `number` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:37`<br>`lib/ai/retrieval/sevas.ts:105`<br>`lib/receipt/admin.ts:94`<br>+2 more | declared |
| `category` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75` | `lib/ai/retrieval/sevas.ts:104`<br>`scripts/migrate-sevas.ts:68`<br>`scripts/migrate-sevas.ts:80` | declared |
| `createdAt` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75`<br>`services/seva.service.ts:76`<br>`scripts/seed-sevas.ts:93` | `app/api/admin/receipt-sevas/route.ts:40`<br>`scripts/migrate-sevas.ts:72`<br>`scripts/migrate-sevas.ts:73` | declared |
| `description` | `string` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:36`<br>`lib/ai/retrieval/sevas.ts:103`<br>`scripts/migrate-sevas.ts:67`<br>+1 more | declared |
| `displayOrder` | `number` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:39`<br>`lib/ai/retrieval/sevas.ts:127`<br>`scripts/migrate-sevas.ts:85` | declared |
| `duration` | `number` | yes | `app/api/admin/receipt-sevas/route.ts:75` | `lib/ai/retrieval/sevas.ts:106`<br>`scripts/migrate-sevas.ts:70`<br>`scripts/migrate-sevas.ts:82` | declared |
| `firestore_id` | `?` inferred | - | - | `app/actions/sevas.ts:13`<br>`scripts/migrate-sevas.ts:143` | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75` | `scripts/migrate-sevas.ts:83` | declared |
| `name` | `string` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:35`<br>`lib/ai/retrieval/sevas.ts:102`<br>`lib/receipt/admin.ts:91`<br>+4 more | declared |
| `updatedAt` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75`<br>`app/api/admin/receipt-sevas/[id]/route.ts:55`<br>`services/seva.service.ts:76`<br>+2 more | `app/api/admin/receipt-sevas/route.ts:41`<br>`scripts/migrate-sevas.ts:74` | declared |
<!--END-->

An admin edit writes Firestore and the public list keeps serving the Supabase row until someone
re-runs `scripts/migrate-sevas.ts`. The Supabase reader maps snake_case back to camelCase at
`services/seva.service.ts:12-25` (`image_url`→`imageUrl`, `display_order`→`displayOrder`,
`created_at`→`createdAt`) and, notably, uses `firestore_id` as the object's `id` (`:13,46`), so the
public seva id is the Firestore document id even when the row came from Postgres. The Firestore
fallback at `:34` returns raw `doc.data()` with no mapping, so the two paths return different shapes
on the same call. Until 2026-10-14 `lib/ai/firebaseChat.ts:111` read a `price` field that no writer ever
sets (harmlessly, via `data.price || data.amount || ""`); that file was deleted in commit `2891323`
and the `price` row is gone - removed 2026-10, see Refresh log. The AI now reads sevas only through
`lib/ai/retrieval/sevas.ts:102-107`.
he receipt-book admin routes (`app/api/admin/receipt-sevas/*`) write this collection too - their constant `RECEIPT_SEVAS_COLLECTION` is `"sevas"` (`app/api/admin/receipt-sevas/route.ts:13`), and receipt creation looks sevas up here (`lib/receipt/admin.ts:32`); see fault F-23.

### fs `settings`

**Declared type:** `types/settings.ts#SiteSettings` covers one document only; the rest have no type.  
**Rule:** `firestore.rules:136` **and** `firestore.rules:231` - a duplicate `match /settings/{docId}` whose second copy is `allow write: if true`.  
**Index:** none  
**Migration:** partly replaced by Supabase `site_settings` and `social_links`; since 2026-09-22 every other document is also copied verbatim into Supabase `settings_documents` by the ETL, but the app still reads and writes only Firestore for those.

<!--FIELDS settings | types/settings.ts#SiteSettings-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aboutContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:195`<br>`app/admin/settings/about/page.tsx:373` | not in the type |
| `aboutContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:196`<br>`app/(public)/about/page.tsx:197`<br>`app/admin/settings/about/page.tsx:384` | not in the type |
| `aboutTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:191`<br>`app/admin/settings/about/page.tsx:363` | not in the type |
| `activities` | `?` inferred | - | - | `app/(public)/about/page.tsx:233`<br>`app/admin/settings/about/page.tsx:419`<br>`app/admin/settings/about/page.tsx:422`<br>+1 more | not in the type |
| `activitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:229`<br>`app/admin/settings/about/page.tsx:403` | not in the type |
| `address` | `string` | yes | - | `app/(public)/about/page.tsx:317`<br>`app/admin/settings/about/page.tsx:547`<br>`app/admin/settings/footer/page.tsx:262`<br>+3 more | declared |
| `amenities` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:218`<br>`app/(public)/facilities/page.tsx:231`<br>`app/admin/settings/facilities/page.tsx:469`<br>+1 more | not in the type |
| `amenitiesSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:227`<br>`app/admin/settings/facilities/page.tsx:451` | not in the type |
| `amenitiesTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:224`<br>`app/admin/settings/facilities/page.tsx:441` | not in the type |
| `billing` | `?` inferred | - | `app/admin/billing/settings/page.tsx:78` | `app/admin/billing/create/page.tsx:54`<br>`app/admin/billing/create/page.tsx:56`<br>`app/admin/billing/settings/page.tsx:50`<br>+25 more | not in the type |
| `billingEnabled` | `?` inferred | - | `app/admin/billing/settings/page.tsx:78` | `app/admin/billing/page.tsx:53`<br>`app/admin/billing/page.tsx:54`<br>`app/admin/settings/finance/page.tsx:35`<br>+3 more | not in the type |
| `calendarLinks` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:166`<br>`app/admin/settings/footer/page.tsx:371` | not in the type |
| `categories` | `?` inferred | - | - | `app/admin/settings/shlokas/page.tsx:301` | not in the type |
| `communityContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:360`<br>`app/admin/settings/about/page.tsx:611` | not in the type |
| `communityContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:361`<br>`app/(public)/about/page.tsx:362`<br>`app/admin/settings/about/page.tsx:622` | not in the type |
| `communityQuote` | `?` inferred | - | - | `app/(public)/about/page.tsx:365`<br>`app/admin/settings/about/page.tsx:634` | not in the type |
| `communityQuoteKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:367`<br>`app/(public)/about/page.tsx:369`<br>`app/admin/settings/about/page.tsx:645` | not in the type |
| `communityTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:356`<br>`app/admin/settings/about/page.tsx:601` | not in the type |
| `contactEmail` | `string` | yes | - | `app/api/admin/receipts/[id]/pdf/route.ts:37`<br>`lib/ai/retrieval/settings.ts:80`<br>`scripts/migrate-settings.ts:99`<br>+1 more | declared |
| `contactPhone` | `string` | yes | - | `app/api/admin/receipts/[id]/pdf/route.ts:36`<br>`lib/ai/retrieval/settings.ts:79` | declared |
| `copyrightText` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:403` | not in the type |
| `currentYear` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:412` | not in the type |
| `email` | `?` inferred | - | - | `app/(public)/about/page.tsx:337`<br>`app/(public)/about/page.tsx:340`<br>`app/(public)/about/page.tsx:341`<br>+5 more | not in the type |
| `eveningClose` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:380`<br>`lib/ai/retrieval/settings.ts:85` | not in the type |
| `eveningOpen` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:369`<br>`lib/ai/retrieval/settings.ts:84` | not in the type |
| `eveningSchedule` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:150`<br>`app/admin/settings/puja-schedule/page.tsx:398` | not in the type |
| `eveningTitle` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:358` | not in the type |
| `facebook` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:176`<br>`app/admin/settings/social-links/page.tsx:181`<br>`app/admin/settings/social-links/page.tsx:183` | not in the type |
| `facilities` | `?` inferred | - | - | `app/(public)/about/page.tsx:203`<br>`app/(public)/about/page.tsx:213`<br>`app/(public)/facilities/page.tsx:180`<br>+3 more | not in the type |
| `facilitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:209` | not in the type |
| `festivalNote` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:427` | not in the type |
| `festivalNoteKannada` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:438` | not in the type |
| `footerText` | `string` | no | - | - | declared, **no call site** |
| `googleMapsUrl` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:90` | not in the type |
| `gurus` | `?` inferred | - | - | `app/admin/settings/guru-parampara/page.tsx:225`<br>`app/admin/settings/guru-parampara/page.tsx:246`<br>`app/admin/settings/guru-parampara/page.tsx:361`<br>+2 more | not in the type |
| `heading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:159`<br>`app/(public)/trust/page.tsx:114`<br>`app/admin/settings/ekadashi-calendar/page.tsx:194`<br>+7 more | not in the type |
| `headingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:162`<br>`app/(public)/trust/page.tsx:117`<br>`app/admin/settings/ekadashi-calendar/page.tsx:205`<br>+6 more | not in the type |
| `heroImageUrl` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:155`<br>`app/(public)/facilities/page.tsx:158`<br>`app/(public)/facilities/page.tsx:247`<br>+3 more | not in the type |
| `heroSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:173`<br>`app/admin/settings/facilities/page.tsx:301` | not in the type |
| `heroTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:170`<br>`app/admin/settings/facilities/page.tsx:291` | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `instagram` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:221`<br>`app/admin/settings/social-links/page.tsx:226`<br>`app/admin/settings/social-links/page.tsx:228` | not in the type |
| `isTempleOpen` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:217` | not in the type |
| `linkedin` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:387` | not in the type |
| `logoUrl` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:245` | not in the type |
| `mapUrl` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:307`<br>`app/admin/settings/social-links/page.tsx:420`<br>`app/admin/settings/social-links/page.tsx:425`<br>+1 more | not in the type |
| `members` | `?` inferred | - | - | `app/(public)/trust/page.tsx:76`<br>`app/admin/settings/trust-committee/page.tsx:114`<br>`app/admin/settings/trust-committee/page.tsx:233`<br>+3 more | not in the type |
| `morningClose` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:310`<br>`lib/ai/retrieval/settings.ts:83` | not in the type |
| `morningOpen` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:299`<br>`lib/ai/retrieval/settings.ts:82` | not in the type |
| `morningSchedule` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:130`<br>`app/admin/settings/puja-schedule/page.tsx:328` | not in the type |
| `morningTitle` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:288` | not in the type |
| `pageSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:185`<br>`app/admin/settings/facilities/page.tsx:343` | not in the type |
| `pageTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:184`<br>`app/admin/settings/facilities/page.tsx:332` | not in the type |
| `phone` | `?` inferred | - | - | `app/(public)/about/page.tsx:329`<br>`app/admin/settings/about/page.tsx:560`<br>`app/admin/settings/footer/page.tsx:274`<br>+3 more | not in the type |
| `phone2` | `?` inferred | - | - | `app/(public)/about/page.tsx:331`<br>`app/(public)/about/page.tsx:334`<br>`app/admin/settings/about/page.tsx:571`<br>+2 more | not in the type |
| `plans` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:123`<br>`app/admin/settings/future-plans/page.tsx:189`<br>`app/admin/settings/future-plans/page.tsx:307`<br>+3 more | not in the type |
| `quickLinks` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:154`<br>`app/admin/settings/footer/page.tsx:319` | not in the type |
| `resourcesContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:288` | not in the type |
| `resourcesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:279` | not in the type |
| `sacredMotto` | `?` inferred | - | - | `app/(public)/about/page.tsx:167`<br>`app/(public)/about/page.tsx:171`<br>`app/(public)/about/page.tsx:174`<br>+1 more | not in the type |
| `samvatsara` | `?` inferred | - | - | `app/admin/settings/ekadashi-calendar/page.tsx:216`<br>`app/admin/settings/festival-calendar/page.tsx:206` | not in the type |
| `samvatsaraKannada` | `?` inferred | - | - | `app/admin/settings/ekadashi-calendar/page.tsx:227`<br>`app/admin/settings/festival-calendar/page.tsx:217` | not in the type |
| `sectionSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:275`<br>`app/admin/settings/facilities/page.tsx:514` | not in the type |
| `sectionTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:272`<br>`app/admin/settings/facilities/page.tsx:504` | not in the type |
| `sevaContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:252`<br>`app/admin/settings/about/page.tsx:476` | not in the type |
| `sevaContentKannada` | `?` inferred | - | - | `app/admin/settings/about/page.tsx:487` | not in the type |
| `sevaItems` | `?` inferred | - | - | `app/(public)/about/page.tsx:254`<br>`app/admin/settings/about/page.tsx:505` | not in the type |
| `sevaTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:248`<br>`app/admin/settings/about/page.tsx:466` | not in the type |
| `sevasLinks` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:160`<br>`app/admin/settings/footer/page.tsx:345` | not in the type |
| `shlokas` | `?` inferred | - | - | `app/admin/settings/shlokas/page.tsx:133`<br>`app/admin/settings/shlokas/page.tsx:141`<br>`app/admin/settings/shlokas/page.tsx:147`<br>+3 more | not in the type |
| `showFacebook` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:166` | not in the type |
| `showInstagram` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:211` | not in the type |
| `showLinkedin` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:378` | not in the type |
| `showMap` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:410` | not in the type |
| `showTwitter` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:346` | not in the type |
| `showWhatsapp` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:301` | not in the type |
| `showYoutube` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:256` | not in the type |
| `subheading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:165`<br>`app/(public)/trust/page.tsx:120`<br>`app/admin/settings/future-plans/page.tsx:277`<br>+4 more | not in the type |
| `subheadingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:168`<br>`app/(public)/trust/page.tsx:123`<br>`app/admin/settings/future-plans/page.tsx:288`<br>+4 more | not in the type |
| `subtitle` | `?` inferred | - | - | `app/api/admin/receipts/[id]/pdf/route.ts:34` | not in the type |
| `tagline` | `?` inferred | - | - | `app/admin/settings/about/page.tsx:294` | not in the type |
| `tagline2` | `?` inferred | - | - | `app/(public)/about/page.tsx:160`<br>`app/admin/settings/about/page.tsx:316` | not in the type |
| `taglineKannada` | `?` inferred | - | - | `app/admin/settings/about/page.tsx:305` | not in the type |
| `templeName` | `string` | yes | - | `app/(public)/about/page.tsx:157`<br>`app/admin/settings/about/page.tsx:272`<br>`app/admin/settings/footer/page.tsx:223`<br>+3 more | declared |
| `templeNameKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:154`<br>`app/admin/settings/about/page.tsx:283` | not in the type |
| `templeSubtitle` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:234` | not in the type |
| `twitter` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:355` | not in the type |
| `updatedAt` | `any` | no | `app/admin/billing/settings/page.tsx:78`<br>`app/admin/settings/about/page.tsx:153`<br>`app/admin/settings/ekadashi-calendar/page.tsx:89`<br>+10 more | `app/api/admin/receipts/[id]/pdf/route.ts:27`<br>`lib/ai/retrieval/settings.ts:66`<br>`scripts/migrate-settings.ts:121` | declared |
| `visitTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:307`<br>`app/admin/settings/about/page.tsx:536`<br>`scripts/check-about-us.ts:58` | not in the type |
| `welcomeMessage` | `string` | no | - | - | declared, **no call site** |
| `whatsapp` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:311`<br>`app/admin/settings/social-links/page.tsx:316`<br>`app/admin/settings/social-links/page.tsx:318` | not in the type |
| `youtube` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:266`<br>`app/admin/settings/social-links/page.tsx:271`<br>`app/admin/settings/social-links/page.tsx:273` | not in the type |
<!--END-->

**This is not one schema but eleven documents keyed by id**, each with its own shape. The table above
is their union. Confirmed document ids and their owners:

| document | written by | read by | shape |
|---|---|---|---|
| `settings/aboutUs` | `app/admin/settings/about/page.tsx:153` | `app/(public)/about/page.tsx:112` | 26 fields - see sub-table below |
| `settings/facilities` | `app/admin/settings/facilities/page.tsx:166` | `app/(public)/facilities/page.tsx:126` | 11 fields |
| `settings/futurePlans` | `app/admin/settings/future-plans/page.tsx:152`, `scripts/seed-future-plans.ts:71` | `app/(public)/future-plans/page.tsx:108` | 5 fields |
| `settings/trustCommittee` | `app/admin/settings/trust-committee/page.tsx:78`, `scripts/seed-trust-committee.ts:218` | `app/(public)/trust/page.tsx:61` | 5 fields |
| `settings/footer` | `app/admin/settings/footer/page.tsx:114` | `components/layout/Footer.tsx:70` | `logoUrl`, `templeName`, `templeSubtitle`, `address`, `phone`, `phone2`, `email`, `mapUrl`, `quickLinks`, `sevasLinks`, `calendarLinks`, `copyrightText`, `currentYear` |
| `settings/socialLinks` | `app/admin/settings/social-links/page.tsx:88` | nothing - the site reads Supabase `social_links` instead | `facebook`, `instagram`, `youtube`, `whatsapp`, `twitter`, `linkedin`, `mapUrl` + seven `show*` booleans |
| ~~`settings/ai`~~ | ~~`lib/ai/settings.ts:68`~~ | ~~`lib/ai/settings.ts:39`~~ | **removed 2026-10 - see Refresh log.** `lib/ai/settings.ts` was deleted by commit `2891323` (2026-10-14); AI configuration lives in Supabase `ai_settings`. No code reads or writes this document now. |
| `settings/device` | `lib/device/settings.ts:89` | `lib/device/settings.ts:53` | `types/device.ts#DeviceSettings` (`types/device.ts:236`) |
| `settings/config` | none | `services/proof-report/database-export.service.ts:85` | read-only diagnostic |
| `settings/financeSettings` | `app/admin/settings/finance/page.tsx:70`, `scripts/update-finance-settings.ts:52` | `hooks/useFinanceSettings.ts:22` | `types/finance.ts#FinanceSettings` (`types/finance.ts:1`) |
| `settings/<billing>` | `app/admin/billing/settings/page.tsx:78` | `app/admin/billing/create/page.tsx:47`, `app/admin/billing/page.tsx:49` | `billing` (a `BillingSettings` block), `billingEnabled`, `updatedAt` |

Per-document field harvests (the harvester opens a bucket per literal document id):

<!--FIELDS settings/aboutUs-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aboutContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:195` | not in the type |
| `aboutContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:196`<br>`app/(public)/about/page.tsx:197` | not in the type |
| `aboutTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:191` | not in the type |
| `activities` | `?` inferred | - | - | `app/(public)/about/page.tsx:233` | not in the type |
| `activitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:229` | not in the type |
| `address` | `?` inferred | - | - | `app/(public)/about/page.tsx:317` | not in the type |
| `communityContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:360` | not in the type |
| `communityContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:361`<br>`app/(public)/about/page.tsx:362` | not in the type |
| `communityQuote` | `?` inferred | - | - | `app/(public)/about/page.tsx:365` | not in the type |
| `communityQuoteKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:367`<br>`app/(public)/about/page.tsx:369` | not in the type |
| `communityTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:356` | not in the type |
| `email` | `?` inferred | - | - | `app/(public)/about/page.tsx:337`<br>`app/(public)/about/page.tsx:340`<br>`app/(public)/about/page.tsx:341` | not in the type |
| `facilities` | `?` inferred | - | - | `app/(public)/about/page.tsx:203`<br>`app/(public)/about/page.tsx:213` | not in the type |
| `facilitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:209` | not in the type |
| `phone` | `?` inferred | - | - | `app/(public)/about/page.tsx:329` | not in the type |
| `phone2` | `?` inferred | - | - | `app/(public)/about/page.tsx:331`<br>`app/(public)/about/page.tsx:334` | not in the type |
| `resourcesContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:288` | not in the type |
| `resourcesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:279` | not in the type |
| `sacredMotto` | `?` inferred | - | - | `app/(public)/about/page.tsx:167`<br>`app/(public)/about/page.tsx:171`<br>`app/(public)/about/page.tsx:174` | not in the type |
| `sevaContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:252` | not in the type |
| `sevaItems` | `?` inferred | - | - | `app/(public)/about/page.tsx:254` | not in the type |
| `sevaTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:248` | not in the type |
| `tagline2` | `?` inferred | - | - | `app/(public)/about/page.tsx:160` | not in the type |
| `templeName` | `?` inferred | - | - | `app/(public)/about/page.tsx:157` | not in the type |
| `templeNameKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:154` | not in the type |
| `visitTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:307` | not in the type |
<!--END-->

<!--FIELDS settings/facilities-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `amenities` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:218`<br>`app/(public)/facilities/page.tsx:231` | not in the type |
| `amenitiesSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:227` | not in the type |
| `amenitiesTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:224` | not in the type |
| `facilities` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:180`<br>`app/(public)/facilities/page.tsx:189` | not in the type |
| `heroImageUrl` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:155`<br>`app/(public)/facilities/page.tsx:158`<br>`app/(public)/facilities/page.tsx:247`<br>+1 more | not in the type |
| `heroSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:173` | not in the type |
| `heroTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:170` | not in the type |
| `pageSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:185` | not in the type |
| `pageTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:184` | not in the type |
| `sectionSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:275` | not in the type |
| `sectionTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:272` | not in the type |
<!--END-->

<!--FIELDS settings/futurePlans-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `heading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:159` | not in the type |
| `headingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:162` | not in the type |
| `plans` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:123` | not in the type |
| `subheading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:165` | not in the type |
| `subheadingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:168` | not in the type |
<!--END-->

<!--FIELDS settings/trustCommittee-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `heading` | `?` inferred | - | - | `app/(public)/trust/page.tsx:114` | not in the type |
| `headingKannada` | `?` inferred | - | - | `app/(public)/trust/page.tsx:117` | not in the type |
| `members` | `?` inferred | - | - | `app/(public)/trust/page.tsx:76` | not in the type |
| `subheading` | `?` inferred | - | - | `app/(public)/trust/page.tsx:120` | not in the type |
| `subheadingKannada` | `?` inferred | - | - | `app/(public)/trust/page.tsx:123` | not in the type |
<!--END-->

Three things follow from this. (1) `docs/DATA-MODEL.md:488-495` claims a single document
`settings/main` holding a `TempleSettings` object with `{en, kn}` sub-objects - that document does
not exist. (2) The AI reads a *different* set of keys again through
`lib/ai/retrieval/settings.ts:77-90` (`templeName`, `contactPhone`, `contactEmail`, `address`,
`morningOpen`, `morningClose`, `eveningOpen`, `eveningClose`, `googleMapsUrl`), scanning the whole
collection rather than naming a document (`:44`). (3) The duplicate rule at `firestore.rules:231`
makes every settings document world-writable, which is the highest-severity item in this file.

### fs `system`

**Declared type:** none.  
**Rule:** `firestore.rules:108` - deny all; server SDK only.  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS system-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `lastNumber` | `?` inferred | - | `lib/receipt/admin.ts:53` | - | not in the type |
| `prefix` | `?` inferred | - | `lib/receipt/admin.ts:53` | - | not in the type |
| `year` | `?` inferred | - | `lib/receipt/admin.ts:53` | - | not in the type |
<!--END-->

One document, the receipt counter. `lib/receipt/admin.ts:46-56` runs a transaction that reads
`counterSnap.data()` (invisible to the harvester) and writes `{ year, lastNumber, prefix }` with
`{ merge: false }` at `:53`. `merge: false` means any future field added to this document is wiped on
the next receipt.

### fs `temple_areas`

**Declared type:** `types/temple-explorer.ts#TempleArea` (`types/temple-explorer.ts:14`)  
**Rule:** `firestore.rules:252`  
**Index:** none  
**Migration:** **Supabase only** - the Firestore path is dead.

<!--FIELDS temple_areas | types/temple-explorer.ts#TempleArea-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `bestTimeToVisit` | `string` | no | - | - | declared, **no call site** |
| `best_time_to_visit` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:180` | not in the type |
| `category` | `TempleAreaCategory` | yes | - | `services/temple-areas.supabase.service.ts:178` | declared |
| `description` | `string` | yes | - | `services/temple-areas.supabase.service.ts:174` | declared |
| `features` | `string[]` | no | - | `services/temple-areas.supabase.service.ts:179` | declared |
| `firestore_id` | `?` inferred | - | `scripts/seed-temple-areas.ts:37` | - | not in the type |
| `has360View` | `boolean` | no | - | - | declared, **no call site** |
| `has360_view` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:182` | not in the type |
| `icon` | `string` | yes | - | `services/temple-areas.supabase.service.ts:176` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | no | - | - | declared, **no call site** |
| `image_url` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:177` | not in the type |
| `name` | `string` | yes | - | `services/temple-areas.supabase.service.ts:172` | declared |
| `nameKannada` | `string` | no | - | - | declared, **no call site** |
| `name_kannada` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:173` | not in the type |
| `order` | `number` | no | - | `services/temple-areas.supabase.service.ts:18`<br>`services/temple-areas.supabase.service.ts:41`<br>`services/temple-areas.supabase.service.ts:183` | declared |
| `significance` | `string` | no | - | `services/temple-areas.supabase.service.ts:175` | declared |
| `tips` | `string[]` | no | - | `services/temple-areas.supabase.service.ts:181` | declared |
<!--END-->

The rule guards a collection no code reads; `services/temple-areas.supabase.service.ts` is the only
reader and it targets Postgres. The rows below are the Supabase column reads, filed here because the
two stores share a name - see `sb temple_areas` for the authoritative column list.
`types/temple-explorer.ts` also exports the `TEMPLE_AREAS` constant used as a static fallback.

### fs `test`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** n/a.

<!--FIELDS test-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `?` inferred | - | `app/admin/test/page.tsx:15` | - | not in the type |
| `message` | `?` inferred | - | `app/admin/test/page.tsx:15` | - | not in the type |
<!--END-->

Debug leftover. `app/admin/test/page.tsx:15` writes `{ message, createdAt }` from a page that ships
in the production build.

### fs `testimonials`

**Declared type:** `types/homepage.ts#Testimonial` (`types/homepage.ts:133`); `types/ai.ts:58` declares a second, different `Testimonial`.  
**Rule:** `firestore.rules:167` - public create.  
**Index:** entry 13, `approved` + `createdAt` DESC.  
**Migration:** Firestore only; the Supabase `testimonials` table exists with no app code.

<!--FIELDS testimonials | types/homepage.ts#Testimonial-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `approved` | `boolean` | no | `services/chat.service.ts:247`<br>`services/testimonial.service.ts:120` | `app/admin/content/page.tsx:98`<br>`services/chat.service.ts:214`<br>`services/chat.service.ts:232`<br>+5 more | declared |
| `createdAt` | `number \| Date` | no | - | `services/chat.service.ts:215`<br>`services/chat.service.ts:233`<br>`services/chat.service.ts:223`<br>+8 more | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `image` | `string` | no | - | `services/testimonial.service.ts:94`<br>`services/testimonial.service.ts:160`<br>`services/testimonial.service.ts:203`<br>+2 more | declared |
| `location` | `string` | yes | - | `services/testimonial.service.ts:91`<br>`services/testimonial.service.ts:157`<br>`services/testimonial.service.ts:200`<br>+1 more | declared |
| `name` | `string` | yes | - | `services/testimonial.service.ts:90`<br>`services/testimonial.service.ts:156`<br>`services/testimonial.service.ts:199`<br>+1 more | declared |
| `phone` | `string` | no | - | `services/testimonial.service.ts:95` | declared |
| `quote` | `string` | yes | - | `services/testimonial.service.ts:92`<br>`services/testimonial.service.ts:158`<br>`services/testimonial.service.ts:201`<br>+1 more | declared |
| `rejected` | `boolean` | no | `services/testimonial.service.ts:120` | `services/testimonial.service.ts:97` | declared |
| `rejectionReason` | `string` | no | `services/testimonial.service.ts:120` | `services/testimonial.service.ts:98` | declared |
| `reviewedAt` | `?` inferred | - | `services/testimonial.service.ts:120` | - | not in the type |
| `submittedBy` | `'admin' \| 'public'` | no | - | `services/testimonial.service.ts:79`<br>`services/testimonial.service.ts:99` | declared |
| `years` | `string` | yes | - | `services/testimonial.service.ts:93`<br>`services/testimonial.service.ts:159`<br>`services/testimonial.service.ts:202`<br>+1 more | declared |
<!--END-->

`services/testimonial.service.ts:77-81` queries `submittedBy` + `approved` + `orderBy createdAt` -
three fields against a two-field index, so it throws. Public submissions upload an image to Firebase
Storage under `testimonials/**`, which `storage.rules:5-8` leaves readable and writable by anyone.
`phone` is collected (`:95`) and never shown. Two competing `Testimonial` types exist; the chat flow
(`services/chat.service.ts:247`) writes the `types/ai.ts` shape into the same collection.

### fs `timings`

**Declared type:** none.  
**Rule:** `firestore.rules:71`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS timings-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `close` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:116` | not in the type |
| `eveningClose` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:118` | not in the type |
| `eveningOpen` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:117` | not in the type |
| `morningClose` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:116` | not in the type |
| `morningOpen` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:115` | not in the type |
| `open` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:115` | not in the type |
<!--END-->

Read by one file, `lib/ai/retrieval/settings.ts:101-124`, which takes only `snapshot.docs[0]` and
accepts two competing shapes in the same document - `morningOpen`/`morningClose`/`eveningOpen`/
`eveningClose`, or bare `open`/`close` as a fallback (`:115-116`). Nothing writes it; the admin edits
opening hours in `settings/aboutUs` and `settings/<pujaSchedule>` instead, so this collection is
whatever was seeded once. Since 2026-10 the reader returns the flat `morningOpen`...`eveningClose`
shape (it used to nest `morning.open` / `evening.close`), matching `TempleTimings`
(`types/ai-settings.ts:18`) and the Supabase `ai_settings.temple_information.timings` seed
(`supabase/migrations/20261012000001_seed_ai_settings.sql:20`).

### fs `trust`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration (2026-10-18):** **no application code left** - removed 2026-10, see Refresh log. Counted by `scripts/read-firestore-counts.ts:27`, classified `REVIEW` (no destination) in `lib/supabase/migration-inventory.ts:62`.

<!--FIELDS trust-->
_No call site since commit `2891323` (2026-10-14) deleted `lib/ai/firebaseChat.ts`, whose lines 120-125 were the only reader (`name`, and `role` or `position` for the same concept). Nothing ever wrote it._
<!--END-->

The trust committee the admin actually edits is the document `settings/trustCommittee`; with the
stale reader gone, the AI no longer answers trust questions from this separately seeded collection.
The "read, never written" entry for `trust.name/.role/.position` is resolved by removal.

### fs `trustCommittee`

**Declared type:** none.  
**Rule:** `firestore.rules:161`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS trustCommittee-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** The data is in the document `settings/trustCommittee`
(`app/(public)/trust/page.tsx:61`).

### fs `unknown_questions`

**Declared type:** `types/analytics.ts#UnknownQuestion` (`types/analytics.ts:5`) for the Firestore  
document; `types/ai-settings.ts#UnknownQuestion` (`types/ai-settings.ts:163`) for the Supabase row.
**Rule:** `firestore.rules:219`  
**Index:** none  
**Migration (2026-10-18):** **both stores, but Supabase is now the main path.** Firestore keeps one writer, `services/analytics.service.ts:31` (called from `lib/ai/generator.ts:73`), and three readers (`services/analytics.service.ts:75`, `:111`; `app/admin/ai/analytics/page.tsx:321-327`, `:429-433`). Everything else - `lib/ai/unknown-logger.ts`, `services/ai-analytics.service.ts`, both AI-settings repositories - writes and reads the Supabase table (BOT-004, commit `3d0d3b2`).

<!--FIELDS unknown_questions | types/analytics.ts#UnknownQuestion-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `confidence` | `number` | yes | `services/analytics.service.ts:31` (spread) | `app/admin/ai/analytics/page.tsx:445` | declared |
| `createdAt` | `?` inferred | - | - | `app/admin/ai/analytics/page.tsx:474-477` | not in the type; chat-session bleed |
| `detectedIntent` | `string` | yes | `services/analytics.service.ts:31` (spread) | `app/admin/ai/analytics/page.tsx:446`<br>`services/analytics.service.ts:138` | declared |
| `id` | `string` | no | - | - | declared, **no call site**; doc id, not a stored field |
| `language` | `"en" \| "kn" \| "mixed"` | yes | `services/analytics.service.ts:31` (spread) | - | declared |
| `metadata` | `Record<string, unknown>` | no | - | - | declared, **no call site** |
| `processed` | `?` inferred | - | `services/analytics.service.ts:31` | - | not in the type |
| `question` | `string` | yes | `services/analytics.service.ts:31` (spread) | `app/admin/ai/analytics/page.tsx:443-444`<br>`services/analytics.service.ts:36` | declared |
| `reviewed` | `?` inferred | - | **nobody** | `app/admin/ai/analytics/page.tsx:451` | not in the type; always falsy, so every row shows "Pending" |
| `sessionId` | `string` | no | `services/analytics.service.ts:31` (spread) | - | declared |
| `timestamp` | `Date` | yes | `services/analytics.service.ts:31` | `app/admin/ai/analytics/page.tsx:324`<br>`app/admin/ai/analytics/page.tsx:438-439`<br>`services/analytics.service.ts:75-76` | declared |
| `userAgent` | `string` | no | `services/analytics.service.ts:31` (spread, when the caller passes it) | - | declared |
<!--END-->

Refreshed by hand on 2026-10-18. Every snake_case row (`assigned_to`, `detected_intent`,
`last_asked`, `question_lower`, `session_id`, `status`, `times_asked`) and every `lib/ai/*` cell that
used to sit in this table moved to sb `unknown_questions`, and the eight `ai_settings` blocks the
harvester used to file here are gone because `lib/ai/ai-settings/repository.ts` no longer touches
Firestore at all (UNCLEAR entry resolved).

The two shapes are still not the same, and they no longer meet: Firestore gets `question`,
`detectedIntent`, `confidence`, `language`, `sessionId`, `timestamp` and `processed` from one legacy
caller; Supabase gets the snake_case columns plus the triage set from three. The admin triage console
(`lib/ai/ai-settings/admin-repository.ts:302-381`) sees only Supabase, while the AI analytics page's
"unknown questions" panel and its total (`app/admin/ai/analytics/page.tsx:321-327`, `:429-433`) see
only Firestore - fault F-12. Historical Firestore rows reach Supabase only through
`scripts/migrate-ai-analytics.ts:46-65`, which reads both this collection and `ai_unknown_questions`.

### fs `users`

**Declared type:** `types/user.ts#UserProfile` (`types/user.ts:46`); `types/user.ts:74` declares a second, narrower `TempleUser`.  
**Rule:** `firestore.rules:34`  
**Index:** entry 0 `role` + `createdAt`; entry 1 `templeId` + `createdAt`. Neither is used by any query.  
**Migration:** Firestore only; the Supabase `users` table exists with no app code and uses
`display_name`/`phone_number`/`photo_url` where Firestore has `name`/`phone`/`profileImage`.

<!--FIELDS users | types/user.ts#UserProfile-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `services/user.service.ts:25`<br>`services/user.service.ts:48` | not in the type |
| `createdAt` | `Timestamp` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/user.service.ts:64`<br>+2 more | `services/user.service.ts:34`<br>`services/user.service.ts:57` | declared |
| `email` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `app/api/admin/users/set-role/route.ts:64`<br>`services/user.service.ts:29`<br>`services/user.service.ts:52`<br>+1 more | declared |
| `emailVerified` | `boolean` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | - | declared |
| `isActive` | `boolean` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `lib/auth/admin-auth.ts:137`<br>`lib/auth/admin.ts:71` | declared |
| `isApproved` | `boolean` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/auth.service.ts:108`<br>`lib/auth.ts:106` | declared; read only to echo itself forward on re-login, never checked as a gate |
| `lastLogin` | `Timestamp \| null` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | - | declared |
| `name` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/user.service.ts:28`<br>`services/user.service.ts:51` | declared |
| `phone` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/user.service.ts:30`<br>`services/user.service.ts:53` | declared |
| `profileImage` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/auth.service.ts:107`<br>`lib/auth.ts:105` | declared; carried forward on re-login only |
| `role` | `UserRole` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`app/api/admin/users/set-role/route.ts:79`<br>`services/auth.service.ts:57`<br>+4 more | `services/user.service.ts:31`<br>`services/user.service.ts:54`<br>`lib/auth/admin-auth.ts:147`<br>+1 more | declared |
| `templeId` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/auth.service.ts:106`<br>`lib/auth.ts:104` | declared; carried forward on re-login only |
| `uid` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | - | declared |
| `updatedAt` | `Timestamp` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`app/api/admin/users/set-role/route.ts:79`<br>`services/auth.service.ts:57`<br>+6 more | `services/user.service.ts:35`<br>`services/user.service.ts:58` | declared |
<!--END-->

Five separate writers write the same full profile - `app/api/admin/users/create-admin/route.ts:65`,
`services/auth.service.ts:57` and `:96`, `lib/auth.ts:44` and `:94`, `scripts/setup-admin.ts:54` -
so a field added to one of them and not the others produces documents with different shapes.
`uid` is stored inside the document *and* used as the document id. `docs/DATA-MODEL.md:64-67` claims
indexes on `email` (unique), `templeId, role` and `isActive, role`; none of those three exist, and
the two that do exist are unused. The guard at `lib/auth/admin-auth.ts:137` and `lib/auth/admin.ts:71`
reads `isActive`, while `services/user.service.ts:25,48` reads `active` - two names for one flag,
and only `isActive` is ever written. Because both of those read sites default to `true`
(`data.active ?? true`), the admin user list shows every account as active regardless of the stored
value. The login path at `services/auth.service.ts:104-111` (and `lib/auth.ts:102-109`) re-reads the
existing document and echoes `name`, `email`, `phone`, `role`, `templeId`, `profileImage`,
`isApproved` and `isActive` straight back with `{ merge: true }`; that is the only reader those last
three fields have, and nothing anywhere branches on `isApproved`.

### fs `volunteer_requests`

**Declared type:** `types/ai.ts#VolunteerRequest` (`types/ai.ts:71`) - the shape actually written;  
`types/volunteer.ts#VolunteerRequest` (`types/volunteer.ts:34`) is a different, unrelated interface with the same name.
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only; the Supabase `volunteer_requests` table mirrors the *other* shape
(`volunteer_id`, `sex`, `address`), which nothing writes.

<!--FIELDS volunteer_requests | types/ai.ts#VolunteerRequest-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| ~~`approved`~~ | - | - | - | - | **refuted 2026-09-19**: `app/admin/content/page.tsx:98` is a `testimonials` count (`where("approved","==",false)`); `volunteer_requests` is counted unfiltered at `:99`. No such field. |
| `createdAt` | `number` | yes | - | `services/chat.service.ts:280`<br>`services/chat.service.ts:287` | declared |
| `email` | `string` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `phone` | `string` | yes | - | - | declared, **no call site** |
| `preferredDate` | `string` | no | - | - | declared, **no call site** |
| `service` | `string` | yes | - | - | declared, **no call site** |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
| `status` | `"pending" \| "contacted" \| "completed"` | yes | `services/chat.service.ts:297` | - | declared |
<!--END-->

`services/chat.service.ts:271` creates the chat-driven request (`sessionId`, `name`, `phone`,
`email`, `service`, `preferredDate`, `status`, `createdAt`) and `:297` updates `status`.
`app/admin/content/page.tsx:99` counts the collection **unfiltered** - the `where("approved", "==", false)`
one line above at `:98` belongs to `testimonials`, not here, so the pending-volunteer figure is simply
hard-coded `0` at `:114` rather than wrong. With no rule, the client write at `:217` is denied in
production.

### fs `volunteers`

**Declared type:** `types/volunteer.ts#Volunteer` (`types/volunteer.ts:22`)  
**Rule:** `firestore.rules:180`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS volunteers | types/volunteer.ts#Volunteer-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `address` | `string` | yes | - | - | declared, **no call site** |
| `createdAt` | `string` | yes | `services/volunteer.service.ts:111` | `services/volunteer.service.ts:87` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `phone` | `string` | yes | - | - | declared, **no call site** |
| `sex` | `"Male" \| "Female" \| "Other"` | yes | - | - | declared, **no call site** |
| `updatedAt` | `string` | yes | `services/volunteer.service.ts:111`<br>`services/volunteer.service.ts:118` | - | declared |
| `volunteerId` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

Create and update are spreads (`services/volunteer.service.ts:111,118`); the written shape is
`VolunteerRequest` from `types/volunteer.ts:34` plus timestamps. Distinct from `volunteer_requests`,
which the chat writes: `volunteers` is the roster, `volunteer_requests` is the inbox, and no code
promotes one to the other.

## Supabase tables

Columns come from `supabase/migrations/*.sql` (17 files on 2026-10-18, 24 `CREATE TABLE`s - the
2026-09-19 count was 8 files and 21 tables). There are still **no generated Supabase types** -
`supabase gen types` is not wired up - so every `.from(...)` call returns `any` and the mapping to
camelCase is hand-written in each service. The new Prisma schema (`prisma/schema.prisma`, see
"Prisma mirror" below) types nine of these tables, but no application file imports `lib/prisma.ts`,
so it types nothing at runtime.

**Apply path (new since 2026-09-19).** `supabase/config.toml` now exists (project id
`rayaramathaynk`, `supabase/config.toml:3`), and `.github/workflows/supabase-migrations.yml:63-74` runs
a dry-run, `supabase:migrations:push` nd a verifier on CI - but only when someone runs it by hand: its sole trigger is `workflow_dispatch` (`.github/workflows/supabase-migrations.yml:6-7`), and the Prisma drift gate is manual too (`.github/workflows/prisma-baseline-drift-gate.yml:21-22`). Two migrations are pure ledger markers for
versions already recorded on the remote (`supabase/migrations/20261006101759_seed_ai_settings.sql:3-7`,
`supabase/migrations/20261015000000_baseline_raya_ai.sql:3-9`), which is the first in-repo evidence
that migrations have been applied to the live project.

**App code per table, 2026-10-18** (grep for `.from("<table>")` plus the constant-name callers):
nine tables still have a schema and no app code at all - `users`, `profiles`, `donations`,
`donation_campaigns`, `testimonials`, `volunteer_requests`, `gallery_albums`, `gallery_media`,
`aaradhanes` (filled only by `scripts/migrate-content-to-supabase.ts` / `scripts/migrate-all-batched.ts`).
Three are script-only: `daily_poojas`, `seva_bookings`, `settings_documents`. The other twelve have a
live reader or writer in `app/`, `lib/` or `services/`.

The four migration files that were dated after the 2026-09-19 snapshot are no longer in the future;
the newest file is `supabase/migrations/20261015000000_baseline_raya_ai.sql`, three days before today.
A migration created today sorts after every existing file.

**Prisma mirror (added 2026-10-15, commit `2e8f0b1`).** `prisma/schema.prisma` declares `AiSettings`,
`AiKnowledge`, `ChatSession`, `ChatMessage`, `UnknownQuestion`, `AiIntentDistribution`,
`AiLatencyRecord`, `User` and `Profile` (`prisma/schema.prisma:32-265`), each `@@map`ped onto the
Supabase table of the same name with snake_case `@map`s. Its header says it is a transcription of the
SQL migrations, "not the source of truth for the database yet" (`prisma/schema.prisma:3-10`); the
baseline SQL is `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql`. Because nothing in
`app/`, `lib/`, `services/` or `hooks/` imports `lib/prisma.ts` (grep, 0 hits), Prisma is **not** a
third store kind in this catalogue: it is a typed description of nine of the Supabase tables below,
useful as a column reference and as the drift gate (`package.json:10-11`, `prisma:drift`). Where the
Prisma model and a column table here disagree, the SQL wins.

### sb `aaradhanes`

Mirrors Firestore `aaradhane` (and its duplicate `aaradhanes`).

<!--COLUMNS aaradhanes-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `title` | `text` | NOT NULL | - | - |
| `guru_name` | `text` | NOT NULL | - | - |
| `dates` | `text[]` | NOT NULL | `'{}'` | - |
| `description` | `text` | NOT NULL | - | - |
| `significance` | `text` | NOT NULL | - | - |
| `rituals` | `text[]` | NOT NULL | `'{}'` | - |
| `offerings` | `text[]` | NOT NULL | `'{}'` | - |
| `image_url` | `text` | NOT NULL | - | - |
| `seva_details` | `jsonb` | NOT NULL | `'[]'` | - |
| `is_upcoming` | `boolean` | NOT NULL | `false` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_by` | `text` | NOT NULL | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to aaradhanes` (`supabase/migrations/20261001000000_create_content_tables.sql:196`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:176`
<!--END-->

**No app code.** `seva_details` is a `jsonb` array where Firestore stores `AaradhaneSeva[]`; there is
no `updated_at` column, matching the Firestore side missing `updatedAt`.

### sb `ai_intent_distribution`

Mirrors Firestore `ai_intent_distribution`. **Live since 2026-10-13**: the only writer and the service reader.

<!--COLUMNS ai_intent_distribution-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | R `services/ai-analytics.service.ts:395` |
| `firestore_id` | `text` | yes | - | W `lib/supabase/migration-mappers.ts:601` (ETL only) |
| `intent` | `text` | NOT NULL | - | W `services/ai-analytics.service.ts:173`<br>R `services/ai-analytics.service.ts:398` |
| `category` | `text` | yes | - | W `services/ai-analytics.service.ts:174`<br>R `services/ai-analytics.service.ts:399` |
| `language` | `text` | yes | - | W `services/ai-analytics.service.ts:175`<br>R `services/ai-analytics.service.ts:382`<br>`services/ai-analytics.service.ts:400` |
| `confidence` | `numeric(5,2)` | yes | - | W `services/ai-analytics.service.ts:176`<br>R `services/ai-analytics.service.ts:401` |
| `timestamp` | `timestamptz` | yes | `now()` | W `services/ai-analytics.service.ts:179`<br>R `services/ai-analytics.service.ts:375`<br>`services/ai-analytics.service.ts:378`<br>`services/ai-analytics.service.ts:385`<br>`services/ai-analytics.service.ts:402` |
| `session_id` | `text` | yes | - | W `services/ai-analytics.service.ts:177`<br>R `services/ai-analytics.service.ts:396` |
| `message_id` | `text` | yes | - | W `services/ai-analytics.service.ts:178`<br>R `services/ai-analytics.service.ts:397` |

**RLS:** ALL `Deny all public access to ai_intent_distribution` (`supabase/migrations/20260930000000_create_ai_tables.sql:95`)  
**Indexes:** `idx_ai_intent_dist_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:57`  
**Prisma:** `AiIntentDistribution` (`prisma/schema.prisma:173-189`)
<!--END-->

Refreshed by hand on 2026-10-18. Written by `recordIntentDistribution`
(`services/ai-analytics.service.ts:160-189`) and read by `getIntentDistribution` (`:365-410`), both
through `typeof window === 'undefined' ? createAdminClient() : createClient()` (`:169`, `:370`): the
service-role client on the server, the anon client in the browser. Server callers therefore succeed;
any browser caller hits the deny-all policy and gets zero rows (fault F-11). The 2026-09-19 note
("read through the anon client, written by nobody") was wrong even then - the old code inserted here
too - and is withdrawn.

### sb `ai_knowledge`

**New 2026-10-13.** Replaces Firestore `knowledge` as Raya AI's knowledge base (commit `fdaff98`, applied by `scripts/apply-ai-knowledge-migration.mjs`). The admin screens have **not** followed - see fs `knowledge` and fault F-14.

<!--COLUMNS ai_knowledge-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | R `lib/ai/knowledge/repository.ts:29`<br>`lib/ai/knowledge/repository.ts:126` (`getArticleById`) |
| `firestore_id` | `text` | yes | - | W `lib/supabase/migration-mappers.ts:870` (ETL only) |
| `slug` | `text` | NOT NULL | - | W `lib/ai/knowledge/repository.ts:224`<br>`lib/ai/knowledge/repository.ts:265`<br>`scripts/seed-ai-knowledge.ts:97` (upsert key)<br>R `lib/ai/knowledge/repository.ts:30` |
| `title` | `text` | NOT NULL | - | W `lib/ai/knowledge/repository.ts:225`<br>`lib/ai/knowledge/repository.ts:266`<br>`scripts/seed-ai-knowledge.ts:98`<br>R `lib/ai/knowledge/repository.ts:31`<br>`lib/ai/knowledge/repository.ts:74` (order) |
| `kannada_title` | `text` | yes | - | W `lib/ai/knowledge/repository.ts:226`<br>`lib/ai/knowledge/repository.ts:267`<br>R `lib/ai/knowledge/repository.ts:32` |
| `category` | `text` | NOT NULL | `'general'` | W `lib/ai/knowledge/repository.ts:227`<br>`lib/ai/knowledge/repository.ts:268`<br>`scripts/seed-ai-knowledge.ts:99`<br>R `lib/ai/knowledge/repository.ts:33`<br>`lib/ai/knowledge/repository.ts:73` (order) |
| `keywords` | `text[]` | NOT NULL | `'{}'::text[]` | W `lib/ai/knowledge/repository.ts:228`<br>`lib/ai/knowledge/repository.ts:269`<br>`scripts/seed-ai-knowledge.ts:100` (from the seed's `tags`)<br>R `lib/ai/knowledge/repository.ts:34` |
| `content` | `text` | NOT NULL | - | W `lib/ai/knowledge/repository.ts:229`<br>`lib/ai/knowledge/repository.ts:270`<br>`scripts/seed-ai-knowledge.ts:101`<br>R `lib/ai/knowledge/repository.ts:35` |
| `kannada_content` | `text` | yes | - | W `lib/ai/knowledge/repository.ts:230`<br>`lib/ai/knowledge/repository.ts:271`<br>R `lib/ai/knowledge/repository.ts:36` |
| `language` | `text` | NOT NULL | `'en'` | W `lib/ai/knowledge/repository.ts:231`<br>`lib/ai/knowledge/repository.ts:272`<br>`scripts/seed-ai-knowledge.ts:102`<br>R `lib/ai/knowledge/repository.ts:37` |
| `last_reviewed` | `timestamptz` | yes | - | W `lib/ai/knowledge/repository.ts:273`<br>R `lib/ai/knowledge/repository.ts:38` |
| `approved` | `boolean` | NOT NULL | `false` | W `lib/ai/knowledge/repository.ts:232` (always `false`)<br>`lib/ai/knowledge/repository.ts:274`<br>`scripts/seed-ai-knowledge.ts:103` (from the seed's `published`)<br>R `lib/ai/knowledge/repository.ts:39`<br>`lib/ai/knowledge/repository.ts:72`<br>`lib/ai/knowledge/repository.ts:338` |
| `created_at` | `timestamptz` | yes | `now()` | W `scripts/seed-ai-knowledge.ts:104`<br>R `lib/ai/knowledge/repository.ts:40` |
| `updated_at` | `timestamptz` | yes | `now()` | W `scripts/seed-ai-knowledge.ts:105` (trigger otherwise)<br>R `lib/ai/knowledge/repository.ts:41` |

**RLS:** SELECT `Allow public read access to approved articles` (`supabase/migrations/20261013000000_create_ai_knowledge.sql:30`, `USING (approved = true)`); INSERT / UPDATE / DELETE denied to `public` (`:37`, `:43`, `:50`)  
**Indexes:** `idx_ai_knowledge_category(category)`, `idx_ai_knowledge_approved(approved)`, `idx_ai_knowledge_slug(slug)`; `slug` and `firestore_id` are also `UNIQUE`  
**Declared in:** `supabase/migrations/20261013000000_create_ai_knowledge.sql:3`  
**Prisma:** `AiKnowledge` (`prisma/schema.prisma:65-90`)
<!--END-->

The table was harvested as a store (`TABLE_NAME = "ai_knowledge"`, `lib/ai/knowledge/repository.ts:16`)
but `--expand` was not re-run, so this table was written by hand from the CREATE TABLE and the
repository. Every row goes through `rowToArticle` (`:26-50`), which Zod-validates against
`knowledgeArticleSchema` and silently drops a row that fails. The repository picks the service-role
client on the server and the anon client in the browser (`:62`, `:120`, `:218`, `:259`, `:294`, `:332`);
the anon client can read approved rows only, so browser-side `getPendingArticles()` (`:330-357`)
returns nothing. A field the type declares but the table does not have: none - `KnowledgeArticle`
(`lib/ai/knowledge/types.ts:54`) maps one-to-one. The seed writes `approved` from the JSON's
`published` flag and `keywords` from its `tags`, so a seed file without `published: true` lands
invisible to the chatbot.

### sb `ai_latency_records`

Mirrors Firestore `ai_latency_records`. **Live since 2026-10-13**: the only writer and the service reader.

<!--COLUMNS ai_latency_records-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | R `services/ai-analytics.service.ts:344` |
| `firestore_id` | `text` | yes | - | W `lib/supabase/migration-mappers.ts:617` (ETL only) |
| `total_latency` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:137`<br>R `services/ai-analytics.service.ts:346` |
| `intent_detection_time` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:138`<br>R `services/ai-analytics.service.ts:347` |
| `retrieval_time` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:139`<br>R `services/ai-analytics.service.ts:348` |
| `generation_time` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:140`<br>R `services/ai-analytics.service.ts:349` |
| `timestamp` | `timestamptz` | yes | `now()` | W `services/ai-analytics.service.ts:145`<br>R `services/ai-analytics.service.ts:328`<br>`services/ai-analytics.service.ts:331`<br>`services/ai-analytics.service.ts:334`<br>`services/ai-analytics.service.ts:350` |
| `success` | `boolean` | NOT NULL | `true` | W `services/ai-analytics.service.ts:141`<br>R `services/ai-analytics.service.ts:351` |
| `error_type` | `text` | yes | - | W `services/ai-analytics.service.ts:142`<br>R `services/ai-analytics.service.ts:352` |
| `model` | `text` | yes | - | W `services/ai-analytics.service.ts:143` (`(data as any).model`) |
| `session_id` | `text` | yes | - | W `services/ai-analytics.service.ts:144`<br>R `services/ai-analytics.service.ts:345` |

**RLS:** ALL `Deny all public access to ai_latency_records` (`supabase/migrations/20260930000000_create_ai_tables.sql:96`)  
**Indexes:** `idx_ai_latency_records_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:70`  
**Prisma:** `AiLatencyRecord` (`prisma/schema.prisma:191-210`)
<!--END-->

Refreshed by hand on 2026-10-18. Written by `recordLatency` (`services/ai-analytics.service.ts:124-155`)
and read by `getLatencyMetrics` (`:318-360`), with the same server-admin / browser-anon client switch
(`:133`, `:322`) as `ai_intent_distribution`. `message_id` and `intent` have no column; the type now
says so (`types/ai-analytics.ts:30,36`) and the ETL spec excludes both explicitly
(`lib/supabase/migration-mappers.ts:511-530`). `model` is written through an `as any` cast because
`LatencyRecord` does not declare it.

### sb `ai_settings`

**New 2026-10-12.** Replaces the Firestore document `ai_settings/main` (BOT-001, commit `fae5d51`). One row, `id = 'main'`, one `jsonb` column per settings block.

<!--COLUMNS ai_settings-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `text` | NOT NULL (PK) | `'main'` | R `lib/ai/ai-settings/repository.ts:45`<br>`lib/ai/ai-settings/admin-repository.ts:44` |
| `general` | `jsonb` | NOT NULL | `'{}'::jsonb` | W `lib/ai/ai-settings/repository.ts:106-119`<br>`lib/ai/ai-settings/admin-repository.ts:108-121`<br>R `lib/ai/ai-settings/repository.ts:56`<br>`lib/ai/ai-settings/admin-repository.ts:55` |
| `safety` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`<br>R `lib/ai/ai-settings/repository.ts:57`<br>`lib/ai/ai-settings/admin-repository.ts:56` |
| `extended_behavior` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`<br>R `lib/ai/ai-settings/repository.ts:58` |
| `temple_information` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:137`<br>R `lib/ai/ai-settings/repository.ts:59` |
| `visitor_information` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:138`<br>R `lib/ai/ai-settings/repository.ts:60` |
| `temple_policies` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:139`<br>R `lib/ai/ai-settings/repository.ts:61` |
| `ai_responses` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:140`<br>R `lib/ai/ai-settings/repository.ts:62` |
| `ai_behavior` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:141`<br>R `lib/ai/ai-settings/repository.ts:63` |
| `prompt` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:142`<br>`lib/ai/ai-settings/admin-repository.ts:131-139`<br>R `lib/ai/ai-settings/repository.ts:64` |
| `intents` | `jsonb` | NOT NULL | `'{}'::jsonb` | W as `general`, plus `lib/ai/ai-settings/repository.ts:143`<br>R `lib/ai/ai-settings/repository.ts:65` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | trigger `update_ai_settings_updated_at`<br>R `lib/ai/ai-settings/repository.ts:66` |
| `updated_by` | `text` | yes | - | W `lib/ai/ai-settings/repository.ts:131`<br>`app/api/seed-ai-settings/route.ts:95`<br>R `lib/ai/ai-settings/repository.ts:67` |
| `version` | `integer` | yes | `1` | - (never incremented) |

**RLS:** ALL `Deny all public access to ai_settings` (`supabase/migrations/20261012000000_create_ai_settings_table.sql:31`)  
**Indexes:** primary key only  
**Declared in:** `supabase/migrations/20261012000000_create_ai_settings_table.sql:3`; seeded by `supabase/migrations/20261012000001_seed_ai_settings.sql:3-27` (`ON CONFLICT (id) DO NOTHING`)  
**Prisma:** `AiSettings` (`prisma/schema.prisma:32-58`)
<!--END-->

Written by hand on 2026-10-18 from the CREATE TABLE and the two repositories. Other writers: the
admin "seed / repair" route `app/api/seed-ai-settings/route.ts:67-174` (inserts the default row, or
patches only the missing jsonb sections, `:76-96` and `:144-147`) and the CLI
`scripts/seed-ai-settings-supabase.ts:24-26` (`upsert ... ignoreDuplicates`). Every read goes through
`AISettingsSchema.safeParse` (`lib/ai/ai-settings/repository.ts:70`); a row that fails validation
makes `getSettings()` return `null`, which callers treat as "no settings" and may overwrite with
defaults (`createPromptVersion`, `:216-220`).

The camelCase type is `types/ai-settings.ts#AISettings` (`types/ai-settings.ts:340`). The table is
deny-all, and `lib/ai/ai-settings/repository.ts:35-37` falls back to the anon client in the browser,
so any client-side settings read returns `null` (fault F-11). `version` is declared, defaulted and
never written: optimistic concurrency was planned and not built.

### sb `chat_messages`

Mirrors Firestore `messages` (not the empty Firestore `chat_messages`). **Live since 2026-10-06** (commit `224875d`): `saveMessage` and `getSessionMessages` in `services/chat.service.ts` read and write it.

<!--COLUMNS chat_messages-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | W `services/chat.service.ts:110` (holds the client message id)<br>R `services/chat.service.ts:158` (returned as `AIMessage.id`) |
| `session_id` | `text` | NOT NULL | - | W `services/chat.service.ts:111`<br>R `services/chat.service.ts:150` |
| `role` | `text` | NOT NULL | - | W `services/chat.service.ts:112`<br>R `services/chat.service.ts:159` |
| `content` | `text` | NOT NULL | - | W `services/chat.service.ts:113`<br>R `services/chat.service.ts:160` |
| `timestamp` | `timestamptz` | NOT NULL | - | W `services/chat.service.ts:114`<br>R `services/chat.service.ts:151`<br>`services/chat.service.ts:161` |
| `model` | `text` | yes | - | W `services/chat.service.ts:115`<br>R `services/chat.service.ts:162` |
| `latency` | `numeric(10,2)` | yes | - | W `services/chat.service.ts:116`<br>R `services/chat.service.ts:163` |
| `detected_language` | `text` | yes | - | W `services/chat.service.ts:117`<br>R `services/chat.service.ts:164` |

**RLS:** ALL `Deny all public access to chat_messages` (`supabase/migrations/20260930000000_create_ai_tables.sql:93`)  
**Indexes:** `idx_chat_messages_session_id(session_id)`, `idx_chat_messages_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:22`  
**Prisma:** `ChatMessage` (`prisma/schema.prisma:117-141`)
<!--END-->

Refreshed by hand on 2026-10-18 (the harvested `timestamp` reads at `services/ai-analytics.service.ts:636-637`
belong to the Firestore collection of the same name). `session_id` is `text` holding
`chat_sessions.firestore_id`, not a foreign key to `chat_sessions.id uuid`; the Prisma model records
that the database has no constraint (`prisma/schema.prisma:122-127`).

**Fault F-11.** Both functions use `createClient()` from `lib/supabase/client.ts`, the browser
**anon** client, unconditionally (`services/chat.service.ts:107`, `:145`), and their only caller
is the client component `components/ai/AIChatProvider.tsx:113`, `:124`. Against the deny-all policy
the insert fails and the select returns no rows. `saveToFirebase` swallows the error on purpose
(`components/ai/AIChatProvider.tsx:114-117`), so chat history silently stops persisting in any
project where RLS is on.

### sb `chat_sessions`

Mirrors Firestore `chat_sessions` - but only the summary half (see fs `chat_sessions`). **Live since 2026-10-06** (commit `224875d`).

<!--COLUMNS chat_sessions-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | W `services/chat.service.ts:12` (`crypto.randomUUID()`, `:9`)<br>`services/chat.service.ts:134`<br>R `services/chat.service.ts:40`<br>`services/chat.service.ts:53`<br>`services/chat.service.ts:63`<br>`services/chat.service.ts:91` |
| `user_id` | `text` | yes | - | W `services/chat.service.ts:13`<br>`services/chat.service.ts:32`<br>`services/chat.service.ts:135`<br>R `services/chat.service.ts:64`<br>`services/chat.service.ts:82`<br>`services/chat.service.ts:92` |
| `message_count` | `integer` | NOT NULL | `0` | W `services/chat.service.ts:14`<br>`services/chat.service.ts:33`<br>`services/chat.service.ts:136`<br>R `services/chat.service.ts:67`<br>`services/chat.service.ts:95` |
| `last_message` | `text` | yes | - | W `services/chat.service.ts:15`<br>`services/chat.service.ts:34`<br>`services/chat.service.ts:137`<br>R `services/chat.service.ts:68`<br>`services/chat.service.ts:96` |
| `detected_language` | `text` | yes | - | W `services/chat.service.ts:35`<br>R `services/chat.service.ts:69`<br>`services/chat.service.ts:97` |
| `created_at` | `timestamptz` | yes | `now()` | R `services/chat.service.ts:65`<br>`services/chat.service.ts:93` |
| `updated_at` | `timestamptz` | yes | `now()` | trigger `update_chat_sessions_updated_at`<br>R `services/chat.service.ts:66`<br>`services/chat.service.ts:83`<br>`services/chat.service.ts:94` |

**RLS:** ALL `Deny all public access to chat_sessions` (`supabase/migrations/20260930000000_create_ai_tables.sql:92`)  
**Indexes:** `idx_chat_sessions_user_id(user_id)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:4`  
**Prisma:** `ChatSession` (`prisma/schema.prisma:97-115`)
<!--END-->

Refreshed by hand on 2026-10-18. The 2026-09-19 note claiming `message_count` was "absent from the
CREATE TABLE" was wrong (`supabase/migrations/20260930000000_create_ai_tables.sql:8`) and is
withdrawn. The embedded `messages` array, `lastIntent`, `lastTopic` and `preferredLanguage` that
`services/conversation.service.ts:161` writes still have no column here, and the ETL drops them on
purpose (`lib/supabase/migration-mappers.ts:425-446`, `intentionallyExcluded`). `saveMessage` creates
a session row on the fly when none exists (`services/chat.service.ts:131-138`). All access is through
the anon client, so the deny-all policy blocks it - fault F-11.

### sb `daily_poojas`

Mirrors Firestore `dailyPoojas`.

<!--COLUMNS daily_poojas-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | R `scripts/migrate-daily-poojas.ts:140` |
| `title` | `text` | NOT NULL | - | - |
| `description` | `text` | NOT NULL | - | - |
| `start_time` | `text` | NOT NULL | - | - |
| `duration` | `text` | NOT NULL | - | - |
| `category` | `text` | NOT NULL | - | - |
| `seva_amount` | `numeric(10,2)` | NOT NULL | `0` | - |
| `is_active` | `boolean` | NOT NULL | `true` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `days` | `text[]` | NOT NULL | - | - |
| `notes` | `text` | yes | - | - |
| `created_by` | `text` | yes | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to daily_poojas` (`supabase/migrations/20260907112632_create_core_tables.sql:92`)  
**Indexes:** `idx_daily_poojas_display_order_is_active(display_order, is_active)`  
**Declared in:** `supabase/migrations/20260907112632_create_core_tables.sql:35`
<!--END-->

Populated by `scripts/migrate-daily-poojas.ts:111-140` and read by nothing - a grep for
`from("daily_poojas")` over `app/ services/ lib/` returns nothing. No `updated_at` column. The only
reader anywhere is the mobile app (`apps/mobile/lib/api.ts:26-35`, anon key, deny-all - fault F-22).

### sb `donation_campaigns`

Mirrors Firestore `donation_campaigns`.

<!--COLUMNS donation_campaigns-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `title` | `text` | NOT NULL | - | R `services/donationCampaign.service.ts:39` |
| `description` | `text` | NOT NULL | - | R `services/donationCampaign.service.ts:41` |
| `image_url` | `text` | NOT NULL | - | - |
| `suggested_amount` | `numeric(10,2)` | NOT NULL | - | - |
| `active` | `boolean` | NOT NULL | `true` | R `services/donationCampaign.service.ts:49` |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to donation_campaigns` (`supabase/migrations/20261001000000_create_content_tables.sql:78`)  
**Indexes:** `idx_donation_campaigns_display_order(display_order)`  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:61`
<!--END-->

**No app code.**

### sb `donations`

Mirrors Firestore `donations`.

<!--COLUMNS donations-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `donor_name` | `text` | NOT NULL | - | - |
| `email` | `text` | NOT NULL | - | R `app/admin/page.tsx:177`<br>`app/api/public/stats/route.ts:58`<br>`services/donation.service.ts:18` |
| `phone` | `text` | NOT NULL | - | R `app/admin/page.tsx:178`<br>`app/api/public/stats/route.ts:59`<br>`services/donation.service.ts:19` |
| `address` | `text` | NOT NULL | - | R `services/donation.service.ts:20` |
| `amount` | `numeric(10,2)` | NOT NULL | - | R `app/admin/page.tsx:179`<br>`services/donation.service.ts:21`<br>`hooks/useDonationNotifications.ts:52` |
| `purpose` | `text` | NOT NULL | - | R `services/donation.service.ts:22`<br>`hooks/useDonationNotifications.ts:53` |
| `campaign_id` | `text` (was `uuid`, widened 2026-10-02 by `supabase/migrations/20261002000000_align_content_firestore_ids.sql:27-28`) | yes | - | - |
| `message` | `text` | NOT NULL | - | R `services/donation.service.ts:24` |
| `payment_mode` | `text` | NOT NULL | - | - |
| `status` | `text` | NOT NULL | - | W `services/donation.service.ts:39`<br>`services/donation.service.ts:68`<br>R `app/admin/page.tsx:172`<br>`app/api/public/stats/route.ts:52`<br>`services/donation.service.ts:26` |
| `receipt_number` | `text` | NOT NULL | - | - |
| `admin_remarks` | `text` | NOT NULL | - | - |
| `collected_by` | `text` | NOT NULL | - | - |
| `collected_at` | `timestamptz` | yes | - | - |

**RLS:** ALL `Deny all public access to donations` (`supabase/migrations/20261001000000_create_content_tables.sql:104`)  
**Indexes:** `idx_donations_campaign_id(campaign_id)` (`supabase/migrations/20261002000000_align_content_firestore_ids.sql:44`)  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:83`
<!--END-->

**No app code.** `campaign_id` was a real `uuid` while Firestore stores a loose string
`campaignId` (`types/donation.ts:24`); since 2026-10-02 it is `text` holding the Firestore id verbatim
(`supabase/migrations/20261002000000_align_content_firestore_ids.sql:18-29`), so the ETL no longer has
to resolve campaign ids first - the 2026-09-19 blocker is FIXED (2026-10-18). There is no
`created_at`/`updated_at` pair, although `DonationRecord` declares both.

### sb `events`

Mirrors Firestore `events`. **The one content table the app genuinely uses.**

<!--COLUMNS events-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | R `services/event.service.ts:58`<br>`services/event.service.ts:114`<br>`services/event.service.ts:123` |
| `title` | `text` | NOT NULL | - | R `services/daily-spiritual.service.ts:314`<br>`services/daily-spiritual.service.ts:356`<br>`lib/aaradhane/firestore-admin.ts:55`<br>+9 more |
| `description` | `text` | yes (NOT NULL dropped by `supabase/migrations/20261011000000_alter_events_nullable.sql:4`) | - | R `services/daily-spiritual.service.ts:315`<br>`services/daily-spiritual.service.ts:357`<br>`lib/ai/retrieval/events.ts:42` |
| `location` | `text` | yes (NOT NULL dropped by `supabase/migrations/20261011000000_alter_events_nullable.sql:5`) | - | R `lib/ai/retrieval/events.ts:47` |
| `start_date` | `timestamptz` | NOT NULL | - | - |
| `end_date` | `timestamptz` | NOT NULL | - | - |
| `start_time` | `text` | yes | - | - |
| `end_time` | `text` | yes | - | - |
| `featured` | `boolean` | NOT NULL | `false` | R `services/daily-spiritual.service.ts:294`<br>`lib/ai/retrieval/events.ts:48` |
| `published` | `boolean` | NOT NULL | `false` | R `services/daily-spiritual.service.ts:295`<br>`services/daily-spiritual.service.ts:332`<br>`lib/ai/retrieval/events.ts:67`<br>+1 more |
| `category` | `text` | yes | - | R `services/daily-spiritual.service.ts:320`<br>`services/daily-spiritual.service.ts:362`<br>`lib/aaradhane/firestore-admin.ts:36`<br>+4 more |
| `image_url` | `text` | yes | - | - |
| `status` | `text` | yes (NOT NULL dropped by `supabase/migrations/20261011000000_alter_events_nullable.sql:6`) | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to events` (`supabase/migrations/20260907112632_create_core_tables.sql:98`)  
**Indexes:** `idx_events_start_date(start_date)`, `idx_events_featured_published(featured, published)`  
**Declared in:** `supabase/migrations/20260907112632_create_core_tables.sql:53`
<!--END-->

`services/event.service.ts:46,58,90,114,123` reads *and* writes this table through the **anon**
client while RLS is deny-all (`supabase/migrations/20260907112632_create_core_tables.sql:98`), so
every call fails unless RLS was disabled by hand in the live project. The mapper is
`mapSupabaseEventToTempleEvent` (`services/event.service.ts:21`). The four generator fields
(`autoGenerated`, `guru`, `year`, `raghavendraPhase`) have no column. Since 2026-09-28 the staged
ETL also upserts here (`scripts/migrate-staged-phase1.ts:329`, mapper `mapEvent` at
`lib/supabase/migration-mappers.ts:760`, which falls back `featured` / `published` to `false` -
commit `1380104`), and on 2026-10-11 `description`, `location` and `status` became nullable
(`supabase/migrations/20261011000000_alter_events_nullable.sql:3-6`) so legacy events without them
load. The harvest files `templeName`, `contactEmail`, `facebook` and other `settings` field names
under `events` because `scripts/migrate-staged-phase1.ts` touches both; they are not event columns.

### sb `gallery_albums`

Mirrors Firestore `galleryAlbums`.

<!--COLUMNS gallery_albums-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `title` | `text` | NOT NULL | - | - |
| `slug` | `text` | NOT NULL | - | - |
| `description` | `text` | NOT NULL | - | - |
| `cover_image` | `text` | NOT NULL | - | - |
| `active` | `boolean` | NOT NULL | `true` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to gallery_albums` (`supabase/migrations/20261001000000_create_content_tables.sql:125`)  
**Indexes:** `idx_gallery_albums_display_order(display_order)`  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:108`
<!--END-->

**No app code** in the web app. The mobile app reads it with an embedded `gallery_media(*)` (`apps/mobile/lib/api.ts:37-45`), which cannot work without a foreign key (fault F-22).

### sb `gallery_media`

Mirrors Firestore `galleryMedia`.

<!--COLUMNS gallery_media-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `album_id` | `text` (was `uuid`, widened 2026-10-02 by `supabase/migrations/20261002000000_align_content_firestore_ids.sql:38-39`) | yes | - | - |
| `title` | `text` | NOT NULL | - | - |
| `description` | `text` | NOT NULL | - | - |
| `category` | `text` | NOT NULL | - | - |
| `type` | `text` | NOT NULL | - | - |
| `image_path` | `text` | NOT NULL | - | - |
| `video_url` | `text` | yes | - | - |
| `alt_text` | `text` | NOT NULL | - | - |
| `is_featured` | `boolean` | NOT NULL | `false` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `tags` | `text[]` | NOT NULL | `'{}'` | - |
| `uploaded_by` | `text` | NOT NULL | - | - |
| `uploaded_at` | `timestamptz` | yes | - | - |

**RLS:** ALL `Deny all public access to gallery_media` (`supabase/migrations/20261001000000_create_content_tables.sql:150`)  
**Indexes:** `idx_gallery_media_album_id(album_id)` (`supabase/migrations/20261002000000_align_content_firestore_ids.sql:45`)  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:130`
<!--END-->

**No app code.** `album_id` was a `uuid` while Firestore stores a document-id string; since
2026-10-02 it is `text` (`supabase/migrations/20261002000000_align_content_firestore_ids.sql:31-40`) and
there is no foreign key to `gallery_albums` at all, so PostgREST cannot embed one in the other (the
mobile app tries - see Portability). `image_path` and `alt_text` match the *type*, not what the admin UI
reads (`url`, `caption`) - see the `galleryMedia` note above.

### sb `profiles`

Mirrors Firestore `profiles` plus the whole `bookmarks` collection.

<!--COLUMNS profiles-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `uid` | `text` | NOT NULL | - | - |
| `name` | `text` | NOT NULL | - | - |
| `email` | `text` | NOT NULL | - | R `services/profile.service.ts:111` |
| `phone` | `text` | yes | - | - |
| `profile_image` | `text` | yes | - | - |
| `bio` | `text` | yes | - | - |
| `gotra` | `text` | yes | - | - |
| `nakshatra` | `text` | yes | - | - |
| `preferences` | `jsonb` | NOT NULL | `'{}'` | R `services/profile.service.ts:114`<br>`services/profile.service.ts:115` |
| `favorites` | `text[]` | NOT NULL | `'{}'` | W `services/profile.service.ts:269`<br>`services/profile.service.ts:290` |
| `recently_viewed` | `text[]` | NOT NULL | `'{}'` | - |
| `bookmarks` | `jsonb` | NOT NULL | `'[]'` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to profiles` (`supabase/migrations/20261001000000_create_content_tables.sql:57`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:34`
<!--END-->

**No app code.** This is the only table that folds an entire Firestore collection (`bookmarks`) into
a `jsonb` column.

### sb `seva_bookings`

Mirrors Firestore `sevaBookings`. **Script-populated since 2026-09-21** (commits `549dfed`, `d71898d`); still no reader or writer in the running app.

<!--COLUMNS seva_bookings-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | W `scripts/migrate-seva-bookings-to-supabase.ts:94` (upsert key, `:146`) |
| `seva_id` | `text` (was `uuid`, widened by `supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql:23-24`) | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:95` |
| `seva_title` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:96` |
| `seva_amount` | `numeric(10,2)` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:97` |
| `user_id` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:98` |
| `user_name` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:99` |
| `user_email` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:100` |
| `user_phone` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:101` |
| `gotra` | `text` | yes | - | W `scripts/migrate-seva-bookings-to-supabase.ts:102` |
| `nakshatra` | `text` | yes | - | W `scripts/migrate-seva-bookings-to-supabase.ts:103` |
| `raashi` | `text` | yes | - | W `scripts/migrate-seva-bookings-to-supabase.ts:104` |
| `preferred_date` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:105` |
| `notes` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:106` |
| `status` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:107` |
| `payment_reference` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:110` (`""` when absent) |
| `payment_status` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:111` (`"pending"` when absent) |
| `payment_date` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:112` |
| `payment_method` | `text` | NOT NULL | - | W `scripts/migrate-seva-bookings-to-supabase.ts:113` |
| `created_at` | `timestamptz` | yes | `now()` | W `scripts/migrate-seva-bookings-to-supabase.ts:114` |
| `updated_at` | `timestamptz` | yes | `now()` | W `scripts/migrate-seva-bookings-to-supabase.ts:115` |

**RLS:** ALL `Deny all public access to seva_bookings` (`supabase/migrations/20260920000000_create_seva_bookings.sql:40`; re-asserted idempotently at `supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql:44`)  
**Indexes:** `seva_bookings_firestore_id_key(firestore_id)` UNIQUE (`supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql:53`)  
**Declared in:** `supabase/migrations/20260920000000_create_seva_bookings.sql:6`
<!--END-->

Refreshed by hand on 2026-10-18 (the harvester parses `CREATE TABLE` but not `ALTER COLUMN ... TYPE`,
so `.claude/state/inventory/fields.json` still reports `seva_id uuid`). The 2026-09-19 blocker - "`seva_id` is `uuid NOT NULL`
while Firestore stores a document-id string" - is **FIXED (2026-10-18)** by the widening migration
(commit `d71898d`), and the ETL now exists: `scripts/migrate-seva-bookings-to-supabase.ts:60-116` maps
the Firestore camelCase fields one-to-one (validating `notes` and `status` as required, `:90-91`),
upserts on `firestore_id` (`:145-146`) and reconciles counts by reading the table back (`:169`). The
batched runner maps the same collection with `mapSevaBooking` (`scripts/migrate-all-batched.ts:117`).
Still no index on `user_id`, although the Firestore query pattern is "bookings by user", and
`services/sevaBooking.service.ts` still reads and writes only Firestore.

### sb `sevas`

Mirrors Firestore `sevas`. **The read side of the seva split brain.**

<!--COLUMNS sevas-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | R `app/actions/sevas.ts:13`<br>`scripts/migrate-sevas.ts:143` |
| `name` | `text` | NOT NULL | - | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/api/admin/receipt-sevas/route.ts:35`<br>`lib/ai/retrieval/sevas.ts:102`<br>`lib/receipt/admin.ts:91`<br>+4 more |
| `description` | `text` | NOT NULL | - | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/api/admin/receipt-sevas/route.ts:36`<br>`lib/ai/retrieval/sevas.ts:103`<br>`scripts/migrate-sevas.ts:67`<br>+1 more |
| `category` | `text` | NOT NULL | - | W `app/api/admin/receipt-sevas/route.ts:75`<br>R `lib/ai/retrieval/sevas.ts:104`<br>`scripts/migrate-sevas.ts:68`<br>`scripts/migrate-sevas.ts:80` |
| `amount` | `numeric(10,2)` | NOT NULL | - | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/api/admin/receipt-sevas/route.ts:37`<br>`lib/ai/retrieval/sevas.ts:105`<br>`lib/receipt/admin.ts:94`<br>+2 more |
| `duration` | `integer` | NOT NULL | - | W `app/api/admin/receipt-sevas/route.ts:75`<br>R `lib/ai/retrieval/sevas.ts:106`<br>`scripts/migrate-sevas.ts:70`<br>`scripts/migrate-sevas.ts:82` |
| `image_url` | `text` | yes | - | - |
| `active` | `boolean` | NOT NULL | `true` | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/admin/content/page.tsx:92`<br>`app/api/admin/receipt-sevas/route.ts:38`<br>`lib/ai/retrieval/sevas.ts:126`<br>+3 more |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to sevas` (`supabase/migrations/20260907112632_create_core_tables.sql:86`); ALL `Deny all public access to sevas` (`supabase/migrations/20260908120000_create_sevas_table.sql:43`)  
**Indexes:** `idx_sevas_display_order_active(display_order, active)`, `idx_sevas_display_order_active(display_order, active)`  
**Declared in:** `supabase/migrations/20260907112632_create_core_tables.sql:13`, `supabase/migrations/20260908120000_create_sevas_table.sql:18`
<!--END-->

Read by `app/actions/sevas.ts:6,13` through the **service-role** client, which bypasses the deny-all
RLS policy - that is why this one path works. Written only by `scripts/migrate-sevas.ts:115-120` and
`scripts/seed-supabase-sevas.ts:150`. Declared twice, at
`supabase/migrations/20260907112632_create_core_tables.sql:13` and
`supabase/migrations/20260908120000_create_sevas_table.sql:18`, both with `IF NOT EXISTS`, so the
second is a no-op.

### sb `settings_documents`

**New 2026-09-22.** A lossless JSONB container for the Firestore `settings/*` documents that have no relational shape (`financeSettings`, `poojaSchedule`, `festivalCalendar`, `aboutUs`, `trustCommittee`, `guruParampara`, per the header at `supabase/migrations/20260922000000_create_settings_documents.sql:3-13`). Script-populated only.

<!--COLUMNS settings_documents-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | W `lib/supabase/migration-mappers.ts:842` (upsert key in `scripts/migrate-settings.ts:176`, `scripts/migrate-staged-phase1.ts:377`) |
| `document_key` | `text` | NOT NULL | - | W `lib/supabase/migration-mappers.ts:843` (= the Firestore doc id) |
| `data` | `jsonb` | NOT NULL | - | W `lib/supabase/migration-mappers.ts:844` (the whole document, `toJsonSafe`) |
| `source_field_count` | `integer` | yes | - | W `lib/supabase/migration-mappers.ts:845` |
| `created_at` | `timestamptz` | yes | - | W `lib/supabase/migration-mappers.ts:848` (only when the source has `createdAt`) |
| `updated_at` | `timestamptz` | yes | - | W `lib/supabase/migration-mappers.ts:849` (only when the source has `updatedAt`) |

**RLS:** ALL `Deny all public access to settings_documents` (`supabase/migrations/20260922000000_create_settings_documents.sql:39-43`)  
**Indexes:** `settings_documents_document_key_key(document_key)` UNIQUE, `idx_settings_documents_updated_at(updated_at DESC)` (`supabase/migrations/20260922000000_create_settings_documents.sql:47-51`)  
**Declared in:** `supabase/migrations/20260922000000_create_settings_documents.sql:17`
<!--END-->

Written by hand on 2026-10-18; the harvester never sees this table because both writers pass the
table name through a loop variable (`scripts/migrate-settings.ts:138-140`,
`scripts/migrate-staged-phase1.ts:326-329`). Routing rule: a `settings` document carrying both
`templeName` and `contactEmail` goes to `site_settings` (`lib/supabase/migration-mappers.ts:824-831`,
`isSiteSettingsDoc`), the `socialLinks` document goes to `social_links`, and **everything else** lands
here verbatim (`scripts/migrate-settings.ts:95-129`). The batched runner also routes Firestore
`homepage` here (`scripts/migrate-all-batched.ts:125`). No application code reads it: the admin
settings pages still read and write Firestore `settings/<docId>`, so this table is a backup copy, not a
replacement. The field lists of the eleven `settings/*` documents in the fs `settings` subsection
above are therefore also the field lists of the JSON blobs here.

### sb `site_settings`

Replaces part of the Firestore `settings/*` family.

<!--COLUMNS site_settings-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | R `services/settings.service.ts:58`<br>W filter `app/actions/settings.ts:111` (must be a uuid, `:84-87`) |
| `firestore_id` | `text` | yes | - | W `scripts/migrate-settings.ts:176` / `scripts/migrate-staged-phase1.ts:377` (ETL upsert key) |
| `temple_name` | `text` | NOT NULL | `'Sri Raghavendra Swamy Temple'` | W `app/actions/settings.ts:55`<br>`app/actions/settings.ts:101`<br>R `services/settings.service.ts:59` |
| `contact_email` | `text` | NOT NULL | `'info@example.com'` | W `app/actions/settings.ts:56`<br>`app/actions/settings.ts:102`<br>R `services/settings.service.ts:60` |
| `contact_phone` | `text` | NOT NULL | `''` | W `app/actions/settings.ts:57`<br>`app/actions/settings.ts:103`<br>R `services/settings.service.ts:61` |
| `address` | `text` | NOT NULL | `''` | W `app/actions/settings.ts:58`<br>`app/actions/settings.ts:104`<br>R `services/settings.service.ts:62` |
| `footer_text` | `text` | yes | - | W `app/actions/settings.ts:59`<br>`app/actions/settings.ts:105`<br>R `services/settings.service.ts:63` |
| `welcome_message` | `text` | yes | - | W `app/actions/settings.ts:60`<br>`app/actions/settings.ts:106`<br>R `services/settings.service.ts:64` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | R `services/settings.service.ts:45`<br>`services/settings.service.ts:65` |

**RLS:** SELECT `Allow public read access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:57`); INSERT `Deny all public write access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:70`); UPDATE `Deny all public update access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:76`); DELETE `Deny all public delete access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:82`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261010000000_create_settings.sql:4`
<!--END-->

One of only four tables with a **public SELECT** policy (with `social_links`, `temple_areas` and,
new, `ai_knowledge`). Read with the anon client at `services/settings.service.ts:41-47`. The
writes moved on 2026-10 from the service into the server actions `createSettingsAction` /
`updateSettingsAction` (`app/actions/settings.ts:38-71`, `:73-117`); `services/settings.service.ts:69-77`
now only forwards to them. The actions Zod-validate the payload (`app/actions/settings.ts:10-20`), coerce
the four optional strings to `""` on insert, reject a non-uuid `id`, and gate on
`checkAdminAuth` + `isUserAdmin` (`:26-36`). It still covers six fields; the Firestore `settings`
collection carries around ninety. The rest now lands in `settings_documents` as raw JSON (see below).

### sb `social_links`

Replaces the Firestore document `settings/socialLinks`.

<!--COLUMNS social_links-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `facebook` | `text` | yes | - | R `services/settings.service.ts:99` |
| `instagram` | `text` | yes | - | R `services/settings.service.ts:100` |
| `youtube` | `text` | yes | - | R `services/settings.service.ts:101` |
| `whatsapp` | `text` | yes | - | R `services/settings.service.ts:102` |
| `twitter` | `text` | yes | - | R `services/settings.service.ts:103` |
| `linkedin` | `text` | yes | - | R `services/settings.service.ts:104` |
| `map_url` | `text` | yes | - | R `services/settings.service.ts:105` |
| `show_facebook` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:106` |
| `show_instagram` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:107` |
| `show_youtube` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:108` |
| `show_whatsapp` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:109` |
| `show_twitter` | `boolean` | NOT NULL | `false` | R `services/settings.service.ts:110` |
| `show_linkedin` | `boolean` | NOT NULL | `false` | R `services/settings.service.ts:111` |
| `show_map` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:112` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | R `services/settings.service.ts:85` |

**RLS:** SELECT `Allow public read access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:63`); INSERT `Deny all public write access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:88`); UPDATE `Deny all public update access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:94`); DELETE `Deny all public delete access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:100`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261010000000_create_settings.sql:24`
<!--END-->

**The second split brain.** Public SELECT is allowed; INSERT, UPDATE and DELETE are denied. The site
reads this table (`services/settings.service.ts:83-112`), the admin editor writes Firestore
`settings/socialLinks` (`app/admin/settings/social-links/page.tsx:88`), and the only writer of the
table anywhere in the repo is the settings ETL - `scripts/migrate-settings.ts:138-176` and, since
2026-09-28, `scripts/migrate-staged-phase1.ts:326-377` (both upsert on `firestore_id` through a loop
variable, which is why the harvester shows no `W` here). Editing social links in the
admin therefore has no visible effect, and `services/settings.service.ts:93,96` returns
`defaultSocialLinks` on both error and empty, which hides the failure.

### sb `temple_areas`

The only domain that is Supabase-only and actually working.

<!--COLUMNS temple_areas-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `UUID` | yes | `gen_random_uuid()` | W `services/temple-areas.supabase.service.ts:103` (a slug, not a uuid) |
| `firestore_id` | `TEXT` | yes | - | W `scripts/seed-temple-areas.ts:37` |
| `name` | `TEXT` | NOT NULL | - | W `services/temple-areas.supabase.service.ts:104`<br>`services/temple-areas.supabase.service.ts:131`<br>R `services/temple-areas.supabase.service.ts:172` |
| `name_kannada` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:105`<br>`services/temple-areas.supabase.service.ts:132`<br>R `services/temple-areas.supabase.service.ts:173` |
| `description` | `TEXT` | NOT NULL | - | W `services/temple-areas.supabase.service.ts:106`<br>`services/temple-areas.supabase.service.ts:133`<br>R `services/temple-areas.supabase.service.ts:174` |
| `significance` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:107`<br>`services/temple-areas.supabase.service.ts:134`<br>R `services/temple-areas.supabase.service.ts:175` |
| `icon` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:108`<br>`services/temple-areas.supabase.service.ts:135`<br>R `services/temple-areas.supabase.service.ts:176` |
| `category` | `TEXT` | NOT NULL | - | W `services/temple-areas.supabase.service.ts:110`<br>`services/temple-areas.supabase.service.ts:137`<br>R `services/temple-areas.supabase.service.ts:178` |
| `features` | `JSONB` | yes | `'[]'::jsonb` | W `services/temple-areas.supabase.service.ts:111`<br>`services/temple-areas.supabase.service.ts:138`<br>R `services/temple-areas.supabase.service.ts:179` |
| `best_time_to_visit` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:112`<br>`services/temple-areas.supabase.service.ts:139`<br>R `services/temple-areas.supabase.service.ts:180` |
| `tips` | `JSONB` | yes | `'[]'::jsonb` | W `services/temple-areas.supabase.service.ts:113`<br>`services/temple-areas.supabase.service.ts:140`<br>R `services/temple-areas.supabase.service.ts:181` |
| `order` | `INTEGER` | yes | `0` | W `services/temple-areas.supabase.service.ts:115`<br>`services/temple-areas.supabase.service.ts:142`<br>R `services/temple-areas.supabase.service.ts:18`<br>`services/temple-areas.supabase.service.ts:41`<br>`services/temple-areas.supabase.service.ts:183` |
| `created_at` | `TIMESTAMPTZ` | yes | `NOW()` | - |
| `updated_at` | `TIMESTAMPTZ` | yes | `NOW()` | W `services/temple-areas.supabase.service.ts:145` |
| `image_url` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:109`<br>`services/temple-areas.supabase.service.ts:136`<br>R `services/temple-areas.supabase.service.ts:177` |
| `has360_view` | `BOOLEAN` | yes | - | W `services/temple-areas.supabase.service.ts:114`<br>`services/temple-areas.supabase.service.ts:141`<br>R `services/temple-areas.supabase.service.ts:182` |

**RLS:** SELECT `Allow public read access to temple_areas` (`supabase/migrations/20240523000000_create_temple_areas.sql:32`); SELECT `Allow public read access to temple_areas` (`supabase/migrations/20240915_create_temple_areas.sql:30`)  
**Indexes:** `temple_areas_order_idx("order")`, `temple_areas_category_idx(category)`  
**Declared in:** `supabase/migrations/20240523000000_create_temple_areas.sql:1`, `supabase/migrations/20240915_create_temple_areas.sql:1`
<!--END-->

Public SELECT. Read by `services/temple-areas.supabase.service.ts:16,39,63,81` and mapped to
`types/temple-explorer.ts#TempleArea` at `:189-200`. **The same service also writes it** - the
harvester missed every write because `addArea` hands `.insert()` a variable
(`insertData`, built at `:102-116`, inserted at `:119-120`) and `updateArea` assigns keys one at a
time onto `updateData` (`:129-145`, applied at `:148-149`); `deleteArea` removes rows at `:161-162`.
All three take the **service-role** client (`createAdminClient()` at `:98,129,159`), so they bypass
the public-read-only RLS. That makes this the one domain with a complete Supabase CRUD, and it means
the Index `W` of 1 for this table is wrong - only the `firestore_id` seed write was harvested. Declared by **two conflicting migrations**,
`supabase/migrations/20240523000000_create_temple_areas.sql` and
`supabase/migrations/20240915_create_temple_areas.sql`, which disagree on the primary-key type
(`uuid` vs `text`) and on whether `image_url` and `has360_view` exist. Both use `IF NOT EXISTS`, so
whichever ran first won and the tree cannot tell you which. The column is `has360_view` while the
type property is `has360View`, and `"order"` is a reserved word that has to stay quoted.

### sb `testimonials`

Mirrors Firestore `testimonials`.

<!--COLUMNS testimonials-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `name` | `text` | NOT NULL | - | R `services/testimonial.service.ts:90`<br>`services/testimonial.service.ts:156`<br>`services/testimonial.service.ts:199`<br>+1 more |
| `location` | `text` | NOT NULL | - | R `services/testimonial.service.ts:91`<br>`services/testimonial.service.ts:157`<br>`services/testimonial.service.ts:200`<br>+1 more |
| `quote` | `text` | NOT NULL | - | R `services/testimonial.service.ts:92`<br>`services/testimonial.service.ts:158`<br>`services/testimonial.service.ts:201`<br>+1 more |
| `years` | `text` | NOT NULL | - | R `services/testimonial.service.ts:93`<br>`services/testimonial.service.ts:159`<br>`services/testimonial.service.ts:202`<br>+1 more |
| `image` | `text` | yes | - | R `services/testimonial.service.ts:94`<br>`services/testimonial.service.ts:160`<br>`services/testimonial.service.ts:203`<br>+2 more |
| `phone` | `text` | yes | - | R `services/testimonial.service.ts:95` |
| `approved` | `boolean` | yes | `false` | W `services/chat.service.ts:247`<br>`services/testimonial.service.ts:120`<br>R `app/admin/content/page.tsx:98`<br>`services/chat.service.ts:214`<br>`services/chat.service.ts:232`<br>+5 more |
| `rejected` | `boolean` | yes | `false` | W `services/testimonial.service.ts:120`<br>R `services/testimonial.service.ts:97` |
| `rejection_reason` | `text` | yes | - | - |
| `submitted_by` | `text` | yes | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to testimonials` (`supabase/migrations/20261001000000_create_content_tables.sql:172`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:154`
<!--END-->

**No app code.** There is no `reviewed_at` column although `services/testimonial.service.ts:120`
writes one.

### sb `unknown_questions`

Mirrors Firestore `unknown_questions`, and extends it. **The main unknown-question store since 2026-10-13** (BOT-004).

<!--COLUMNS unknown_questions-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | R `lib/ai/ai-settings/repository.ts:482`<br>`lib/ai/ai-settings/admin-repository.ts:318`<br>`services/ai-analytics.service.ts:445` |
| `firestore_id` | `text` | yes | - | W `lib/supabase/migration-mappers.ts:565` (ETL only) |
| `question` | `text` | NOT NULL | - | W `lib/ai/unknown-logger.ts:32`<br>`lib/ai/ai-settings/repository.ts:414`<br>`services/ai-analytics.service.ts:207`<br>R `lib/ai/ai-settings/repository.ts:483`<br>`lib/ai/ai-settings/admin-repository.ts:319`<br>`services/ai-analytics.service.ts:448` |
| `question_lower` | `text` | yes | - | W `lib/ai/unknown-logger.ts:33`<br>`lib/ai/ai-settings/repository.ts:415`<br>`services/ai-analytics.service.ts:208`<br>R `lib/ai/ai-settings/repository.ts:438` (dedupe lookup) |
| `detected_intent` | `text` | yes | - | W `lib/ai/unknown-logger.ts:34`<br>`lib/ai/ai-settings/repository.ts:416`<br>`services/ai-analytics.service.ts:209`<br>R `services/ai-analytics.service.ts:432`<br>`services/ai-analytics.service.ts:449` |
| `confidence` | `numeric(5,2)` | yes | - | W `lib/ai/unknown-logger.ts:35`<br>`lib/ai/ai-settings/repository.ts:417`<br>`services/ai-analytics.service.ts:210`<br>R `services/ai-analytics.service.ts:450` |
| `language` | `text` | yes | - | W `lib/ai/unknown-logger.ts:36`<br>`lib/ai/ai-settings/repository.ts:418`<br>`services/ai-analytics.service.ts:211`<br>R `services/ai-analytics.service.ts:451` |
| `timestamp` | `timestamptz` | yes | `now()` | W `lib/ai/unknown-logger.ts:41`<br>`lib/ai/ai-settings/repository.ts:423`<br>R `lib/ai/ai-settings/repository.ts:439`<br>`lib/ai/ai-settings/repository.ts:472`<br>`lib/ai/ai-settings/admin-repository.ts:309`<br>`services/ai-analytics.service.ts:425-435` |
| `session_id` | `text` | yes | - | W `lib/ai/unknown-logger.ts:37`<br>`lib/ai/ai-settings/repository.ts:419`<br>`services/ai-analytics.service.ts:212`<br>R `services/ai-analytics.service.ts:446` |
| `times_asked` | `integer` | yes | `1` | W `lib/ai/unknown-logger.ts:38`<br>`lib/ai/ai-settings/repository.ts:420`<br>`lib/ai/ai-settings/repository.ts:449`<br>`services/ai-analytics.service.ts:213`<br>R `lib/ai/ai-settings/repository.ts:437` |
| `status` | `text` | NOT NULL | `'pending'` | W `lib/ai/unknown-logger.ts:39`<br>`lib/ai/ai-settings/repository.ts:421`<br>`lib/ai/ai-settings/repository.ts:519`<br>`services/ai-analytics.service.ts:214`<br>`services/ai-analytics.service.ts:246` (`'reviewed'`)<br>R `lib/ai/ai-settings/repository.ts:474`<br>`lib/ai/ai-settings/admin-repository.ts:311`<br>`services/ai-analytics.service.ts:453` |
| `assigned_to` | `text` | yes | `'unassigned'` | W `lib/ai/unknown-logger.ts:40`<br>`lib/ai/ai-settings/repository.ts:422`<br>`lib/ai/ai-settings/repository.ts:520`<br>`services/ai-analytics.service.ts:215`<br>R `lib/ai/ai-settings/repository.ts:475` |
| `last_asked` | `timestamptz` | yes | - | W `lib/ai/ai-settings/repository.ts:450`<br>R `lib/ai/ai-settings/admin-repository.ts:329` |
| `reviewed_by` | `text` | yes | - | W `services/ai-analytics.service.ts:247`<br>`lib/ai/ai-settings/repository.ts:521`<br>R `services/ai-analytics.service.ts:454` |
| `reviewed_at` | `timestamptz` | yes | - | W `services/ai-analytics.service.ts:248`<br>`lib/ai/ai-settings/repository.ts:527`<br>R `services/ai-analytics.service.ts:455` |
| `response` | `text` | yes | - | W `lib/ai/ai-settings/repository.ts:522`<br>R `lib/ai/ai-settings/admin-repository.ts:332` |
| `added_to_knowledge_article_id` | `text` | yes | - | W `services/ai-analytics.service.ts:250`<br>`lib/ai/ai-settings/repository.ts:523`<br>R `services/ai-analytics.service.ts:456` |
| `notes` | `text` | yes | - | W `lib/ai/unknown-logger.ts:42` (the error message)<br>`lib/ai/ai-settings/repository.ts:524`<br>R `lib/ai/ai-settings/admin-repository.ts:334` |

**RLS:** ALL `Deny all public access to unknown_questions` (`supabase/migrations/20260930000000_create_ai_tables.sql:94`)  
**Indexes:** `idx_unknown_questions_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:35`  
**Prisma:** `UnknownQuestion` (`prisma/schema.prisma:143-171`)
<!--END-->

Refreshed by hand on 2026-10-18; the harvested cells for this table mix in the Firestore twin
(`services/analytics.service.ts:31`, `app/admin/ai/analytics/page.tsx:*`), which are listed under fs
`unknown_questions` instead. Three independent writers now insert here with three slightly different
payloads - `lib/ai/unknown-logger.ts:28-43`, `lib/ai/ai-settings/repository.ts:404-429` and
`services/ai-analytics.service.ts:194-230` (the last omits `timestamp`, relying on the default) - and
only `lib/ai/ai-settings/repository.ts:431-462` de-duplicates on `question_lower`. Readers:
`lib/ai/ai-settings/repository.ts:464-504`, `lib/ai/ai-settings/admin-repository.ts:302-336`,
`services/ai-analytics.service.ts:415-464`, `lib/ai/unknown-logger.ts:114-166`, `:171-224`.

The `status` column now has three vocabularies: the triage type `UnknownQuestionStatus`
(`types/ai-settings.ts:12`: `pending | in_review | resolved | added_to_knowledge`),
`markUnknownQuestionReviewed` writing `'reviewed'` (`services/ai-analytics.service.ts:246`), and the
readers deriving "reviewed" as `status !== 'pending' && status !== 'unassigned'`
(`services/ai-analytics.service.ts:453`, `lib/ai/unknown-logger.ts:157`) - `unassigned` is an
`assigned_to` value, never a status. Fault F-15. Indexed only on `timestamp`, although the triage
reader filters on `status` and `assigned_to` and the dedupe on `question_lower`. `expectedIntent`,
`userAgent` and `ip`, which the Firestore logger used to store, have no column: `unknown-logger`
now drops them and stores the error text in `notes`.

### sb `users`

Mirrors Firestore `users`.

<!--COLUMNS users-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `email` | `text` | NOT NULL | - | W `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more<br>R `app/api/admin/users/set-role/route.ts:64`<br>`services/user.service.ts:29`<br>`services/user.service.ts:52`<br>+1 more |
| `display_name` | `text` | yes | - | - |
| `phone_number` | `text` | yes | - | - |
| `photo_url` | `text` | yes | - | - |
| `role` | `text` | NOT NULL | `'user'` | W `app/api/admin/users/create-admin/route.ts:65`<br>`app/api/admin/users/set-role/route.ts:79`<br>`services/auth.service.ts:57`<br>+4 more<br>R `services/user.service.ts:31`<br>`services/user.service.ts:54`<br>`lib/auth/admin-auth.ts:147`<br>+1 more |
| `active` | `boolean` | NOT NULL | `true` | R `services/user.service.ts:25`<br>`services/user.service.ts:48` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to users` (`supabase/migrations/20261001000000_create_content_tables.sql:30`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:13`
<!--END-->

**No app code.** The column names diverge from Firestore: `display_name` vs `name`, `phone_number`
vs `phone`, `photo_url` vs `profileImage`, and there is no column for `templeId`, `isApproved`,
`emailVerified` or `lastLogin`. Auth migrates separately through Supabase Auth, so this table would
hold profile data only.

### sb `volunteer_requests`

Mirrors the Firestore collection of the same name - but the *other* `VolunteerRequest` type.

<!--COLUMNS volunteer_requests-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `volunteer_id` | `text` | NOT NULL | - | - |
| `name` | `text` | NOT NULL | - | - |
| `phone` | `text` | NOT NULL | - | - |
| `sex` | `text` | NOT NULL | - | - |
| `active` | `boolean` | NOT NULL | `true` | - |
| `address` | `text` | NOT NULL | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to volunteer_requests` (`supabase/migrations/20261001000000_create_content_tables.sql:217`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:200`
<!--END-->

**No app code.** The columns follow `types/volunteer.ts#VolunteerRequest:34` (`volunteer_id`, `sex`,
`address`), while the code writes `types/ai.ts#VolunteerRequest:71` (`sessionId`, `email`, `service`,
`preferredDate`, `status`). The table cannot accept a single row the application currently produces.

## Orphans and mismatches

Counts are over the field entries the harvester produced for the stores that have at least one call
site (the per-document `settings/*` and `guruParampara/*` buckets are excluded to avoid double
counting). Reproduce them with `node .claude/state/inventory/fields.mjs` and a pass over
`.claude/state/inventory/fields.json`.

| class | 2026-09-19 (607 entries, 62 stores) | 2026-10-18 (628 entries, 60 stores) |
|---|---|---|
| fields with both a write site and a read site | 167 | 193 |
| **written, never read** | **86** | **74** |
| **read, never written** | **354** | **361** |
| collections with no TypeScript type at all | 19 | 19 (two of them, `articles` and `trust`, now have no code either) |

The shift is almost entirely the AI tables moving to Supabase, where `services/ai-analytics.service.ts`,
`services/chat.service.ts` and `lib/ai/knowledge/repository.ts` both write and read the same snake_case
columns in one file; `messages`, `articles`, `trust`, `ai_unknown_questions` and `settings/ai` dropped
out of the harvest because no code touches them.

### Written but never read (74)

The ones worth deleting (status as of 2026-10-18):

| field | written at | why it is dead |
|---|---|---|
| `chat_metrics.date`, `chat_metrics.timestamp` | `services/analytics.service.ts:54` | nothing reads the collection. STILL OPEN |
| `page_views.date` | `services/pageviews.service.ts:46` | never queried or aggregated - every read path filters on `timestamp` instead (`:112-116`). (`visitorId` was on this row and is **not** dead: `services/pageviews.service.ts:126-129` folds it into the unique-visitor set.) STILL OPEN |
| `daily_page_stats.date`, `.pageViews`, `.lastUpdated` | `services/pageviews.service.ts:62` | the dashboard reads `page_views` directly instead. STILL OPEN |
| ~~`articles.tags`, `.version`, `.createdBy`, `.createdAt`, `.updatedAt`~~ | ~~`scripts/seed-ai-knowledge.ts` (old line 145)~~ | **FIXED (2026-10-18) by removal**, commit `fdaff98`: the seed script writes Supabase `ai_knowledge` now |
| `chatTraining.*` - all seven fields | `app/admin/ai/training/page.tsx:149`, `:221-232` | **widened 2026-10-14** (commit `2891323`): the only consumer, `lib/ai/firebaseChat.ts:152-158`, was deleted, so the whole collection is now read only by the admin page that writes it. Fault F-21 |
| `intent_feedback.adminId`, `.notes`, `.question`, `.sessionId` | `services/analytics.service.ts:204` | the reader at `:247-258` uses only `isCorrect` and the two intents. STILL OPEN |
| ~~`ai_unknown_questions.reviewed`, `.reviewedBy`, `.addedToKnowledge`, `.knowledgeArticleId`~~ | ~~`services/ai-analytics.service.ts` (old lines 204, 232)~~ | **FIXED (2026-10-18) by removal**, commit `3d0d3b2`: those updates now target Supabase `unknown_questions`, whose readers map them back (`services/ai-analytics.service.ts:453-456`) |
| `unknown_questions.processed` (Firestore) | `services/analytics.service.ts:34` | set to `false` on every legacy log and never read or flipped. STILL OPEN |
| `users.uid`, `.lastLogin`, `.emailVerified` | five writers, e.g. `services/auth.service.ts:57` | no reader anywhere. (`templeId`, `profileImage` and `isApproved` were on this row and are **not** unread: `services/auth.service.ts:106-108` and `lib/auth.ts:104-106` re-read them on login - but only to echo them back, and nothing branches on `isApproved`.) STILL OPEN |
| `test.message`, `test.createdAt` | `app/admin/test/page.tsx:15` | debug page that ships in the build. STILL OPEN |
| `notifications.title`, `.type`, `.message`, `.createdAt`, `.readAt` | `services/testimonial.service.ts:361,437` | there is no notifications UI. STILL OPEN |
| `volunteer_requests.status` | `services/chat.service.ts:297` | no admin screen filters on it; the one counter over this collection (`app/admin/content/page.tsx:99`) is unfiltered. STILL OPEN |
| `ai_settings.version` (Supabase) | nobody (column default `1`) | declared in `supabase/migrations/20261012000000_create_ai_settings_table.sql:18` and the Prisma model, never written or read. NEW |
| `updatedAt` on `members`, `volunteers`, `galleryAlbums`, `guruParampara`, `homepage`, `profiles`, `receiptSevas` | various | written for hygiene, never displayed or sorted on. STILL OPEN |

Harvester false positives in the 74: `system.year/.lastNumber/.prefix` are read back inside the same
transaction at `lib/receipt/admin.ts:51` through `counterSnap.data()`; `temple_areas.firestore_id` is
a traceability column by design; and the Supabase `unknown_questions` columns `reviewed_by`,
`reviewed_at`, `added_to_knowledge_article_id`, `last_asked`, `notes`, `session_id` *are* read, by
the row mappers at `lib/ai/ai-settings/admin-repository.ts:317-335` and
`services/ai-analytics.service.ts:444-457`, which the harvester does not follow (`doc` there is a
`.map()` parameter, not a `.data()` binding). `ai_settings.ignoreDuplicates` / `.timestamp` are an
upsert option and `ai_token_usage` bleed respectively.

### Read but never written (361)

Most of this is the spread-write blind spot rather than a real orphan. Three classes:

1. **Harvester artefact - the write is a spread.** `bills` (22 fields), `quotes` (25),
   `donations` (19), `dailyPoojas` (12), `donation_campaigns` (8), `aaradhane` (8),
   `galleryAlbums`, `galleryMedia`, `knowledge_versions`, `knowledge_drafts`. The declared type is
   written whole; treat these as normal fields. New since 2026-09-19: the migration scripts
   (`scripts/migrate-seva-bookings-to-supabase.ts`, `scripts/migrate-staged-phase1.ts`,
   `scripts/migrate-settings.ts`) add read-only cells on the Firestore side of every collection they
   copy - `sevaBookings` gains thirteen of them.
2. **Seed-only or manual-entry data - genuinely never written by the application.**
   - `timings.morningOpen/.morningClose/.eveningOpen/.eveningClose/.open/.close`
     (`lib/ai/retrieval/settings.ts:115-118`) - no writer exists anywhere in the repo. STILL OPEN.
   - ~~`trust.name/.role/.position`~~ - **FIXED (2026-10-18) by removal**: the reader
     (`lib/ai/firebaseChat.ts:124-125`) was deleted by commit `2891323`.
   - `guruParampara.gurus` is written only by `scripts/seed-guru-parampara.ts:378` and
     `scripts/seed-guru-to-firestore.ts:327`, never by the running application.
   - `receiptSevas.name` is read by the seed guard at `scripts/seed-receipt-sevas.ts:100` before the
     admin API creates the document.
3. **Real bugs - a reader for a field nothing ever writes.** Status column added 2026-10-18; the ids
   are the ones used in the Faults section below.

| id | field read | read at | why it is a bug | status 2026-10-18 |
|---|---|---|---|---|
| F-01 | `events.date` | `app/admin/content/page.tsx:90`, `app/admin/page.tsx:111`, `app/api/public/stats/route.ts:45` | events carry `startDate`/`endDate`; the upcoming-events counters are always 0 | STILL OPEN - all three lines unchanged |
| F-02 | `events.active` | `app/admin/content/page.tsx:168` (draft query), `:134` (recent-event status badge) | the flag is `published`; the "draft events" panel is always empty and every recent event shows as "Draft" | STILL OPEN |
| F-03 | `announcements.active` | `app/admin/content/page.tsx:92,169`, `:146` (recent-item status badge) | the flag is `isActive` (`types/announcement.ts:6`); the active count is 0, the draft panel is empty, and every recent announcement shows as "Draft" | STILL OPEN |
| F-04 | `sevas.price` | ~~`lib/ai/firebaseChat.ts:111`~~ | the field is `amount`; the expression degraded cleanly to `data.amount`. Harmless. | FIXED (2026-10-18) by removal, commit `2891323` |
| F-05 | `galleryMedia.url`, `.imageUrl` | `app/admin/media/page.tsx:87` | the type and the service write `imagePath`; `url \|\| imageUrl \|\| ""` has no third fallback, so every thumbnail in the admin media grid is blank. (`caption` at `:89` falls back to `title`, a real field, so the label is fine.) | STILL OPEN |
| F-06 | `users.active` | `services/user.service.ts:25,48` | every writer writes `isActive`; the new admin guard reads the right name (`lib/auth/admin-auth.ts:137`), the user list still does not | STILL OPEN |
| F-07 | `knowledge_workflow.lastReviewedBy`, `.lastReviewedAt` | declared `types/knowledge-workflow.ts:150-151` | the document stores `reviewedBy`/`reviewedAt`; the mapper at `services/knowledge-workflow.service.ts:797-798` renames them on read, so the declared names never exist on disk | STILL OPEN |
| F-08 | `ai_latency_records.messageId` | declared `types/ai-analytics.ts:30` | neither store had it | FIXED (2026-10-18), commit `edecabc`: now `messageId?` with "Deprecated/Removed in Supabase schema"; `intent` likewise (`:36`) |

### Collections with no TypeScript type (19)

`articles`, `chat_messages`, `chatTraining`, `daily_page_stats`, `featuredContent`, `futurePlans`,
`gallery`, `intent_feedback`, `knowledge_articles`, `knowledge_categories`, `notifications`,
`page_views`, `panchanga`, `poojas`, `system`, `test`, `timings`, `trust`, `trustCommittee`.

M11 named nine typeless collections. Two of those nine do have a type after all: `chat_metrics` maps
to `types/analytics.ts#ConversationMetric:17` and `intent_metrics` to
`types/analytics.ts#IntentMetric:31` - although in the `intent_metrics` case the type and the stored
document share no field, so the type is effectively fiction. Twelve collections M11 did not name are
also typeless: `chat_messages`, `futurePlans`, `gallery`, `knowledge_articles`,
`knowledge_categories`, `notifications`, `page_views`, `panchanga`, `poojas`, `system`, `timings`,
`trustCommittee`. 9 - 2 + 12 = **19**, which is also the number of Firestore rows carrying
**none** in the Index. For all 19, the write site is the only definition of the shape. Unchanged on
2026-10-18, with one caveat: `articles` and `trust` no longer have any call site, and the Firestore
`chat_messages` is still only counted. The three new Supabase tables are typeless too - there are no
generated Supabase types - but `ai_settings` and `ai_knowledge` map one-to-one onto
`types/ai-settings.ts#AISettings` and `lib/ai/knowledge/types.ts#KnowledgeArticle`, and Prisma models
exist for both (`prisma/schema.prisma:32`, `:65`); `settings_documents` holds untyped JSON.

### Fields declared in a type that no code writes

`Bookmark.title/.description/.thumbnail/.url` (`types/profile.ts:59-62`),
`ChatSession.detectedLanguage` (`types/ai.ts:22`) - **changed 2026-10-06**: now written to the
Supabase `detected_language` column by `updateChatSession` (`services/chat.service.ts:35`), though
`createChatSession` never sets it and nothing in the app passes it,
`CommitteeApproval.deadline` (`types/knowledge-workflow.ts:99`),
`WorkflowAction.previousVersionId/.newVersionId` (`types/knowledge-workflow.ts:57-58`),
`AuditLogEntry.ipAddress/.userAgent` (`types/knowledge-workflow.ts:125-126`),
`KnowledgeArticle.kannadaTitle/.kannadaContent` (`lib/ai/knowledge/types.ts:59,64`) - now written to
Supabase by `lib/ai/knowledge/repository.ts:226,230` when a request carries them, but no admin form
does,
`TempleArea.accessibility` (`types/temple-explorer.ts:28`, new 2026-10-06) - only the static
`TEMPLE_AREAS` array in the same file sets it; `temple_areas` has no column for it and
`services/temple-areas.supabase.service.ts` never maps it,
`UnknownQuestionRecord.feedback/.userAgent` (`types/ai-analytics.ts:72-73`).
`Testimonial.phone` (`types/homepage.ts:140`) is written at
`services/testimonial.service.ts:95` and never displayed.

### Where `docs/DATA-MODEL.md` disagrees with the code (16)

| # | section | the document says | the code does |
|---|---|---|---|
| 1 | §1 `users` (`docs/DATA-MODEL.md:64-67`) | indexes `email` unique, `templeId, role`, `isActive, role` | `firestore.indexes.json` has `role+createdAt` and `templeId+createdAt`, both unused |
| 2 | §2 `sevas` (`docs/DATA-MODEL.md:80-85`) | `name` and `description` are `{en, kn}` objects | plain strings (`types/seva.ts:2-3`) |
| 3 | §2 `sevas` (`docs/DATA-MODEL.md:94-97`) | `maxPerDay`, `requiresAdvanceBooking`, `bookingWindowDays` | none of the three exist |
| 4 | §3 `sevaBookings` (`docs/DATA-MODEL.md:130-134`) | `devoteeName`, `devoteeEmail`, `devoteePhone` | `userName`, `userEmail`, `userPhone` (`types/seva-booking.ts:14-17`) |
| 5 | §3 `sevaBookings` (`docs/DATA-MODEL.md:141-158`) | `preferredTime`, `statusHistory`, `paymentId`, `paymentMode`, `bookedBy`, `confirmedBy`, `confirmedAt` | none exist |
| 6 | §4 `events` (`docs/DATA-MODEL.md:208-250`) | `{en,kn}` title and description, `allDay`, `type`, `videoUrl`, `displayOrder`, `metaTitle`, `metaDescription`; `status` is `draft/published/cancelled` | flat strings, none of those fields, and `status` is `Upcoming/Ongoing/Completed` (`types/event.ts:3-6`) |
| 7 | §5 `gallery` (`docs/DATA-MODEL.md:283-300`) | a `GalleryItem` with `url`, `thumbnailUrl`, `tags`, `featured` | `gallery` is only counted; the real media collection is `galleryMedia`, keyed on `imagePath` |
| 8 | §6 `announcements` (`docs/DATA-MODEL.md:335-357`) | `content`, `active`, `pinned`, `publishedAt`, `expiresAt`, `type`, `targetAudience`, `priority` | `message`, `isActive`, `link` (`types/announcement.ts:1-8`) |
| 9 | §7 `donations` (`docs/DATA-MODEL.md:385-420`) | `donorEmail`, `donorPhone`, `donorAddress`, `pan`, `eligible80G`, `paymentStatus`, `transactionId`, `receiptUrl`, `certificateNumber`, `approvedBy`, `approvedAt` | `email`, `phone`, `address`, `status`, `paymentMode`, `adminRemarks`, `collectedBy`, `collectedAt` (`types/donation.ts:13-31`) |
| 10 | §8 (`docs/DATA-MODEL.md:450`) | the collection is `donationCampaigns`, with `goalAmount`, `currentAmount`, `startDate`, `endDate` | the collection is `donation_campaigns`, with `suggestedAmount` and `displayOrder` |
| 11 | §9 `settings` (`docs/DATA-MODEL.md:491-495`) | one document `settings/main` holding a `TempleSettings` object | eleven documents keyed by feature name; there is no `main` |
| 12 | §10 `knowledge` (`docs/DATA-MODEL.md:561-596`) | `{en,kn}` title, content and keywords, plus `summary`, `tags`, `featured`, `active`, `author`, `reviewedBy` | flat `title` and `content`, plus `kannadaTitle`, `kannadaContent`, `approved`, `slug` (`lib/ai/knowledge/types.ts:54-71`); since 2026-10-13 the AI reads them from Supabase `ai_knowledge`, which the document does not mention |
| 13 | §11 `chat_sessions` (`docs/DATA-MODEL.md:624-655`) | an embedded `messages[]`, `sessionToken`, `status`, `endedAt`, `lastLanguage` | messages lived in the `messages` collection and, since 2026-10-06, in Supabase `chat_messages` (`services/chat.service.ts:109`); the session has `preferredLanguage`, no `status`, no `endedAt` |
| 14 | §12 `aaradhane` (`docs/DATA-MODEL.md:674-698`) | `dayOfWeek`, `startTime`, `endTime`, `active`, `{en,kn}` name and description | `guruName`, `dates[]`, `rituals[]`, `offerings[]`, `sevaDetails`, `isUpcoming`, `displayOrder` (`types/aaradhane.ts:1-16`) |
| 15 | §13 `panchanga` (`docs/DATA-MODEL.md:708-746`) | a Firestore collection with a full field list | no code ever queries it; the data is 730 JSON files under `data/panchanga/` |
| 16 | §14 `unknown_questions` (`docs/DATA-MODEL.md:751-781`) | `aiResponse`, `userId`, `addedToKnowledge`, `knowledgeArticleId`, `createdAt` | Firestore writes `timestamp` and `processed`; Supabase adds `times_asked`, `status`, `assigned_to`, `last_asked` |

`docs/SUPABASE_DATABASE_SCHEMA.md` fares better, and was updated in 2026-10: its column lists for
`sevas` (`docs/SUPABASE_DATABASE_SCHEMA.md:66-79`) and `daily_poojas` (`:84-99`) match the
migrations; the `seva_bookings.seva_id`, `donations.campaign_id` and `gallery_media.album_id` rows now
say `text` (`:174`, `:224`, `:285`), and the old "Legacy / Not Required" label on `settings` was
replaced by a `settings_documents` section (`:56-59`, `:334-350`). Two gaps remain. It is silent on
the two AI tables added since (`ai_settings`, `ai_knowledge`) and on the live use of `chat_sessions` /
`chat_messages` beyond the inventory line `:54`, and its `events` list (`:104-121`) still marks
`description`, `location` and `status` NOT NULL although
`supabase/migrations/20261011000000_alter_events_nullable.sql:3-6` dropped that. It names `bills`
and `knowledge` in its inventory (`:20`, `:24`) but proposes no table for either, and never mentions
`receiptSevas`, `receipts` or `quotes` - live business data, two of them money.

## Faults (status 2026-10-18)

The 2026-09-19 file carried its faults inline (the "Real bugs" table, the Verification log and the
per-store notes) without ids. The refresh gives every one an id and a status; F-01 to F-08 are the
"Real bugs" rows above, the rest are listed here. "Pre-existing" means the code was already like
that on 2026-09-19 even if the fault is first recorded today.

| id | fault | evidence | status 2026-10-18 |
|---|---|---|---|
| F-01 - F-08 | reader for a field nothing writes | see "Read but never written", class 3 | F-04, F-08 FIXED; the other six STILL OPEN |
| F-09 | filtering receipts by seva throws `FAILED_PRECONDITION`: `where("sevaIds","array-contains")` plus `orderBy("createdAt")` with no `receipts` entry in `firestore.indexes.json` | `app/api/admin/receipts/route.ts:39`, `:55`; 22 index entries, none on `receipts` | STILL OPEN |
| F-10 | chat history query on Firestore `messages` (`sessionId` + `orderBy timestamp`) had its composite index declared on the empty `chat_messages` instead | old `services/chat.service.ts:118-121`; index entry 15 | FIXED (2026-10-18) by removal, commit `224875d` - history now reads Supabase `chat_messages`, which is indexed on `session_id`. Superseded by F-11 |
| F-11 | **new.** Browser code reaches deny-all Supabase tables with the anon key. Chat persistence uses `createClient()` unconditionally; the AI settings, knowledge and analytics repositories fall back to it whenever `typeof window !== 'undefined'`. very such insert fails and every select returns no rows - except reads of approved `ai_knowledge` rows, which the public SELECT policy allows (`supabase/migrations/20261013000000_create_ai_knowledge.sql:30-34`; only knowledge writes and the pending-article read fail). `saveMessage` errors are swallowed | `services/chat.service.ts:107`, `:145`; `components/ai/AIChatProvider.tsx:113-117`; `lib/ai/ai-settings/repository.ts:35-37`; `lib/ai/knowledge/repository.ts:62`; `services/ai-analytics.service.ts:133`; deny-all policies `supabase/migrations/20260930000000_create_ai_tables.sql:92-96`, `supabase/migrations/20261012000000_create_ai_settings_table.sql:31` | NEW (commits `224875d`, `fae5d51`, `3d0d3b2`) |
| F-12 | **new.** The admin AI screens still count and chart Firestore after every writer moved to Supabase: conversation totals from Firestore `chat_sessions`, message total from the never-written Firestore `chat_messages`, intent / latency / unknown-question panels from Firestore. he message total is always 0 and the intent / latency panels freeze at their pre-migration values. The conversation counts and the unknown-question panel do **not** freeze - they show only the Firestore half: Firestore `chat_sessions` is still written on every hybrid chat turn (`services/conversation.service.ts:112`, `:161`, called at `app/api/chat/route.ts:183`) and Firestore `unknown_questions` by `services/analytics.service.ts:31` via the live `lib/ai/generator.ts:73` (`app/api/chat/route.ts:162`) (corrected by verification 2026-10-18) | `app/admin/ai/analytics/page.tsx:305-333`, `:429-433`; `app/admin/ai/page.tsx:96`; `app/admin/page.tsx:107`; `services/ai-analytics.service.ts:622-639` | NEW (absorbs the old "admin total messages is always zero" note on fs `chat_messages`) |
| F-13 | **new, pre-existing.** `getAnalyticsSettings()` casts the first Firestore `ai_settings` document to `AIAnalyticsSettings`. The legacy `ai_settings/main` has no `enabled`, so if it exists all four AI analytics writers return early and record nothing | `services/ai-analytics.service.ts:57-77`, `:102`, `:127`, `:163`, `:197`; seed `scripts/seed-ai-settings.ts:504` | NEW; whether it bites is UNCLEAR (needs one document read) |
| F-14 | **new.** Knowledge split brain: the admin Knowledge CRUD, the seed import and the coverage report use Firestore `knowledge`; Raya AI reads only Supabase `ai_knowledge`. Admin-created articles never reach the chatbot, and opening one by id queries Supabase with a Firestore id | `app/api/admin/knowledge/route.ts:22`, `:102-112`; `app/api/admin/knowledge/[id]/route.ts:22`, `:59`, `:98`; `app/api/ai/knowledge/import/route.ts:73-123`; `lib/ai/knowledge/repository.ts:16`, `:55-103` | NEW (commit `fdaff98` moved only the reader side) |
| F-15 | **new.** `unknown_questions.status` has three vocabularies - the triage type (`pending / in_review / resolved / added_to_knowledge`), `'reviewed'` from the analytics path, and readers that treat the `assigned_to` value `'unassigned'` as a status - so a question reviewed from the analytics screen never matches a triage filter | `types/ai-settings.ts:12`; `services/ai-analytics.service.ts:246`, `:453`; `lib/ai/unknown-logger.ts:157` | NEW (commit `3d0d3b2`) |
| F-16 | social links: the admin edits Firestore `settings/socialLinks`, the site reads Supabase `social_links`, and only the ETL writes the table | `app/admin/settings/social-links/page.tsx:88`; `services/settings.service.ts:79-112` | STILL OPEN (pre-existing, first given an id today) |
| F-17 | sevas split brain: admin writes Firestore, public pages read Supabase until `scripts/migrate-sevas.ts` is re-run | `services/seva.service.ts:11`, `:76`, `:81`; `app/actions/sevas.ts:13` | STILL OPEN (pre-existing) |
| F-18 | `events` read and written through the anon key against deny-all RLS | `services/event.service.ts:46-123`; `supabase/migrations/20260907112632_create_core_tables.sql:98` | STILL OPEN (pre-existing; now one case of the F-11 pattern) |
| F-19 | world-writable Firestore rules on `ai_settings` and the duplicate `settings` match | `firestore.rules:226`, `firestore.rules:231` | STILL OPEN (rules file unchanged since 2026-09-19). Lower stakes for `ai_settings` now that the app reads Supabase - except through F-13 |
| F-20 | Raya AI answered trust questions from the stale, separately seeded `trust` collection instead of `settings/trustCommittee` | old `lib/ai/firebaseChat.ts:120-125` | FIXED (2026-10-18) by removal, commit `2891323` |
| F-21 | **new.** The "AI Training" admin page edits `chatTraining`, which no AI module reads since `lib/ai/firebaseChat.ts` was deleted | `app/admin/ai/training/page.tsx:125`, `:221-232`; grep for `chatTraining` outside that page: only inventory lists | NEW (commit `2891323`) |
| F-22 | **new.** The mobile app reads Supabase tables the web app keeps deny-all (`sevas`, `events`, `daily_poojas`, `gallery_albums`), embeds `gallery_media` without a foreign key, and reads a `website_settings` table no migration creates  `apps/mobile/lib/api.ts:4-55`; `apps/mobile/app/sevas/[id].tsx:22-26` | NEW - see Portability |
| F-23 | **new (verification 2026-10-18), pre-existing.** `receiptSevas` is orphaned: the receipt book reads and writes the general `sevas` collection (`RECEIPT_SEVAS_COLLECTION = "sevas"` at `app/api/admin/receipt-sevas/route.ts:13`, `app/api/admin/receipt-sevas/[id]/route.ts:12`, `lib/receipt/admin.ts:32`; commits `137dcba`, `0867591`, 2026-09-07), so only `scripts/seed-receipt-sevas.ts:16` writes `receiptSevas` and nothing reads it. The file's only payload-validating rule (`firestore.rules:85-100`) guards an unused collection, and admin-created receipt sevas land in the public seva catalogue with `category: "Special"` (`app/api/admin/receipt-sevas/route.ts:80`) | `app/api/admin/receipt-sevas/route.ts:13`, `lib/receipt/admin.ts:32`; grep `receiptSevas` in `app/ lib/ services/`: 0 hits outside `lib/supabase/migration-inventory.ts:64` | NEW (low) |

Blockers recorded in the 2026-09-19 Supabase notes that are now gone (not counted as faults):
`seva_bookings.seva_id uuid` (widened, `supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql:23-24`),
`donations.campaign_id` and `gallery_media.album_id uuid` (widened,
`supabase/migrations/20261002000000_align_content_firestore_ids.sql:18-40`), and "four migration files
dated in the future" (the newest is now three days old).

## Portability notes (apps/mobile)

The mobile app and the Prisma tooling themselves are owned by M17
(`.claude/skills/temple-portal-expert/brain/M17-mobile-app-prisma-and-ai-loop.md`); this section covers
only the fields and tables they touch. `apps/mobile` (Expo / React Native; `apps/mobile/lib/api.ts` first added 2026-09-30, commit `0cb71b6`) is the first consumer of
this catalogue outside the web app. It talks to Supabase directly with the anon key
(`apps/mobile/lib/supabase.ts:5-8`) and uses **no** Firestore collection and **no** type from
`types/`; every row comes back as `any` and is cast to local interfaces.

| mobile call | table / columns it relies on | catalogue says |
|---|---|---|
| `fetchSevas` (`apps/mobile/lib/api.ts:3-13`) | `sevas`: `active`, `amount`, `display_order` | columns exist; table is deny-all to `public` (`supabase/migrations/20260907112632_create_core_tables.sql:86`), so the anon read returns `[]` unless RLS is off. Supabase `sevas` is also stale until `scripts/migrate-sevas.ts` runs (F-17) |
| seva detail (`apps/mobile/app/sevas/[id].tsx:22-26`) | `sevas.id` | the web app's public seva id is `firestore_id` (`services/seva.service.ts:13`), not `id` - a link shared between web and mobile will not resolve |
| `fetchEvents` (`apps/mobile/lib/api.ts:15-24`) | `events`: `published`, `start_date` | columns exist; deny-all (F-18) |
| `fetchDailyPoojas` (`apps/mobile/lib/api.ts:26-35`) | `daily_poojas`: `is_active`, `display_order` | columns exist; deny-all; filled only by `scripts/migrate-daily-poojas.ts` |
| `fetchGalleryAlbums` (`apps/mobile/lib/api.ts:37-45`) | `gallery_albums` with embedded `gallery_media(*)` | schema-only tables with no app code; `gallery_media.album_id` is `text` with **no foreign key**, so PostgREST cannot resolve the embed and the call errors |
| `fetchWebsiteSettings` (`apps/mobile/lib/api.ts:47-56`) | `website_settings` (`key`, `value`) | **no such table** in any migration; the web app's equivalents are `site_settings` (columns, not key/value) and `ai_settings.temple_information` (UNCLEAR) |

To make the mobile reads work the deny-all policies on those four tables need a public `SELECT`
policy like `site_settings` has (`supabase/migrations/20261010000000_create_settings.sql:57-61`), the
gallery tables need a real FK (blocked while `album_id` holds Firestore ids), and `website_settings`
needs either a migration or a switch to `site_settings`. The Prisma schema does not help mobile: it
covers only the Raya AI tables and runs server-side.

## How to change it

### Add a field end to end (worked example: `sevas.sevaTypeCode`)

1. **Type.** `types/seva.ts:1` add it to `Seva`, and `types/seva.ts:25` add it to `SevaRequest` if
   the admin form sets it. Mark it optional or every existing document fails the cast.
. **Service write.** Nothing to do when the write is a spread - `services/seva.service.ts:76,81`
   pass `{...data}`, and so does `services/sevaBooking.service.ts:36` (a spread plus fixed status and
   payment keys). When the spread is of a whitelisting sanitizer, add the key to the sanitizer: the
   receipt-book seva create (`app/api/admin/receipt-sevas/route.ts:75-76`) spreads
   `sanitizeReceiptSevaInput`, which keeps only five keys (`lib/receipt/validation.ts:123-133`).
3. **Service read / mapper.** This is the real gate. For sevas it is
   `services/seva.service.ts:12-25` (Supabase columns to camelCase) **and** the untyped Firestore
   fallback at `:34`, which returns raw `doc.data()` and therefore behaves differently. Miss the
   mapper and the field is stored but never surfaces.
4. **Firestore rule.** `firestore.rules`. Only `receiptSevas` (`:85-100`) validates a payload, so
  most collections need no rule change; if the target is `receiptSevas`, extend the checks there
   (but note no app code writes `receiptSevas` - fault F-23 - and the receipt-book routes use the
   Admin SDK on `sevas`, which bypasses rules).
5. **Composite index.** Needed only when you will filter on the new field and order by another.
   Add an entry to `firestore.indexes.json` (22 on 2026-10-18) and check it names the collection you
   actually query - `messages` versus `chat_messages` was the standing trap until chat moved to
  Supabase on 2026-10-06; entries 14, 15 and 21 now declare index shapes no query uses
   (`chat_sessions` and `knowledge` are still read - unfiltered counts, and `where("approved")`
   at `app/api/ai/knowledge/import/route.ts:74` / `app/api/ai/knowledge/coverage/route.ts:82` - but
   nothing filters or orders on those field combinations).
6. **Supabase column.** New file under `supabase/migrations/`. The newest file is
  `supabase/migrations/20261015000000_baseline_raya_ai.sql`, so any timestamp from today on sorts last; the
   "Deploy Supabase Migrations" workflow applies it (`.github/workflows/supabase-migrations.yml:68-69`)
   - but only when run by hand (`workflow_dispatch`, `:6-7`); merging does not apply anything. There are no generated Supabase types, so
   nothing will warn you if the service mapper forgets the column. If the table is one of the nine in
   prisma/schema.prisma`, add the field there too or the drift gate (`package.json:10-11`, run by the
   manual `.github/workflows/prisma-baseline-drift-gate.yml`) fails.
7. **Migration script.** Two places since 2026-10: the per-collection script
   (`scripts/migrate-sevas.ts:67-85`, or the matching mapper in `scripts/migrate-core-to-supabase.ts`)
   **and** the shared mapper plus its coverage spec in `lib/supabase/migration-mappers.ts` - for sevas
   `mapSeva` (`:685`) and `CORE_FIELD_SPECS.sevas` (`:639-651`). The batched runner treats any source
   field missing from the spec as a failure (`lib/supabase/migration-runner.ts:233-235`), so a new
   Firestore field that is not added to the spec breaks the next migration run.
8. **Admin form.** The page under `app/admin/...` that edits the collection.
9. **Public reader.** The page or the AI retriever - for sevas, `lib/ai/retrieval/sevas.ts:102-107`.
10. **Docs.** `docs/DATA-MODEL.md` and `docs/SUPABASE_DATABASE_SCHEMA.md`. Both already drift from
    the code; do not widen the gap.

### Find every site that touches a field

```
node .claude/state/inventory/fields.mjs
node -e "const d=require('./.claude/state/inventory/fields.json');console.log(d.stores.sevas.fields.amount)"
```

`.claude/state/inventory/fields.json` gives `{ writes: [path:line], reads: [path:line] }` per field. Always cross-check with
a plain grep, because the harvester cannot see spread writes.

### Rename a field safely

Rename in the type first and let the compiler find the call sites, then grep for the **string
literal** form, which the compiler cannot see: `where("<old>"`, `orderBy("<old>"`, the
`firestore.indexes.json` entry, the Supabase mapper, and `firestore.rules`. The `active` versus
`isActive` pair on `announcements` is exactly what happens when that second pass is skipped.

### Add a collection or a table

Follow M11 Recipe 2 (Firestore) and Recipe 3 (Supabase). Since 2026-10 also classify the new store
in `lib/supabase/migration-inventory.ts` (every Firestore collection carries a migrate / exclude /
review classification there) and, for a Supabase table in the Raya AI scope, add a Prisma model. Then
re-run the harvester (first mode only) so this catalogue picks the new store up, and add a subsection
here with its four header lines.

## Coverage

Refreshed 2026-10-18 against HEAD `424fdb8` (branch `feature/temple-portal-knowledge-base`).

- **Firestore collections in M11: 63. Catalogued here: 64.** All 63, plus `chat_messages`
  (`services/ai-analytics.service.ts:635`, resolved from `COLLECTIONS.CHAT_MESSAGES` at `:51`),
  which M11 mentions only as an index name and not as a collection. No Firestore collection was
  added since 2026-09-19; four lost their last call site (`articles`, `messages`, `trust`,
  `ai_unknown_questions`) and keep their subsection, marked "no code".
- **Supabase tables: 24 of 24** (21 on 2026-09-19), every one parsed from its `CREATE TABLE` in
  `supabase/migrations/`. New: `settings_documents` (2026-09-22), `ai_settings` (2026-10-12),
  `ai_knowledge` (2026-10-13). `ALTER TABLE` changes to four existing tables were applied by hand.
- **Prisma:** `prisma/schema.prisma` and `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql`
  (with `prisma/migrations/migration_lock.toml`) are described under "Supabase tables" as a typed
  mirror of nine tables, not as a third store - no application code imports `lib/prisma.ts`.
- **Fields catalogued: 1095 rows** - 782 Firestore field rows (735 in the 64 collection tables, 47 in
  the per-document tables) and 313 Supabase column rows across the 24 table tables. Those rows are the
  union of the 2026-10-18 harvest (676 entries in `.claude/state/inventory/fields.json`: 628 across the
  60 stores with a call site, plus 48 in the five per-document buckets `settings/aboutUs`,
  `settings/facilities`, `settings/futurePlans`, `settings/trustCommittee`,
  `guruParampara/aaradhanaes` - `settings/ai` dropped out) with 237 parsed TypeScript interfaces and 24
  parsed `CREATE TABLE` statements, plus hand-added cells for the REST-helper and loop-variable writers
  the harvester cannot see. Orphan counts are quoted over the 628.
- **Files (M16 universe = every file the harvest attributes to a store, every `types/` file with a
  parsed interface, every migration, the Prisma schema, the rules, the indexes and the ETL mappers):
  filesExpected 193, filesMentioned 173** (counted by script after the refresh). The 20 not mentioned
  are 8 `types/` files whose interfaces describe no stored document (`types/dashboard.ts`,
  `types/shlokas.ts`, `types/temple.ts`, ...) and 12 seed / check scripts and pages whose only store
  access is already catalogued through another file (`scripts/seed-sevas.js`,
  `scripts/check-firestore-sevas.ts`, `app/admin/test-firebase/page.tsx`, ...).
  Every file added to or deleted from the M16 scope since 2026-09-19 is mentioned: the two new
  diagnostics `scripts/check-collisions.ts` (fs `aaradhanes`) and `scripts/diagnostic-sevaBookings.ts`
  (fs `sevaBookings`), `scripts/read-firestore-counts.ts`, `scripts/migrate-staged-phase1.ts`,
  `scripts/migrate-seva-bookings-to-supabase.ts`, `scripts/seed-ai-settings-supabase.ts`,
  `app/actions/settings.ts`, `supabase/config.toml` and its `supabase/.gitignore` (local CLI state
  only: `.branches`, `.temp`, `.env`), the nine new migrations, and the two deleted files
  `lib/ai/firebaseChat.ts` and `lib/ai/settings.ts` (described as absent on purpose).
- **Stores with no call site anywhere** - subsection present, table empty by design: `futurePlans`,
  `trustCommittee`, `knowledge_articles`, `knowledge_categories`, `panchanga`, Firestore
  `temple_areas`, and since 2026-10 `articles`, `messages`, `trust`, `ai_unknown_questions`. Nine
  Supabase tables have a schema and no app code; three more are script-only. They are named in the Index.
- **32 anchors could not be resolved** (30 on 2026-09-19; `.claude/state/inventory/fields.json` key `unresolvedAnchors`).
  The 2026-09-19 set is unchanged in kind: `.from(...)` / `.doc(...)` calls on things that are not
  databases, plus loop variables in the three older `scripts/migrate-*-to-supabase.ts` files. The new
  ones are loop variables in `scripts/migrate-settings.ts:150,176,181`,
  `scripts/migrate-staged-phase1.ts:337,376,385`, `scripts/verify-supabase-migrations.ts:87,150`,
  `scripts/read-firestore-counts.ts:70`, `scripts/dump-firestore-staged.ts:58` and
  `scripts/diagnose-supabase-connectivity.ts:113`; the tables behind them are catalogued.
- **Not scanned:** `tests/`, `apps/mobile/` (see Portability), `data/panchanga/**` (730 files -
  counted, not opened, per RULES.md), `node_modules`, `generated/prisma` (git-ignored, absent), and
  every binary file. A field used only in a test does not appear here.
- **Path check:** every `path:line` in this file was extracted by script on 2026-10-18 and checked
  for existence and line range against disk; paths described as deleted are the only misses, on
  purpose.

## UNCLEAR

Status re-checked 2026-10-18. Two of the nine 2026-09-19 entries are resolved; four new ones added.

- ~~**Where the `ai_settings` blocks really belong in `.claude/state/inventory/fields.json`.**~~
  **RESOLVED 2026-10-18.** `lib/ai/ai-settings/repository.ts` no longer touches Firestore at all
  (Supabase `ai_settings` and `unknown_questions` only, commit `fae5d51`), so the harvester now files
  every block under the `ai_settings` table and nothing leaks into `unknown_questions`.
 ~~**Whether the `receiptSevas` writes are correctly attributed.**~~ **RESOLVED by verification
  2026-10-18.** They are: `RECEIPT_SEVAS_COLLECTION = "sevas"` in both
  `app/api/admin/receipt-sevas/route.ts:13` and `app/api/admin/receipt-sevas/[id]/route.ts:12`, so the
  writes at `:75` and `:55` really go to `sevas`. The earlier "they target `receiptSevas`" was wrong;
  the consequence is fault F-23.
- **What is actually stored in `timings`.** Read by `lib/ai/retrieval/settings.ts:107` and written by
  nothing, so its real field set is whatever a one-off seed left behind. Settled by one
  `npm run firestore:dump` (or the new read-only `scripts/read-firestore-counts.ts` for presence) and
  looking at the documents. (`trust` dropped out of this question: nothing reads it any more.)
- **Whether `settings/config` and the billing settings document are distinct.**
  `services/proof-report/database-export.service.ts:85` reads `settings/config`;
  `app/admin/billing/settings/page.tsx:75-78` writes a settings document whose id comes from a
  variable the harvester could not resolve. Settled by opening that page and following the constant.
- **Which `temple_areas` migration is live** - the `uuid`-PK one
  (`supabase/migrations/20240523000000_create_temple_areas.sql:2`) or the `text`-PK one
  (`supabase/migrations/20240915_create_temple_areas.sql:2`). Both use `IF NOT EXISTS`. Inherited
 from M11; settled by describing the table against the live project, or by
  `scripts/verify-supabase-migrations.ts`. Clue: `scripts/seed-temple-areas-supabase.ts:44`, `:48`,
  `:57` upserts slug ids (`area.name` lower-cased and hyphenated) into `id`, which succeeds only
  against the `text`-PK definition - if that seed ever ran cleanly, the `text` one is live.
- ~~**Whether any Supabase migration has ever been applied.**~~ **RESOLVED 2026-10-18.**
  `supabase/config.toml` now exists, CI pushes migrations
  (`.github/workflows/supabase-migrations.yml:68-69`), and two ledger-marker migrations state that
  their versions are already recorded in the remote `supabase_migrations.schema_migrations`
  (`supabase/migrations/20261006101759_seed_ai_settings.sql:3-7`,
  `supabase/migrations/20261015000000_baseline_raya_ai.sql:3-9`). Which of the nine schema-only
  tables actually hold rows is still open (see the last entry).
- **Whether deny-all RLS is live on the tables the app reaches with the anon key.** On 2026-09-19
  this was `events` only (`services/event.service.ts:46-123` against
  `supabase/migrations/20260907112632_create_core_tables.sql:98`). Since 2026-10 the same question
  decides whether chat history persists at all (`chat_sessions` / `chat_messages`, fault F-11) and
  whether any browser-side AI-settings, knowledge or analytics read returns rows. Settled by one
  anon-key select per table against the project.
- **Field types for the 19 typeless collections.** Everything marked `?` inferred is a name, not a
  type; the harvester cannot tell a `string` from a `Timestamp` from a `number`. Settled by a dump
  plus one pass over sampled documents, or by writing the missing interfaces into `types/`.
- **Whether `articles`, `ai_unknown_questions`, `chat_messages`, `futurePlans`, `trustCommittee`,
  `knowledge_articles` and `knowledge_categories` hold any live data** (and, new, `messages` and
  `trust`, which lost their last reader). `data/firestore-dump/README.md:52` in the 2026-09-19 snapshot
  suggests several are empty, but that probe was cut short by the quota wall - and the README was
  never committed, so it is absent from this clone (`.gitignore:38` un-ignores it; nobody added it). Settled by the next clean dump.
- **New - whether Firestore `ai_settings/main` still exists.** If it does, fault F-13 silently turns
  off every AI analytics writer (`services/ai-analytics.service.ts:57-77`). Settled by one document
  read, or by `scripts/read-firestore-counts.ts` (it lists `ai_settings` at `:33`).
- **New - whether `scripts/migrate-ai-knowledge.ts` has been run against production.** If not,
  `ai_knowledge` is empty and Raya AI answers only from `SEED_ARTICLES`
  (`lib/ai/knowledge/repository.ts:90-95`), ignoring every article in Firestore `knowledge`.
  `docs/BOT_002_KNOWLEDGE_MIGRATION_REPORT.md` is a claim, not evidence. Settled by
  `select count(*) from ai_knowledge`.
- **New - what the mobile app's `website_settings` is.** `apps/mobile/lib/api.ts:49-51` queries a
  table `website_settings` with columns `key` and `value`; no migration creates it. Either it lives
  only in the live project (created by hand) or the mobile settings screen always errors. Settled by
  one select against the project.
 ~~**New - whether `lib/ai/generator.ts` is still on a live path.**~~ **RESOLVED by verification
  2026-10-18: it is live.** `app/api/chat/route.ts:162` calls `generateResponse` (re-exported by
  `lib/ai/index.ts:23` from `lib/ai/generator.ts:48`) whenever hybrid mode is on, which is the default
  (`app/api/chat/route.ts:34`, `AI_HYBRID_MODE !== "false"`). So Firestore `unknown_questions` still
  receives low-confidence questions (`lib/ai/generator.ts:73` -> `services/analytics.service.ts:31`)
  when `enableUnknownQuestionLogging` is on, and the analytics page's unknown panel is not frozen -
  it just sees a different subset from the Supabase triage console (F-12, F-15).

## Verification log (2026-09-19)

Adversarial pass against the code. Method: 1299 `path:line` citations extracted and existence- and
range-checked by script; 1176 field-table citations re-checked against a window of the cited file;
45 declared Firestore types re-parsed and diffed field-by-field against their tables; all 21
Supabase tables re-parsed from `CREATE TABLE` and diffed against their column tables; the
collection/table list diffed against M11; 64 field rows opened by hand across 25 stores, weighted
to `sevaBookings`, `donations`, `sevas`, `receipts`, `users`, `events`, `announcements`,
`galleryMedia`, `temple_areas`; 12 orphan claims and 5 doc-mismatch rows re-tested by grep.

What survived: the 63 + 1 / 21 store list, all 45 type diffs (zero discrepancies), all 21 Supabase
column lists (zero discrepancies), the 607 = 167 + 86 + 354 orphan arithmetic, every index and rule
citation checked, and 0 broken paths. What did not:

- Index legend claimed `F` = fields catalogued -> now states `F` is the *harvest* count on Firestore
  rows (sums to 584 against 844 table rows) and the column count on Supabase rows (277) - evidence:
  counted both, `.claude/state/inventory/fields.json` bucket sizes.
- Supabase Index rows showed non-zero `W`/`R` beside "schema only, no app code" -> caution added
  naming the twelve tables with no `.from("<table>")` anywhere - evidence: grep, 0 hits each.
- "entry *n*" of `firestore.indexes.json` was undefined -> stated as the zero-based array position -
  evidence: `entry 0` = `users` `role`+`createdAt`, `firestore.indexes.json` index 0.
- `volunteer_requests.approved` was listed as a field and as a real bug -> **refuted and struck**:
  `app/admin/content/page.tsx:98` is a `testimonials` count, `volunteer_requests` is counted
  unfiltered at `:99`, and `pendingVolunteers` is hard-coded `0` at `:114`.
- `announcements.active` cited `app/admin/content/page.tsx:168` -> removed; `:168` queries `events`.
  Same for `announcements.title` at `:180` and the `announcements.date` row at `:90`.
- `sevas.price` "the AI gets `undefined`" -> refuted: `lib/ai/firebaseChat.ts:111` is
  `data.price || data.amount || ""`, so the AI gets the amount. Reclassified as harmless.
- `users.templeId`, `.profileImage`, `.isApproved` listed as "no reader anywhere" -> refuted: read
  at `services/auth.service.ts:106-108` and `lib/auth.ts:104-106` on every login. Row narrowed to
  `uid`, `lastLogin`, `emailVerified`; the sharper true claim (nothing branches on `isApproved`)
  kept.
- `page_views.visitorId` listed as "never queried or aggregated" -> refuted:
  `services/pageviews.service.ts:126-129` folds it into the unique-visitor set. Row narrowed to
  `date`.
- `galleryMedia.caption` listed with `url`/`imageUrl` as a broken read -> split: `caption` falls
  back to `title`, a real field (`app/admin/media/page.tsx:89`); only the thumbnail URL is blank.
- sb `temple_areas` showed **no writes** -> added: `addArea` (`services/temple-areas.supabase.service.ts:102-120`),
  `updateArea` (`:129-149`) and `deleteArea` (`:161-162`), all on the service-role client. This is
  the repository's only complete Supabase CRUD and the builder's harvest missed all of it.
- `receipts` showed every field as "declared, **no call site**" -> all fourteen writes filled in
  from `lib/receipt/admin.ts:121-136` (set at `:139`). `emailDelivery` / `whatsappDelivery` are
  confirmed absent from that payload, so no receipt on disk carries delivery state.
- New fault: `app/api/admin/receipts/route.ts` combines `where("sevaIds","array-contains")` (`:55`)
  with `orderBy("createdAt")` (`:39`) and `firestore.indexes.json` has no `receipts` entry, so
  filtering receipts by seva throws `FAILED_PRECONDITION`.
- "Collections with no TypeScript type (18)" listed 19 names and the arithmetic below it read
  9 - 2 + 11 -> corrected to **19** everywhere (heading, summary table, UNCLEAR) and to
  "Twelve collections M11 did not name"; 19 is also the count of Firestore rows carrying **none**
  in the Index.
- New blind spot documented: `app/admin/content/page.tsx` is an array with one collection per line,
  so the harvester window spills a line either way; the verified per-line attribution is now listed
  in the "What it cannot see" list.
- M11 cites `services/temple-areas.supabase.service.ts:15,38,62` for the reads; the `.from()` calls
  are at `:16,39,63,81`. M16 was right, M11 is off by one. Not corrected here - not my file.

**Regeneration caveat.** Eleven of the corrections above are inside `<!--FIELDS-->` / `<!--COLUMNS-->`
/ Index blocks, which `node .claude/state/inventory/fields.mjs --expand <this file>` rewrites from
`.claude/state/inventory/fields.json`. Re-running `--expand` will discard them, because the
underlying harvest is what was wrong. Fix `.claude/state/inventory/fields.mjs` first (per-line
anchor scoping for array literals; follow `const x = {…}; .insert(x)` and `obj.k = v` assignment
payloads) or re-apply this log by hand afterwards.

## Refresh log (2026-10-18)

Refresh of the 2026-09-19 catalogue against the code at `424fdb8` (Sunday 2026-10-18), by diffing
the read-only snapshot `D:\Onboarding\Repos\POCs\General Purpose POCs` against this clone. M16 has no
`perModule` entry in `.claude/state/delta/2026-10-18/delta.json` and no `.claude/state/inventory/M16.json`
(UNCLEAR below), so the M16 delta was rebuilt by script: every file the old or new harvest attributes
to a store, plus `types/`, `supabase/`, `prisma/`, `firestore.rules` and `firestore.indexes.json`,
compared with line endings normalised - **21 added, 2 deleted, 26 modified** (49). The harvester was
re-run in its first mode only; `--expand` was run on a scratch copy and rows were copied across by
hand, per the Verification log. about 238 citations into moved lines were re-pointed by a diff-based line
map; every citation into a changed line was re-read and rewritten.

What changed (was -> is -> evidence):

- AI settings store: Firestore doc `ai_settings/main` -> Supabase table `ai_settings`, one jsonb column per block, plus new `general` / `safety` / `extendedBehavior` blocks -> `lib/ai/ai-settings/repository.ts:41-154`, `lib/ai/ai-settings/admin-repository.ts:39-139`, `supabase/migrations/20261012000000_create_ai_settings_table.sql:3`, `types/ai-settings.ts:340-354`. New sb `ai_settings` subsection; fs `ai_settings` rewritten as legacy.
- Knowledge store: Firestore `knowledge` read by the AI -> Supabase `ai_knowledge` read by the AI, Firestore still written by the admin routes -> `lib/ai/knowledge/repository.ts:16`, `app/api/admin/knowledge/route.ts:102`. New sb `ai_knowledge` subsection, fs `knowledge` rewritten, fault F-14.
- Chat persistence: Firestore `chat_sessions` + `messages` -> Supabase `chat_sessions` + `chat_messages` (summary and messages); `services/conversation.service.ts` still uses Firestore `chat_sessions` -> `services/chat.service.ts:7-166`. fs `messages` marked no-code; fs/sb chat subsections rewritten; fault F-11.
- Unknown questions: Firestore `unknown_questions` + `ai_unknown_questions` written by four callers -> Supabase `unknown_questions` written by three callers, Firestore by one legacy caller -> `lib/ai/unknown-logger.ts:28-43`, `services/ai-analytics.service.ts:194-262`, `services/analytics.service.ts:31`. fs `ai_unknown_questions` marked no-code; fault F-15.
- AI analytics (`ai_latency_records`, `ai_intent_distribution`): "Firestore write / Supabase read through the anon client, written by nobody" -> both written and read in Supabase, server-side through the service-role client -> `services/ai-analytics.service.ts:133-146`, `:169-182`, `:322-353`, `:370-403`. The old "written by nobody" claim was already wrong on 2026-09-19 and is withdrawn.
- Admin AI screens: read the same stores as the writers -> still read Firestore after the writers moved -> `app/admin/ai/analytics/page.tsx:305-333`, `app/admin/ai/page.tsx:96`. Fault F-12.
- Analytics kill-switch: not recorded -> `getAnalyticsSettings()` casting the legacy Firestore `ai_settings` doc can disable every analytics writer -> `services/ai-analytics.service.ts:57-77`. Fault F-13 (pre-existing).
- `lib/ai/firebaseChat.ts` and `lib/ai/settings.ts`: live readers of `trust`, `chatTraining`, `sevas.price`, `events`, `settings/ai` -> deleted (commit `2891323`) -> struck in fs `trust`, `chatTraining`, `sevas`, `events`, `settings`; F-04 and F-20 FIXED; `chatTraining` now write-only (F-21).
- `articles`: seed-script-only Firestore collection -> no code; the seed script writes Supabase `ai_knowledge` -> `scripts/seed-ai-knowledge.ts:94-106`.
- `LatencyRecord.messageId` / `.intent`: required, in no store -> optional with a deprecation comment -> `types/ai-analytics.ts:30,36`. F-08 FIXED (commit `edecabc`).
- `site_settings` writer: `services/settings.service.ts` with the service-role client -> server actions with Zod validation and an admin check -> `app/actions/settings.ts:38-117`.
- New sb `settings_documents` (JSONB copy of every non-site, non-social `settings/*` document) -> `supabase/migrations/20260922000000_create_settings_documents.sql:17`, `lib/supabase/migration-mappers.ts:837-851`.
- sb `seva_bookings`: schema only, `seva_id uuid` blocks the ETL -> script-populated, `seva_id text`, unique index on `firestore_id` -> `supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql:23-54`, `scripts/migrate-seva-bookings-to-supabase.ts:94-115`.
- sb `donations.campaign_id`, `gallery_media.album_id`: `uuid` -> `text` with indexes -> `supabase/migrations/20261002000000_align_content_firestore_ids.sql:18-45`.
- sb `events`: `description` / `location` / `status` NOT NULL -> nullable; staged ETL writes it -> `supabase/migrations/20261011000000_alter_events_nullable.sql:3-6`, `scripts/migrate-staged-phase1.ts:329`.
- sb `chat_sessions` note: "`message_count` is absent from the CREATE TABLE" -> it is present -> `supabase/migrations/20260930000000_create_ai_tables.sql:8`. Claim corrected.
- fs `page_views` note: "`visitorId` is written but never queried" -> folded into the unique-visitor set -> `services/pageviews.service.ts:126-129`. Internal contradiction with the 2026-09-19 Verification log corrected.
- Supabase apply path: "no `supabase/config.toml`, no CI push, maybe never applied" -> config, CI push and remote-ledger markers exist -> `supabase/config.toml:3`, `.github/workflows/supabase-migrations.yml:68-69`, `supabase/migrations/20261006101759_seed_ai_settings.sql:3-7`. UNCLEAR resolved.
- Future-dated migrations: four -> none; the newest is `supabase/migrations/20261015000000_baseline_raya_ai.sql`.
- Prisma: absent -> `prisma/schema.prisma` mirrors nine Supabase tables; `lib/prisma.ts` exists but no app file imports it -> not added as a third store kind, described under "Supabase tables" -> grep for `lib/prisma` in `app/ lib/ services/ hooks/ components/`: 0 importers.
- `docs/SUPABASE_DATABASE_SCHEMA.md`: "labels `settings` Legacy / Not Required" -> has a settings / `settings_documents` section; new drift: `events` nullability and the two AI tables -> `docs/SUPABASE_DATABASE_SCHEMA.md:56-59`, `:104-121`, `:334-350`. Also corrected the 2026-09-19 claim that it "never mentions `bills` or `knowledge`" (it names both at `:20`, `:24`).
- `firestore.indexes.json` entry 21: `approved` + `category` + `title` -> the same plus `__name__` (commit `2ec7d3a`); entries 14, 15 and 21 now index collections no reader queries.
- `lib/ai/retrieval/settings.ts`: nested `morning.open` timings -> flat `morningOpen`...`eveningClose` -> `lib/ai/retrieval/settings.ts:81-86`, `:114-119`.
- Harvester notes: two new blind spots documented (REST-helper / loop-variable writers, `ALTER TABLE`); the `lib/ai/ai-settings/repository.ts` leak and the twelve-table grep updated; unresolved anchors 30 -> 32.
- Index: `F`/`W`/`R` regenerated from the new harvest; migration-state column rewritten for 21 rows; three sb rows added (88 rows).
- Orphans: 607 / 167 / 86 / 354 -> 628 / 193 / 74 / 361; status added to every row of both orphan tables.
- Faults: new "Faults (status 2026-10-18)" section with ids F-01 to F-22. FIXED: F-04, F-08, F-10, F-20. STILL OPEN: F-01, F-02, F-03, F-05, F-06, F-07, F-09, F-16, F-17, F-18, F-19. NEW: F-11, F-12, F-13, F-14, F-15, F-21, F-22.
- Portability: no mobile consumer -> `apps/mobile` reads Supabase `sevas`, `events`, `daily_poojas`, `gallery_albums` (+`gallery_media`) and a non-existent `website_settings` with the anon key -> `apps/mobile/lib/api.ts:3-56`. New "Portability notes" section.
- Coverage: 64 Firestore collections / 21 tables / 1121 rows -> 64 / 24 / 1095 rows; filesExpected 193, filesMentioned 173.
- Modified with no store impact, checked and left alone: `types/festival.ts` (countdown "is today" logic), `hooks/useHomepage.ts` and `app/admin/featured/page.tsx` (an `eslint-disable` header shifted every line by one - re-pointed), `services/testimonial.service.ts` (whitespace), `scripts/migrate-sevas.ts` / `scripts/migrate-daily-poojas.ts` (dry-run exit code), `lib/auth/admin.ts` (real ID-token verification), `types/temple-explorer.ts` (`AccessibilityInfo`, static data only).

Commits that drove the biggest changes: `fae5d51` (AI settings to Supabase, 2026-10-06), `fdaff98` /
`c586d6c` (AI knowledge to Supabase, 2026-10-06), `224875d` (chat to Supabase, 2026-10-06), `3d0d3b2` /
`edecabc` / `2cd44c7` (BOT-004 analytics migration, 2026-10-13), `2891323` (deleted
`lib/ai/firebaseChat.ts` and `lib/ai/settings.ts`, 2026-10-14), `2e8f0b1` (Prisma baseline,
2026-10-15), `549dfed` / `d71898d` (seva_bookings ETL and `seva_id` widening, 2026-09-21), `c46c706`
(staged Phase 1 migration, 2026-09-28), `0cb71b6` (mobile app, 2026-09-30).

UNCLEAR from this refresh:

- UNCLEAR: the dispatch names "39 changed files listed under perModule.M16", but `.claude/state/delta/2026-10-18/delta.json` has no
  `perModule.M16` key and there is no `.claude/state/inventory/M16.json`; `.claude/state/chunks.json`
  has no M16 chunk either. The 49-file delta above was computed independently, so the counts will not
  match the orchestrator's 39.
- UNCLEAR: whether F-11 and F-18 bite depends on whether RLS is actually enabled in the live project;
  F-13 depends on whether Firestore `ai_settings/main` exists. Both need one live read each.
- UNCLEAR: `.claude/state/inventory/fields.json` is regenerated but still says `"generated":
  "2026-09-19"` because the date is a literal in `.claude/state/inventory/fields.mjs:456`; not fixed
  here (not an output path of this brief).

## Verification log (2026-10-18)

Skeptic pass on the 2026-10-18 refresh, against the clone (app code at `424fdb8`; branch HEAD
`43361a3` adds only knowledge-base docs). Method: 1830 distinct backtick `path` / `path:line`
citations extracted by script and checked for existence and line range (11 misses, all deliberate:
the two deleted `lib/ai/*` files, the never-committed `data/firestore-dump/README.md`, the absent
`.claude/state/inventory/M16.json`; 0 past end of file); 31 claims opened by hand, weighted to the
Refresh log and the Faults section; all 22 fault rows re-opened; the harvest file list diffed against
the files this brain names. Report: `.claude/state/verify/M16-2026-10-18.md`.

- F-11 said every browser-side select on the deny-all tables returns no rows, and listed
  `lib/ai/knowledge/repository.ts:62` -> now excepts approved `ai_knowledge` reads ->
  `supabase/migrations/20261013000000_create_ai_knowledge.sql:30-34` is a public SELECT `USING (approved = true)`.
- F-12 said all admin AI figures "freeze at their pre-migration values" -> only the message total
  (always 0) and the intent / latency panels freeze; conversation counts and the unknown panel keep
  moving on the Firestore half -> `services/conversation.service.ts:112`, `:161` called at
  `app/api/chat/route.ts:183`; `lib/ai/generator.ts:73` reached from `app/api/chat/route.ts:162`.
- UNCLEAR "is `lib/ai/generator.ts` live?" -> RESOLVED, live by default -> `app/api/chat/route.ts:34`,
  `:162`; `lib/ai/index.ts:23`.
- UNCLEAR "`receiptSevas` writes misattributed; the routes target `receiptSevas`" -> REFUTED, the
  routes write `sevas` and the harvest was right; fs `receiptSevas` and fs `sevas` notes corrected ->
  `app/api/admin/receipt-sevas/route.ts:13`, `app/api/admin/receipt-sevas/[id]/route.ts:12`, `lib/receipt/admin.ts:32`.
- New fault F-23 (low, pre-existing): `receiptSevas` is seed-only and unread; its validating rule guards
  nothing; receipt-book sevas share the public `sevas` catalogue -> evidence as above plus
  `scripts/seed-receipt-sevas.ts:16`, `firestore.rules:85-100`.
- "Supabase apply path ... on CI" and How-to step 6 "CI applies it" -> the workflow is manual
  (`workflow_dispatch` only), as is the Prisma drift gate -> `.github/workflows/supabase-migrations.yml:6-7`,
  `.github/workflows/prisma-baseline-drift-gate.yml:21-22`.
- How-to step 5 "entries 14, 15 and 21 now index collections no reader queries" -> "declare index
  shapes no query uses"; `knowledge` is still queried -> `app/api/ai/knowledge/import/route.ts:74`,
  `app/api/ai/knowledge/coverage/route.ts:82`; `chat_sessions` is still counted at `app/admin/page.tsx:107`.
  (The same wording in the Refresh log is left as written; this line supersedes it.)
- How-to step 2 called `services/sevaBooking.service.ts:36` and `app/api/admin/receipt-sevas/route.ts:75`
  "explicit literals" -> the first is a spread; the second spreads a five-key sanitizer, which is
  where a new key must go -> `lib/receipt/validation.ts:123-133`.
- How-to step 4 now notes that no app code writes `receiptSevas` and the receipt routes use the Admin
  SDK (rules bypassed) -> `app/api/admin/receipt-sevas/route.ts:74`.
- Coverage: `lib/firebase.ts` (222 lines, harvested under `events`) was unmentioned -> one line added to
  fs `events`: `getNextUpcomingEvent` at `lib/firebase.ts:156` reads Firestore `events` and has no caller.
- Coverage: `scripts/seed-temple-areas-supabase.ts` (72 lines) was unmentioned -> added as a clue to the
  `temple_areas` UNCLEAR: it upserts slug ids, valid only against the `text`-PK migration ->
  `scripts/seed-temple-areas-supabase.ts:44`, `:48`, `:57`.

Survived unchanged: the 64 / 24 store list (24 distinct `CREATE TABLE` names across 17 migration
files); the `ai_settings` and `ai_knowledge` column tables (15 and 14 columns, diffed against the SQL);
the Prisma claim (nine `@@map` models, 0 importers of `lib/prisma.ts`); the orphan arithmetic
628 / 74 / 361 (re-computed from `.claude/state/inventory/fields.json`); F-01 to F-03 and F-05 to F-09,
F-13 to F-19, F-21, F-22 at their cited lines; F-04, F-08, F-10, F-20 FIXED; `firestore.rules`
identical to the 2026-09-19 snapshot apart from line endings. Not changed, noted only: every `uuid`
primary key shows `nullable: yes` in the column tables (harvester convention - `PRIMARY KEY` implies
NOT NULL), while sb `ai_settings` hand-writes `NOT NULL (PK)`.
