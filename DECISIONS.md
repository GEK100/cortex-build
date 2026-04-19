# Architecture Decisions

Disclosure-ready log of every architectural decision with date and rationale.

---

## AD-001: Single-user auth with hard email check
**Date:** 2026-04-19
**Decision:** Auth is restricted to a single email (gareth@ictusflow.com) via hard check in middleware and API guard. No multi-tenancy.
**Rationale:** Cortex is a personal operating instrument, not a team tool. Single-user simplifies RLS, eliminates permission complexity, and keeps the security perimeter clean. If another PM needs Cortex, they get their own instance.

## AD-002: Supabase EU (London) region
**Date:** 2026-04-19
**Decision:** Supabase project hosted in EU West (London/Dublin).
**Rationale:** Data sensitivity — The Ritz has royal/political guests. UK/EU data residency is a genuine requirement, not a preference.

## AD-003: Events as the atomic unit
**Date:** 2026-04-19
**Decision:** One capture (voice, text, photo, email) = one event row. All derived data (labels, entities, extractions) link back to events.
**Rationale:** Simplest possible data model. Every view is a query over events. Every feature that matters (timeline, actions, stakeholders) is a projection of events.

## AD-004: Raw content immutable, edits alongside
**Date:** 2026-04-19
**Decision:** `raw_content` field is never updated after creation. Corrections live in `edited_content`. Same pattern for photo captions (`photo_caption_raw` / `photo_caption_edited`).
**Rationale:** Claims-defensibility. If Gareth ever needs to prove what was said, the original transcript is the evidence. Edited versions are clearly marked as corrections.

## AD-005: Multi-label extraction, not single-bucket classification
**Date:** 2026-04-19
**Decision:** Every event is assessed against all 11 label types independently. Zero, one, or many labels may apply.
**Rationale:** A voice note about a meeting where Tom committed to deliver drawings and flagged a risk is simultaneously a meeting_note, a commitment, and a risk. Single-bucket would force a choice and lose information.

## AD-006: Entities as single table with type discriminator
**Date:** 2026-04-19
**Decision:** One `entities` table with `entity_type` enum (person, organisation, trade_package, location, drawing, document), not separate tables per type.
**Rationale:** Cross-type queries (e.g. "show me everything related to Tom and Acme Plumbing") become simple joins. Separate tables would require unions.

## AD-007: Audit log append-only via service role
**Date:** 2026-04-19
**Decision:** `audit_log` table has no update or delete policies. All writes go through the service-role client, bypassing RLS. Authenticated users can read their own logs.
**Rationale:** Disclosure-ready from day one. The audit trail cannot be tampered with by the client.

## AD-008: OpenAI Whisper API for transcription
**Date:** 2026-04-19
**Decision:** Use OpenAI's hosted Whisper API (whisper-1 model, $0.006/min) rather than self-hosted.
**Rationale:** Single-user, low volume. Self-hosting adds infrastructure cost and maintenance for negligible benefit.

## AD-009: audio/webm;codecs=opus codec
**Date:** 2026-04-19
**Decision:** Record via MediaRecorder with WebM/Opus codec.
**Rationale:** Universal browser support. Whisper API accepts WebM directly. No transcoding needed.

## AD-010: Hand-written service worker
**Date:** 2026-04-19
**Decision:** Custom service worker compiled from TypeScript via esbuild, not next-pwa or Serwist.
**Rationale:** Offline capture queue is bespoke. Caching needs are simple. Third-party SW libraries add complexity for features we do not need.

## AD-011: APP_NAME in single config constant
**Date:** 2026-04-19
**Decision:** The string "Cortex" appears only in `lib/config.ts` as `APP_NAME` and in rendered UI. Never in table names, routes, class names, or env vars.
**Rationale:** Future rename is a 5-minute job, not a refactor.

## AD-012: No dark mode
**Date:** 2026-04-19
**Decision:** Light mode only. No dark mode toggle, no prefers-color-scheme media query.
**Rationale:** Single-user app used primarily on construction sites during daytime. Dark mode adds complexity without benefit.

## AD-013: No embeddings in week 1
**Date:** 2026-04-19
**Decision:** No pgvector, no embedding generation pipeline in v1 week 1.
**Rationale:** Search is a week 5 feature. The only Sonnet call in week 1 is the extraction pipeline. Everything else is CRUD.
