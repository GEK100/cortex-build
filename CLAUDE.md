# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Next.js dev server
npm run build     # Runs `prebuild` (esbuild compiles src/workers/sw.ts → public/sw.js) then `next build`
npm run start     # Production server
npm run lint      # ESLint (next lint)
```

No test suite is configured. There is no separate TypeScript type-check script — `strict` TS is enforced by `next build`. `src/workers` and `scripts` are excluded from the main `tsconfig.json` compile (the service worker is bundled separately by `scripts/build-sw.ts`).

Database changes are applied by running SQL files manually in the Supabase SQL Editor (EU West / London). Migrations live under `supabase/migrations/` and must be applied in filename order. `src/lib/db/schema.sql` (referenced by the README setup flow) mirrors the initial migration and must be kept in sync for first-time setup.

Required env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. After creating the Supabase project, also create a **private** Storage bucket named `captures`.

## Architecture

Cortex is a private, **single-user** voice-first PWA for construction project intelligence. The full rationale for every major decision is in `DECISIONS.md` (AD-001..AD-013); read it before proposing architectural changes. Key invariants below are disclosure-grounded — they are not stylistic choices.

### Single-user hard gate (AD-001)
The only authorised email is `ALLOWED_EMAIL` in `src/lib/config.ts` (currently `gareth@ictusflow.com`). Two independent checks enforce this:
1. `src/middleware.ts` redirects non-matching sessions to `/login?error=restricted`.
2. Every API route must call `assertAuthorisedUser()` from `src/lib/auth/guard.ts` — it throws a `Response` (401/403) that the route's `try/catch` re-returns. RLS is additionally enabled on every table.

### Three Supabase clients (do not mix them up)
- `src/lib/supabase/client.ts` — browser client (anon key).
- `src/lib/supabase/server.ts` — server client for route handlers / server components (anon key + cookies).
- `src/lib/supabase/admin.ts` — **service-role** client that bypasses RLS. Used only for (a) audit log writes and (b) the extraction pipeline reading/writing across `events`, `entities`, `event_labels`, `extraction_results`. Never import into client code.

### Events are the atomic unit (AD-003, AD-005)
Every capture (voice / text / photo / email) is one row in `events`. All downstream data (`event_labels`, `entities`, `event_entities`, `extraction_results`) joins back to an event. Classification is **multi-label** — a single event can be simultaneously an `rfi`, `commitment`, and `risk`. The 11 label types and 6 entity types are the `LABEL_TYPES` / `ENTITY_TYPES` consts in `src/lib/extraction/ontology.ts` and the Postgres enums in the schema — these must be kept in lockstep.

### Immutability of raw capture (AD-004)
`raw_content`, `photo_caption_raw`, and `ocr_text` are claims-defensible evidence. Immutability is enforced at **three** layers:
1. Database trigger `enforce_raw_immutability()` — any UPDATE that changes these columns raises `restrict_violation`. `ocr_text` is a special case: NULL → value is allowed once, then locked.
2. The pattern `raw_content` + `edited_content` (same for photo captions) — corrections live alongside, never overwrite.
3. There is **no hard delete**. Deletion is `is_deleted = true`. Do not add a DELETE policy or route.

When writing migrations or server code that touches these tables, the trigger will reject updates that attempt to mutate raw fields — surface this as a genuine error, do not work around it.

### Audit log is append-only (AD-007)
`audit_log` has no INSERT policy for authenticated users. All writes go through `writeAuditLog()` in `src/lib/audit/log.ts`, which uses the service-role client. Calls are intentionally fire-and-forget — an audit failure logs to console but never blocks the parent operation. Every mutating API route should write one entry.

### Capture → extraction flow
1. Client calls `POST /api/events` (or `POST /api/upload` first for audio/photo blobs, then `/api/events` with the returned URL).
2. `POST /api/events` dedupes on `offline_id`, inserts the row, writes an audit log entry, then **fires `POST /api/extract` asynchronously** (fetch-and-forget, forwards the session cookie).
3. `/api/extract` runs `runExtraction()` (`src/lib/extraction/extract.ts`) → Anthropic Sonnet call with `EXTRACTION_SYSTEM_PROMPT` → Zod validation via `extractionResultSchema` → `writeExtractionResults()` (`src/lib/extraction/persist.ts`) which upserts labels, entities, junctions, the `extraction_results` row, and flips `events.extraction_status` to `complete`.
4. Voice events go through `/api/transcribe` (OpenAI Whisper, WebM/Opus per AD-008/AD-009) before extraction. Photo events fetch the image from Storage and include it as a base64 image block in the Sonnet message.

### Offline-first capture
The offline path is bespoke — do not reach for `next-pwa` or Serwist (AD-010).
- `src/lib/offline/db.ts` — IndexedDB schema (`cortex-offline`, store `pendingEvents`), opened via `idb`.
- `src/lib/offline/queue.ts` — `enqueueCapture()` writes to IDB and registers a `sync-captures` background-sync tag; `flushQueue()` iterates pending rows, transcribes voice if needed, POSTs to `/api/events` with the IDB `id` as `offline_id` for server-side dedupe, then deletes on 2xx.
- `src/lib/offline/sync.ts` — mounts `online` listener and flushes on load.
- `src/workers/sw.ts` — hand-written service worker. **Never caches `/api/*`, `/auth/*`, or `/login`.** On `sync-captures`, posts `flush-queue` to all window clients (the client owns the flush; the SW just signals).
- Build step: `scripts/build-sw.ts` runs via `prebuild` and emits `public/sw.js` (gitignored). If you edit `sw.ts`, you must rebuild before the change takes effect in dev.

### APP_NAME discipline (AD-011)
The string `"Cortex"` lives in `src/lib/config.ts` as `APP_NAME` and in rendered UI only. Do not put it in table names, route paths (`/api/cortex/...`), class names, or env var keys. A future rename should be a 5-minute job.

### Other conventions
- TypeScript path alias: `@/*` → `./src/*`.
- British English in code comments and user-facing copy (see schema comments, `canonical_name`, `organisation`).
- UTC for all timestamps (`timestamptz`, `created_at default now()`).
- Light mode only — no dark mode toggle, no `prefers-color-scheme` (AD-012).
- No pgvector / embeddings yet (AD-013) — search is a later phase.
