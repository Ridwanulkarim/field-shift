# Running production on live NASA POWER data

The API never calls NASA while serving a request. It serves data that was already
ingested into the database (labelled `cached`). Two jobs keep that data real and current.

## One-time setup (GitHub Actions)

1. Repository **Settings > Secrets and variables > Actions**, add:
   - `DATABASE_URL_PRODUCTION` (Neon pooled string)
   - `DIRECT_URL_PRODUCTION` (Neon direct string)
   - `ANONYMOUS_SESSION_SECRET` (the same 32+ character value the production API uses;
     the config loader refuses to start in production without it)
2. Run **Actions > NASA live data > Run workflow** with `mode = initial`.
   This applies migrations, downloads 2001 to last year for all 12 districts, extends
   each to about 7 days ago, then verifies. Expect roughly 30-60 minutes.
3. Done. The workflow also runs daily at 03:30 UTC and does the incremental refresh.
   A failure fails the workflow run, and GitHub emails you.

## Manual equivalent

```bash
cd backend
export NODE_ENV=production        # plus the three secrets above in your environment
npm run db:deploy
npm run db:seed                   # only if districts are not loaded yet
npm run ingest:nasa               # full history
npm run ingest:refresh            # up to ~7 days ago
npm run verify:live               # exit 0 only if all districts are real and fresh
```

## How to tell it is live

- `npm run verify:live` lists each district as `ok`, `stale`, `synthetic_only` or `no_data`.
- `GET /api/health/data` shows `climateData: "nasa"`, `latestObservationDate` and
  `daysSinceLatest` per district. Healthy is about 7 to 9 days.
- Remove any leftover synthetic demo runs from production; real data takes priority,
  but synthetic rows should not exist in production at all.

## Limits

- "Live" means near-real-time: POWER publishes with a delay, so data is about a week behind.
- Values are a ~0.5 degree grid cell around the district point, not the individual field.
