# Testing

Framework: Vitest (tests) and Supertest (HTTP). Working directory for all commands: `field-shift/backend`.

```bash
npm test                 # everything that needs no database
npm run test:watch       # re-run on save
TEST_DATABASE_URL="postgresql://..." npm test   # also run the database tests
```

Expected: the database-free suite skips only real database tests; with `TEST_DATABASE_URL`, all database tests run.

The suite is in `backend/tests/`. Run `ls tests` for the full list; the groups are:

| Group | Kind | What it checks |
|---|---|---|
| `health`, `api`, `hardening`, `validation*`, `sessionConflict` | integration, unit | Routes with a fake repository, request validation, error shapes, rate limit and proxy trust, 422/404/503 behaviour |
| `climate`, `series`, `stats`, `calendar`, `power`, `climateGrid`, `gridProbe` | unit | Yearly indicators, onset, calendar windows, the NASA POWER parser (hand-built sample, not NASA data), grid-cell arithmetic |
| `onsetAnalysis`, `onsetEdgeCases`, `onsetSensitivity`, `plantingWindow*`, `plantingAdvisory`, `advisoryApi`, `screening` | unit, integration | Mann-Whitney, censoring, partial years, boundary dates, the decision rule, the advisory endpoint, multiple-testing screening |
| `rotation`, `soilNotEntered`, `fieldProfile`, `field*` | unit, integration | Rotation scoring and explanations, missing soil input, field records and field intelligence |
| `imerg*`, `rainComparison`, `fieldRainEvidence` | unit, integration | GPM IMERG request/parse code, pixel aggregation, POWER versus IMERG comparison |
| `offline`, `smsAdvisory` | unit, integration | Offline files (validation, hashing, refusal of synthetic data), start-up source selection, fallback when the database fails, `OFFLINE` flag, health mode; SMS length and encoding for every advisory kind, Aus experimental label |
| `cropSheet`, `cropSources` | unit | Crop sourcing sheet checker and verified-value overlay |
| `*.integration.test.js` | integration | Real PostgreSQL with PostGIS: ingestion, locks, field climate. Skipped without `TEST_DATABASE_URL` |

**Unit vs integration:** unit tests call one function with known inputs. Integration tests start the whole API (and optionally a real database) and call it over HTTP.

**Offline rehearsal:** turn wifi off, `npm run check:offline` (exit 0), `npm run start:offline -- --with-frontend`, and walk the demo. See `docs/OFFLINE.md`.

**Manual checks** (before every demo): `/api/health`, `/api/health/db`, `/api/health/data`; evaluate Rajshahi with Boro + Aman; confirm the banner matches the data actually loaded (NASA vs synthetic); switch to Bangla; test on a phone-width window.

The refresh command is intentionally not part of automated tests because it contacts NASA
POWER. Run `npm run ingest:refresh` only when a configured database and network are available;
it records failures, preserves the prior successful run, and uses the ingestion lock.

On 2026-11-02, a real three-day NASA POWER request for Rajshahi succeeded against
`https://power.larc.nasa.gov/api/temporal/daily/point`. This verifies upstream
availability and response shape only; it did not write to a production database.

Field integration checks should use separate cookie jars to verify that one
anonymous session cannot read or create a field belonging to another session.

**What is not tested automatically:** a live call to NASA POWER (no test may depend on the internet) and the React screens (checked by hand).
