# Turkish Tutor

A phone-first, AI-powered Turkish tutor for German speakers. It runs guided
conversation sessions with [Claude](https://www.anthropic.com/claude), tracks
what you've learned with a spaced-repetition system, and keeps vocabulary and
grammar references a tap away.

This is a small private app built for two users — access is gated by an email
allowlist (see [Configuration](#configuration)).

> The learning content and UI are in German (the learner's native language);
> the target language is Turkish.

## Features

- **Tutoring sessions** in two modes:
  - **Neue Wörter** — Claude introduces and drills new vocabulary, following a
    phase-based curriculum (`data/curriculum.json`).
  - **Freies Lernen** — free conversation that recombines words you already
    know, anchored to your last session.
- **Spaced repetition (SRS)** — a Leitner box system (`lib/srs.ts`, intervals
  1/3/7/16/35 days) schedules vocabulary reviews, with Turkish-locale-aware
  answer matching (correct dotted/dotless `İ`/`ı` handling).
- **Vocabulary & Grammar reference tabs** — browse your captured deck and the
  grammar topics covered so far.
- **Automatic session capture** — at the end of a session Claude extracts new
  vocabulary, grammar covered, weak spots, and a session log via tool use, which
  is validated and persisted as your progress.
- **Progress tracking** — streak, due-card count, and current curriculum phase.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [NextAuth v5](https://authjs.dev/) — Google OAuth with an email allowlist
- [Upstash Redis](https://upstash.com/) — persistence (progress, vocab,
  sessions) and rate limiting
- [Anthropic Claude](https://docs.anthropic.com/) (`@anthropic-ai/sdk`) —
  streaming chat + structured session extraction
- [Zod](https://zod.dev/) — request validation at the API boundary
- Jest — unit tests for the SRS, prompt, grammar, and extraction logic

## Getting started

### Prerequisites

- Node.js 20+
- An [Upstash Redis](https://console.upstash.com/) database
- A [Google OAuth client](https://console.cloud.google.com/) (client ID + secret)
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file and fill in the values
cp .env.example .env.local

# 3. Run the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Configuration

All configuration is via environment variables — see `.env.example` for the full
list. Key ones:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | NextAuth session secret (`openssl rand -base64 32`) |
| `ALLOWED_EMAILS` | Comma-separated allowlist of Google accounts permitted to sign in |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis connection |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

Only emails listed in `ALLOWED_EMAILS` can sign in; everyone else is rejected at
the NextAuth `signIn` callback.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run the Jest test suite |

## Project structure

```
app/            Next.js App Router — pages and API routes
  (app)/        Authenticated screens (home, session, vocab, grammar)
  api/          Route handlers (session chat/start/end/extract, state, auth)
  login/        Sign-in page
components/     React UI components (chat bubble, sidebar, progress bar, …)
lib/            Core logic — Claude client, prompt builder, SRS engine, KV,
                rate limiting, session extraction
data/           Seed data, curriculum, and grammar reference (JSON)
__tests__/      Jest unit tests
scripts/        One-off maintenance scripts (e.g. vocab backfill)
```

## Testing & CI

```bash
npm test
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and a
production build on every push to `main` and on every pull request.

## Deployment

Designed for [Vercel](https://vercel.com/). Set the environment variables from
`.env.example` in the project settings, connect an Upstash Redis store, and
deploy. Any Node.js 20+ host that supports Next.js works too.

## License

[MIT](./LICENSE)
