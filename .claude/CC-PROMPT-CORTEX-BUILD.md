# CC PROMPT — Cortex PWA Build Agent

> **Save as:** `CC-PROMPT-CORTEX-BUILD.md`
> **Run from:** a fresh folder, e.g. `C:\Users\gk100\Claude_Code_Folders\cortex\`
> **Working name:** Cortex (single config constant, trivially renameable later)
> **Runway:** 6 weeks focused build + 10 weeks shaping on Wates, starting immediately
> **Dogfooding site:** Wates / Ormiston Bridge Academy from end of week 1 onwards
> **Production target:** Ritz penthouse role start (assumed August 2026, confirm post-interview)

---

## 1. MISSION

You are building **Cortex** — a private, single-user, voice-first PWA that functions as a project PM's second brain. It is Gareth Kerr's personal operating instrument for managing the refurbishment of two luxury penthouses at The Ritz London (as subcontractor to Sir Robert McAlpine, under Mivan Ltd as employer). It is NOT a team tool, NOT a Mivan corporate tool, NOT a site-ops tool (SVL handles that use case separately). It is a reflective, relationship-aware, timeline-and-actions-as-output tool for a single PM managing a commercially and reputationally sensitive subcontract.

The core loop is: **capture during day → synthesise overnight → brief in morning → act → capture**. Everything in the product serves that loop. If a feature doesn't serve it, it doesn't ship in v1.

This build will be dogfooded on Gareth's current Wates DfE role (Ormiston Bridge Academy) from end of week 1 onwards. The Wates use is not a toy — it is the only reliable way to shape the product around real habits before it hits the Ritz, where the stakes prevent iteration.

**The build and the shaping are two different phases, paced differently.** The build is 6 weeks, aggressive, focused, shipping complete v1 functionality. The shaping is the 10 weeks after that, low-intensity, daily use on Wates surfacing friction that only reveals itself in real work. The build is where CC earns its keep. The shaping is where Gareth earns his. Do not collapse the two into a single "keep building forever" phase — the six-week line is a hard stop on new features. After week 6, changes are friction fixes, not additions.

**If the capture habit isn't sticking on Wates by end of week 2, the build stops and the friction gets fixed before any further features ship.** This is the single gate that matters.

## 2. CONTEXT — WHAT YOU ALREADY KNOW

Do not re-derive these. Start from them.

**Gareth's stack fluency** — Next.js 14, Supabase, Vercel, Claude API (Haiku/Sonnet/Opus tiering), shadcn/ui, Tailwind, Claude Code v2.1.0 on Windows. PWA experience from StageFlow and BioRevise. Voice-first capture experience from SVL and VoiceLog. Email ingest experience from Ictus Flow document automation. CC skill file discipline (`nextjs-page-scaffold.md`, `supabase-rls-setup.md`, `pwa-setup.md` all reusable here).

**Existing related builds** — SVL (site operative's voice logger, separate product, separate repo). VoiceLog (fitness logging PWA, regex-based parser, anonymous-to-auth migration pattern). PreconAI (multi-agent orchestration, streaming chat, Sonnet/Opus/Gemini Flash-Lite tiering). Blocker App (Next.js/Supabase multi-tenant SaaS, Playwright test harness). StageFlow (dark theatre aesthetic design system, self-improving CC skill files, Supabase RLS patterns).

**What Cortex is not** — it is not SVL rebuilt, it is not Blocker, it is not a team product. Keep it in its own repo, its own Supabase project, its own Vercel deployment, its own domain (suggest `cortex.ictusflow.com` or a subdomain Gareth picks). Clean security perimeter from day one.

## 3. NON-NEGOTIABLE ARCHITECTURE DECISIONS

Lock these in before writing code. Do not revisit them mid-build.

1. **Single-user from day one.** No multi-tenancy. Auth is one user — Gareth. Use Supabase Auth with a hard check against a single allowed email on every request. If he later wants another PM to use Cortex, they get their own instance.
2. **UK-hosted Supabase project.** Choose the EU (London/Dublin) region. Royal/political guests at the Ritz mean the data genuinely needs to stay UK/EU. Document the region choice in the README.
3. **Event as the atomic unit.** One captured utterance / email / photo = one event row. Derived extractions (entities, actions, decisions, timeline tags) link to the event. Raw transcript is immutable; corrected/edited versions live alongside as separate fields. This is a claims-defensibility requirement — never overwrite the raw.
4. **Multi-label extraction, never single-bucket classification.** A voice note can simultaneously be an RFI signal, a commitment, a site diary entry, a risk, and a stakeholder note. Extract all dimensions independently. One event appears in many views.
5. **Google Calendar is the calendar.** Do not build an in-app calendar UI. Read/write Google Calendar via API to a dedicated "Cortex-Ops" calendar that surfaces in Gareth's existing Google Calendar. Cortex enriches the calendar; it does not replace it.
6. **Model tiering, strict.** Haiku for classification and cheap extraction passes. Sonnet for structured extraction and synthesis. Opus once weekly for strategic review and proposal generation. Never use Opus where Sonnet will do. Never use Sonnet where Haiku will do.
7. **Working name in one place.** The string "Cortex" appears in exactly one config constant (`APP_NAME` in `lib/config.ts`) and the rendered UI. Never in table names, route names, class names, environment variables, or CSS classes. Future rename is a 5-minute job, not a refactor.
8. **Offline-first capture.** Voice, text, and photo capture must work offline and sync when online. IndexedDB queue, service worker background sync, proper retry with exponential backoff. This is not optional — Gareth will be in basements and lift cores without signal.
9. **Immutable audit log.** Every event creation, edit, deletion, and extraction is logged to an append-only `audit_log` table with timestamp, user, action, before/after diff. Disclosure-ready from day one. Cheap to build now, impossible to retrofit.
10. **No third-party analytics, no trackers, no ads, no public pages.** The entire app is behind auth. No landing page. No marketing site. No Google Analytics. No Sentry unless self-hosted. Data boundary is clean: Supabase (UK) and Anthropic API. Nothing else sees the data.
11. **Chat is a query surface, not a parallel extraction path.** Chat reads from the event graph and can *create* events (actions, notes) through the same extraction pipeline as voice/text/email. Chat never bypasses extraction, never writes directly to domain tables. If a user says "add an action" in chat, the action is created via the same multi-label extractor that handles voice notes — so every creation path produces consistent data. One pipeline, many input surfaces.
12. **Chat responses distinguish factual retrieval from synthesis.** Factual answers (what was said, when, by whom) show inline source citations with tap-to-open the source event. Synthesis answers (shape of a risk, relationship temperature, proposals) show "based on N events over M days" with drill-in. Never blur the two. Never let synthesis drift into invented fact.

## 4. THE PRODUCT — FEATURE SET v1

Five capture surfaces, six views plus chat, four agents, six generated outputs. That's it. If a new feature idea doesn't fit this frame, it goes on the v2 backlog, not into v1.

### Capture surfaces
1. **Voice** — tap, record, stop. Whisper API for transcription. Background upload. Zero fields at capture time.
2. **Text** — quick note field on home screen. Same processing pipeline as voice.
3. **Photo** — with optional voice caption. OCR via Claude vision if text is detected in the image. Stored in Supabase Storage.
4. **Email forward** — dedicated personal email address (Gareth sets up e.g. `cortex-intake@<his-domain>`). IMAP or Gmail API poll every 5 minutes. Each email = one event.
5. **Manual calendar context note** — when Gareth adds a Google Calendar event, he can tap through to Cortex and add a context note against it ("meeting with Tom — chase stone interface"). That context note is itself an event, pre-linked to the future meeting.
6. **Chat** — conversational capture. When Gareth says "add an action: chase McAlpine on sprinkler drawings by Thursday" or "note that Tom was off today," the chat recognises the intent and creates events via the same extraction pipeline. Chat is both a capture surface and a query surface — see Views.

### Views
1. **Tomorrow-brief (home)** — what's on today, overdue actions, one or two "you should know" items. This is what Gareth sees every morning.
2. **Dashboard (one-screen project health)** — health strip (actions/RFIs/risks by status), stakeholder heatmap (last-contact recency), workstream grid (trade package × dimension), recent timeline strip, "things drifting" panel (Sonnet's weekly regression observations), "what's coming" panel (next 14 days from calendar). One screen, no scroll, derived from events — never manually edited.
3. **Timeline** — interactive, horizontally-scrollable (desktop) / vertical feed (mobile). Every timeline-worthy event appears as a dot/pill, colour-coded by type, with date + one-line heading. Click → detail panel with full note, source, linked entities, linked events, related-note capture. Filterable by type, stakeholder, trade package, date range, significance score (default ≥3).
4. **Stakeholders** — one page per entity (person, organisation). Last contact, open actions with them, their recent timeline contributions, Sonnet-generated "relationship temperature" read (tone shift over time), quick-capture against this person, contextual chat scoped to this entity.
5. **Actions** — full action register. Columns: description, raised-by, owned-by, raised-date, due-date, actual-close-date, evidence, status (open/overdue/closed/disputed), linked events. Sortable, filterable, aged. Planned-vs-actual delta visible on every closed action.
6. **Search** — one box, queries across events, entities, actions, decisions, emails, transcripts, OCR'd photo text. Semantic (pgvector embeddings, added month 3–4) + keyword. Results grouped by type.
7. **Chat** — conversational interrogation of project memory. Sonnet-backed, streaming responses, voice input, text output. Globally accessible via a persistent chat button on the home screen; contextually scoped when opened from a stakeholder page (chat is pre-scoped to that person), timeline detail panel (pre-scoped to that event + related), or dashboard drift panel (pre-scoped to the flagged item). Handles two response modes: **factual retrieval** (answers with inline source citations, tap-to-open source event) and **synthesis** (narrative answers with "based on N events over M days" provenance banner). Can create events via extraction pipeline — "add an action," "note that," "flag a risk about." Conversation state held for the session; deeper conversational memory is v2. Recent-context windowing in month 2 (last 30 days of events stuffed into context with smart filters); full semantic retrieval upgrades in month 3–4 as embeddings come online.

### Agents
1. **Synthesiser** — runs nightly at 22:00. Ingests the day's captures, runs multi-label extraction on anything new, updates entities/actions/timeline, produces the tomorrow-brief. Sonnet.
2. **Gap-finder** — runs nightly after synthesiser. Flags stakeholder silence, overdue actions, decisions that never operationalised, deadlines approaching without preparation. Haiku for the scan, Sonnet for the narrative output.
3. **Meeting-prep** — triggered 90 minutes before any calendar event (configurable). Produces the pre-meeting brief: who you're meeting, last contact, open actions with them, Gareth's outstanding commitments to them, their commitments to Gareth, relevant recent events. Push notification with summary, tap to open full brief. Sonnet.
4. **Weekly reviewer** — runs Sunday 20:00. Opus. Ingests the full week. Produces: the week-just-gone retrospective (what moved, what slipped, what's drifting), the week-ahead strategic view, and 2–3 explicit proposals framed as "here are the options for handling X, I'd recommend Y because …". This is the feature that makes it feel like a chief of staff.

### Generated outputs (on-demand, editable)
1. **Weekly site diary** — narrative compilation of site-diary-tagged events
2. **RFI register** — Excel export, formatted to industry standard
3. **Risk register** — live, sortable, exportable to Excel/PDF
4. **Decision log** — chronological, searchable, PDF export for disclosure
5. **Commitment/action tracker** — aged, planned-vs-actual, exportable
6. **Weekly stakeholder report** — per-person or per-audience summary for Mivan internal reporting

## 5. THE ONTOLOGY — EXTRACTION TARGETS

Lock this in the extraction prompt. Every captured event is assessed for each of these independently. Zero, one, or many may apply.

- **rfi** — a question raised (or to be raised) to a counterparty, needing formal response
- **tq** — technical query, narrower than an RFI
- **commitment** — a promise made (by Gareth or to Gareth), with owner, deliverable, deadline
- **decision** — a decision taken, with decider, rationale, evidence, date
- **risk** — something that could go wrong, with probability/impact/owner/mitigation
- **variation** — proposed or agreed scope change, with source/cost/time impact
- **snag** — defect or quality issue, with location/trade/status
- **site_diary** — narrative of what happened, belongs in daily log
- **meeting_note** — links to a calendar entity
- **observation** — noticed but not yet classifiable, triage bucket
- **thought** — strategic, feeds weekly review

The extractor also pulls:
- **entities** — people, organisations, trade packages, locations (penthouse A/B, specific rooms), drawing references, document references
- **sentiment** — tone of the note, particularly toward named stakeholders
- **significance** — 1–5 score for timeline inclusion (default timeline view shows ≥3)
- **timeline_worthy** — boolean, with a one-line headline if true
- **linked_events** — references to prior events this relates to

Extraction runs as a single structured Sonnet call per event, returning JSON validated against a Zod schema. If extraction fails, the event is flagged for manual review in the tomorrow-brief — never silently dropped.

## 6. THE BUILD — 6-WEEK ROADMAP + 10-WEEK SHAPING

### Phase 1 — BUILD (weeks 1–6, aggressive pace, focused CC sessions)

**Week 1 — capture, storage, extraction, basic views**
- Next.js 14 app, Supabase project (EU region), Vercel deploy, single-user auth
- Voice capture: tap-record-stop, Whisper API, event row
- Text capture: quick note field
- Photo capture with optional voice caption
- Raw event list view, reverse chronological
- Extraction pipeline v1: Sonnet multi-label ontology, JSON schema validation, results stored
- Raw transcript immutable, derived/edited fields separate
- Audit log firing on every mutation
- PWA install flow on iOS and Android
- Offline capture queue (IndexedDB + service worker) — airplane mode tested
- **Deployed. Dogfooding begins end of week 1.**

**Week 2 — timeline, actions, stakeholders, golden-set discipline**
- Timeline view (vertical mobile, horizontal desktop), filter by type/stakeholder/date/significance, click-through detail panel, related-note capture
- Action extraction live (voice, text); actions view with aged columns; planned-vs-actual close-out capture; disputed status
- Stakeholder entity pages: last-contact, open actions, recent contributions; entity merging UX
- **Golden-set testing established**: 30 real Wates voice notes, expected multi-label outputs, regression test on every extraction prompt change. Non-negotiable.
- Tomorrow-brief view on home screen (basic — overdue actions, today's captures, calendar items)
- Synthesiser agent running nightly on Vercel Cron

**Week 2 gate — CAPTURE HABIT CHECK:** Is Gareth capturing ≥5 events per working day on Wates? If no, STOP. Fix friction. No new features until capture is automatic.

**Week 3 — chat, email ingest, Google Calendar**
- **Chat v1 (global)**: Sonnet-backed, voice-in, text-out, streaming. Recent-context windowing (last 30 days, filterable). Factual vs synthesis response modes, source citations on factual. Chat-to-event creation via extraction pipeline (not parallel path). Session-only conversation state.
- **Email forward ingest**: dedicated address, IMAP or Gmail API poll, one event per email
- **Google Calendar two-way sync**: OAuth, Cortex-Ops calendar, calendar items readable in-app, context notes against future events
- **Contextual chat**: chat button on stakeholder pages pre-scopes to that entity; chat button on timeline detail panel pre-scopes to that event + linked. Same component, different retrieval scope.

**Week 4 — meeting-prep agent, decisions, dashboard**
- Meeting-prep agent: 90-min-before trigger, pre-meeting brief, Web Push notification (iOS 16.4+ handled properly), post-meeting capture prompt at +15 min
- Decisions log view — chronological, searchable, "implemented / superseded / reversed" lifecycle
- **Dashboard (one-screen project health)**: health strip, stakeholder heatmap, workstream grid, recent timeline strip, "things drifting" panel, "what's coming" panel. One screen, no scroll, fully derived.
- Gap-finder agent running nightly: stakeholder silence, aged action escalation, decisions not operationalised, deadlines without preparation

**Week 5 — generated outputs, search, weekly reviewer**
- Generated outputs: weekly site diary, RFI register (Excel), risk register, decision log (PDF for disclosure), commitment tracker, weekly stakeholder report — all editable before filing
- Search: pgvector embeddings on events/transcripts/emails/OCR'd photo text; hybrid semantic + keyword; results grouped by type
- **Weekly reviewer agent (Opus)**: Sunday 20:00, retrospective + week-ahead + 2–3 proposals framed as "here are the options, I'd recommend X because…". Push notification + in-app view. This is the "chief of staff" feature — it runs last because it benefits most from 4 weeks of accumulated data.

**Week 6 — hardening, security review, contingency buffer**
- Security review: auth edge cases, RLS policies on every table, no open endpoints, audit log completeness, data boundary to Anthropic verified
- Data export: full JSON dump — Gareth can leave with his data in 10 minutes
- Backup discipline: daily Supabase backup, tested restore path
- UI polish pass — Tufte-dense, quiet, no Bootstrap-busy
- Offline-edge-case hunt, notification reliability tested on iOS and Android
- **Contingency buffer**: this WILL get used. If weeks 1–5 slipped (life happens), week 6 absorbs it. If they didn't, week 6 is polish and the start of Phase 2.

**End of Week 6 — BUILD COMPLETE. No new features after this line. Anything unbuilt goes to v2.**

### Phase 2 — SHAPING (weeks 7–16, low-intensity, real-use-driven)

Ten weeks of daily use on Wates, with targeted fixes only. The code-writing pace drops by an order of magnitude. The learning pace goes up.

**Weeks 7–10 — discovery through use**
- Daily use on Wates / Ormiston Bridge Academy. Goal: 10+ captures per working day becomes reflex.
- Friction log: Gareth keeps a running note of every moment the tool got in his way, every feature he wished existed but doesn't, every extraction that misfired
- Weekly Friday review (10 minutes): what worked, what didn't, what to fix next week
- Fixes only, no additions. If a "new feature" idea comes up, it goes on the v2 backlog.
- Golden-set grows: every extraction misfire that Gareth catches becomes a new test case in the golden set
- Extraction prompt iterated based on real misfires, not imagined ones

**Weeks 11–13 — Ritz pre-population**
- Create entities for known Ritz players: Sir Robert McAlpine (with named counterparts as known), Turner & Townsend, Purcell, EPR Architects, David Collins Studio, Pierre-Yves Rochon, Studio Ashby, client representative, Mivan internal team, lateral trade package managers as they're learned
- Build the glossary: listed-building terms, Mivan vocabulary, Project Picnic terminology, the scope matrix template (from the interview briefing work) as an editable reference document
- Import any briefing documents, correspondence, or pre-start material into Cortex via email forwarding so the entity graph is already live when day one arrives

**Weeks 14–16 — final readiness**
- Stress test: a day of intentional heavy capture (40+ events) to verify the pipeline, briefs, and agents hold up under real Ritz-volume use
- Security final pass with a paranoid hat on — assume someone's trying to get in, find the gaps
- Mobile performance pass: brief generation, chat response, timeline scroll — all must be sub-second on phone
- Final data export dry run: make sure Gareth could genuinely leave with his data
- The very last week before Mivan start: Cortex in full operational use, no code changes, just use. If anything's breaking in that week, it was going to break at Mivan anyway — fix it now, not then.

## 7. DO NOT BUILD IN v1

Explicit anti-scope. If the temptation arises, the answer is no, v2.

**At six-week pace this list matters MORE, not less.** When CC is moving fast and features are landing daily, the temptation to "just add one more thing" is the single biggest risk to shipping on time. Every item below was considered and rejected for a reason. If Gareth asks mid-build, the answer is "v2 backlog, noted," and the build continues on plan.

- ❌ Multi-user, team features, sharing, permissions beyond single-user
- ❌ A marketing site, public landing page, or any public surface
- ❌ In-app calendar UI (Google Calendar is the calendar)
- ❌ Drawing register, document version control, drawing markup
- ❌ Programme logic, critical path analysis, dependencies between actions
- ❌ Formal RFI/TQ workflow submission to external systems (Asite, Procore) — Cortex tracks and exports; filing happens in the contractor's system
- ❌ Integrations with Mivan corporate systems (Teams, SharePoint, etc.)
- ❌ Chain-of-custody photo evidence metadata beyond timestamp
- ❌ Video capture
- ❌ Real-time collaboration, comments, mentions
- ❌ A notification system more complex than: nightly brief, meeting-prep, post-meeting prompt, overdue-action alert
- ❌ More than four agents
- ❌ Fine-tuning, custom models, embeddings other than for search
- ❌ Any analytics, trackers, or third-party scripts
- ❌ Voice output on chat (text-to-speech) — v2
- ❌ Multi-session chat memory / persistent chat threads — v2 (session-only in v1)
- ❌ Chat agentic tool use beyond event creation (e.g. "draft and send this email for me") — v2
- ❌ Chat over OCR'd photo text or attached documents — v2 when embeddings mature

If Gareth asks for any of the above during the build, the answer is "v2 backlog" and the build continues. The v1 scope is the commitment.

## 8. ON-GOING BUILD HOUSE RULES

- **British English** throughout code comments, UI copy, and generated outputs
- **No bullet-heavy UI**. Copy is prose, quiet, Tufte-dense not Bootstrap-busy
- **No emoji in UI** unless Gareth explicitly requests them
- **Every destructive action is undoable** (soft delete, 30-day recovery) or requires a typed confirmation
- **Every CC session produces or updates a skill file** in `.claude/skills/` that captures what was learned. Self-improvement protocol on each (pattern already established in StageFlow).
- **One commit per logical change**, conventional commits, clean history
- **Tests for the extraction pipeline from week 2 onwards** — a golden-set of 30 Wates voice notes with expected multi-label outputs. Run on every change to the extraction prompt. Regression is not allowed.
- **Weekly self-review by Gareth**: Friday 10 minutes, what's working, what's friction, what's getting in the way of the capture habit. Adjust the plan if needed.

## 9. OUTPUT — WHAT YOU PRODUCE

This prompt is for a build, not a research pass. CC's output over the four months is:

1. A working, deployed PWA at `cortex.ictusflow.com` (or Gareth's chosen domain)
2. A clean GitHub repo, private, with conventional commits and a live README
3. A `.claude/skills/` folder of self-improving skill files covering every major pattern
4. A `DECISIONS.md` file at repo root capturing every architectural decision with date and rationale — disclosure-ready
5. A weekly build log committed to the repo (`build-log/week-NN.md`) — what was built, what was learned, what's next

## 10. SELF-CHECK AT EACH GATE

Before proceeding past each gate, CC must honestly answer:

**End of Week 1 (capture layer live):**
1. Is capture genuinely friction-free — tap to recording in under one second?
2. Does offline capture survive airplane mode and sync cleanly when reconnected?
3. Is the audit log firing on every mutation, with nothing silently missed?
4. Is raw immutable and are edits stored separately?

**End of Week 2 (CAPTURE HABIT GATE — the only gate that can halt the build):**
1. Is Gareth capturing ≥5 events per working day on Wates? If no, STOP BUILDING. Fix friction. No week 3 until this is green.
2. Is extraction accuracy ≥85% on the golden set of 30 Wates voice notes? If no, iterate the prompt before adding features.
3. Is the timeline genuinely being used — does Gareth reach for it to remember something, or does he still scroll raw events?
4. Are stakeholder pages accurate when clicked?

**End of Week 3 (chat + calendar live):**
1. Is chat genuinely useful — does Gareth reach for it to ask questions about the project, or does he still scroll manually?
2. Does chat reliably distinguish factual retrieval from synthesis? Any hallucinated "facts" not grounded in retrieved events?
3. Is chat-to-event creation producing extractions of the same quality as voice notes?
4. Is Google Calendar sync reliable — no dropped events, no duplicates, context notes persisting?
5. Is email ingest working cleanly with no inbox noise leaking into the event graph?

**End of Week 4 (dashboard + agents live):**
1. Does the dashboard show the true state of the (Wates dogfood) project in one glance, with no scroll?
2. Are pre-meeting briefs genuinely useful or are they noise? Would Gareth open them voluntarily?
3. Is the gap-finder surfacing real gaps or generating anxiety?
4. Are decisions being tracked through their full lifecycle (implemented / superseded / reversed)?

**End of Week 5 (outputs + search + weekly reviewer):**
1. Are the generated outputs (site diary, RFI register, risk register, decision log, commitment tracker, stakeholder report) good enough that Gareth would file them with a 15-minute edit, or do they need substantial rewriting?
2. Is search finding things reliably across all data types including OCR'd photo text?
3. Does the weekly reviewer produce genuine insight and actionable proposals, or bland summary? If bland, the Opus prompt needs work, not the code.

**End of Week 6 (BUILD COMPLETE):**
1. Is the data fully portable — can Gareth export everything and leave in 10 minutes if he had to?
2. Is every table protected by RLS? Is every endpoint behind auth?
3. Is the audit log disclosure-ready — complete, append-only, queryable?
4. Would Gareth bet his professional reputation on Cortex on day one at Mivan? If no, what's missing, and is it genuinely a gap or is it shaping-phase polish?
5. **Has the "do not build in v1" list held? Every feature that got added beyond scope is now debt. Acknowledge it honestly.**

**Shaping Phase gates (weeks 7–16):**

**End of Week 10:**
1. Has capture hit 10+ events per working day as reflex on Wates?
2. How many extraction misfires are in the golden set now? Is accuracy climbing or drifting?
3. What's the most common friction Gareth has logged? Is it fixable, or is it baked into the architecture?

**End of Week 13 (Ritz pre-population complete):**
1. Is every known Ritz entity loaded with correct role, organisation, and initial context?
2. Is the glossary populated enough that extraction correctly handles listed-building and Mivan-specific terminology?
3. Are briefing documents from the interview prep loaded into Cortex as events so the knowledge is queryable from day one?

**End of Week 16 (Ritz-ready):**
1. Can Cortex handle 40+ events in a single day without performance degradation?
2. Is mobile sub-second on brief generation, chat response, and timeline scroll?
3. Is Gareth's capture habit so automatic he doesn't think about it — the tool is invisible?
4. If something breaks on day one at Mivan, does Gareth know exactly what to check first?

## 11. THE SINGLE MOST IMPORTANT RULE

**The capture habit is the product. Everything else is a view over the capture habit. If the capture habit doesn't stick on Wates by end of month 1, no amount of feature work fixes it.**

If at any point during the build, the capture flow gets more than one tap from home screen to recording-started, stop and fix that before shipping anything else. That single metric — taps-to-capture — is the leading indicator of whether Cortex becomes Gareth's operating instrument or another abandoned side project.

Begin Week 1 now.
