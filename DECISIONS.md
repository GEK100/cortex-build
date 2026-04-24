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

## AD-017: Actions are a separate table, not a view over `event_labels`
**Date:** 2026-04-22
**Decision:** Commitments, RFIs, and TQs that have trackable obligations get their own row in `public.actions`, with FK `source_event_id` back to the event. Actions have lifecycle state (`open`/`closed`/`disputed`/`cancelled`), `due_at`, `closed_at`, `evidence`, and owner/raised-by entity FKs. They are created by the extraction pipeline (not by direct API writes), and mutated via the intention-discriminated `PATCH /api/actions/[id]` (close/dispute/cancel/reopen/edit).
**Rationale:** AD-003 ("events as the atomic unit") holds for captured evidence — `raw_content`, photos, transcripts — but that immutability is a poor fit for obligations that change state over time. A commitment gets closed, an RFI gets answered, a TQ gets superseded. Forcing that lifecycle onto `event_labels` would require either new nullable columns that only apply to three of the eleven label types, or a sibling table anyway. Better to give actions their own home. The `source_event_id` FK keeps the evidence link intact: the action is the live tracker, the event is the claims-defensible record of when and how it was raised.

**Extraction-only creation path:** Per the build prompt's §3.11 ("Chat is a query surface, not a parallel extraction path"), the UI never writes directly to `actions`. Every action originates from the Sonnet extractor processing a voice/text/email/photo event. The UI only *mutates* existing rows — close, dispute, reopen, edit description/due. A manually-added action still flows through extraction (user captures text → extractor identifies commitment → action row created).

**Overdue is derived, not stored:** `status='overdue'` would require a clock-watcher to flip rows. `status='open' AND due_at < now()` is computed on read. Simpler and always correct.

## AD-015: Entity merge is destructive, service-role-backed, ownership-gated
**Date:** 2026-04-22
**Decision:** `POST /api/stakeholders/[id]/merge` re-links every `event_entities` junction from source to target using the admin client (bypasses RLS), unions `canonical_name` + `aliases` into the target's alias array, then hard-deletes the source entity. Fetch-and-verify with the RLS-scoped server client first establishes same-user, same-entity-type ownership; the admin client only runs after that check.
**Rationale:** The soft-delete discipline from AD-004 is about captured evidence (`events`, `raw_content`) — entities are derived data that gets regenerated from re-extraction. Keeping tombstoned duplicate entities around would bloat the stakeholder list with no evidential value. The audit log entry records before/after state for reversibility, which is the guarantee that matters here rather than soft delete.

## AD-016: Stakeholder "relationship temperature" is sentiment distribution, not synthesis
**Date:** 2026-04-22
**Decision:** The stakeholder detail page shows a raw sentiment-distribution bar across recent events (positive/neutral/mixed/negative counts) rather than the Sonnet-synthesised tone-shift read described in the build prompt.
**Rationale:** Live Sonnet synthesis on every page load is the wrong shape — it's slow, expensive, and produces different text each time, which erodes trust. Relationship temperature is agent work: the weekly reviewer (Opus, Sunday 20:00) or a dedicated nightly pass is where it belongs, writing a durable summary to the entity row or a side table. Sentiment distribution is the honest signal available from the data we already have.

## AD-014: Timeline is a day-grouped vertical feed in v1
**Date:** 2026-04-20
**Decision:** The Timeline view is a vertical, day-grouped feed on both mobile and desktop in v1, rather than the positional horizontal-scrollable layout described in the build prompt. Desktop uses the same vertical feed constrained to a readable column width.
**Rationale:** A true positional horizontal timeline (pills placed along a continuous date axis) is substantial UX work — zoom, density collapsing, edge-fade scroll affordances — for a view whose primary job in week 2 is "can Gareth see what he captured today and yesterday." Day-grouped vertical ships the function now; positional horizontal can land in the shaping phase if daily use shows the vertical feed is the friction. Filter defaults (`significance >= 3`, last 30 days) match the spec.
