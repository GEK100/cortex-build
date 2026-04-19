# Cortex

Private, single-user, voice-first PWA for construction project intelligence.

**Region:** Supabase EU West (London)
**Domain:** cortex.ictusflow.com
**Auth:** Single user (gareth@ictusflow.com)

## Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (auth, database, storage)
- Anthropic Claude Sonnet (multi-label extraction)
- OpenAI Whisper (voice transcription)
- shadcn/ui + Tailwind CSS
- PWA with offline-first capture

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in keys
3. Create a Supabase project (EU West region)
4. Run the SQL from `src/lib/db/schema.sql` in the Supabase SQL Editor
5. Create a Storage bucket called `captures` (private)
6. Configure auth: enable Email/Magic Link, add callback URLs
7. `npm install`
8. `npm run dev`

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Build for production (includes SW compilation)
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Architecture

See [DECISIONS.md](./DECISIONS.md) for all architectural decisions with rationale.

### Data model

- **events** — atomic unit of capture (voice, text, photo, email)
- **event_labels** — multi-label extraction results (RFI, risk, commitment, etc.)
- **entities** — people, organisations, trades, locations (single table, type discriminator)
- **event_entities** — junction linking events to entities
- **extraction_results** — full Sonnet extraction output per event
- **audit_log** — append-only mutation log (disclosure-ready)
