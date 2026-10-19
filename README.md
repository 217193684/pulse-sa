# Pulse SA

What South Africa is struggling with, right now: a TikTok-style feed and a live heat map of
problems (water, power, transport, education, jobs, grants, cost of living, health, safety),
built from public sources.

- `src/` – the server (Next.js on Vercel + Postgres on Neon): collects data, scores problems, serves the API and share images.
- `android/` – the Android app (Kotlin + Jetpack Compose). GitHub Actions builds the APK.

## Data sources (all public, no keys)
| Source | What we keep |
|---|---|
| SA news RSS feeds (News24, TimesLIVE, SABC, EWN, The Citizen, GroundUp, Daily Maverick, IOL) | Headline + link only, and only headlines that match a problem category |
| Google Trends "Trending now" (ZA) | Search term, approximate traffic, related headline links |
| Eskom load-shedding status | Current stage |
| GDELT DOC 2.0 (South African outlets) | Headline + link, de-duplicated against the RSS feeds |

Each problem = a category in a place over the last 24 hours, compared with that same
category and place's normal daily level over the week before. Signals older than 30 days are deleted.

## API
`/api/feed` · `/api/map?category=water` · `/api/problems/<id>` · `/api/top3` · `/api/card/<id>` (1080×1350 PNG) · `/api/health`

## Setup
1. Vercel: import this repo and add a Neon Postgres database (Storage → Neon). That's all the server needs.
2. GitHub: repository variables `API_URL` and `PULSE_API_URL` = the Vercel address.
   Collection needs no password: `/api/cron/collect` runs at most once every 10 minutes.
   Optional: `ADMIN_TOKEN` in Vercel to add feed videos.
3. Videos for the feed: `POST /api/admin/videos` with `Authorization: Bearer <ADMIN_TOKEN>` and `{"url":"https://youtu.be/…","title":"…"}`.

## Develop
`npm install`, put `DATABASE_URL` in `.env`, then `npm run db:migrate`, `npm run collect`, `npm run dev`. Tests: set `TEST_DATABASE_URL` and run `npm test`.
