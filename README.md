# Field Shift

NASA Space Apps Challenge 2026: **Field Shift: Adapting Farms with NASA Data**.

A decision-support tool for Bangladesh built on NASA data. Two things work on the backend:

- **Planting-window advisory.** For a district and every crop in the reference catalogue, it compares the start of usable rain in 2001 to 2012 with 2013 onwards from NASA POWER, and returns a decision (move planting earlier, later, no clear change, or not applicable for rain-independent crops), the evidence behind it, the shifts the data cannot rule out, and a sentence in English and Bangla.
- **Crop-rotation comparison.** For a district, current crops, soil and priorities it compares rotations with simple documented rules and explains each option.

It supports farmer judgment and does not replace local agricultural expertise. It does not predict yield or profit.

## What works and how far it has been verified

| Part | Status |
|---|---|
| API, advisory engine, rotation engine, validation, database layer | Built and covered by automated tests (run `npm test` in `backend/`; the database tests need `TEST_DATABASE_URL`) |
| Offline mode (`OFFLINE=1`) | **Ready for all 12 districts.** `backend/data/offline/` holds the real NASA POWER daily series (2001-01-01 to 2025-12-31, 9,131 rows each, exported 2026-11-09). Run `npm run check:offline` and `npm run demo:all` (see `docs/DEMO_ALL_DISTRICTS.md`). Field endpoints and IMERG need PostgreSQL/PostGIS and do not work offline |
| SMS summary | `sentence.sms` (English and Bangla) on every advisory, at most 160 characters. A Bangla SMS uses UCS-2 (70 characters per segment), so it usually takes 2 to 3 segments; check `sms.meta.bn.fitsOneSms` |
| Rotation scoring | Now scores cropping intensity and staple cereal, filters alternatives to documented patterns, and reports ranking stability. The score still has no yield or income term (see `docs/SCIENTIFIC_METHOD.md`) |
| Aus | Labelled **experimental** (ERA5 did not corroborate the May rainfall). Use Aman for the demo |
| NASA POWER data | Real data for 12 districts, 0 missing days; every response carries its source, run id and retrieval date. `/api/health/data` reports the real/synthetic/none tally. Jashore and Khulna share one grid cell. The snapshot ends 2025-12-31 |
| Advisory result so far (12 districts) | Aman is `saturated` (onset already on the first day examined, so no advice is given) in 11 districts; Rajshahi Aman shows **no supported shift** (p = 0.87; a shift of about 8 days either way cannot be ruled out). After correcting for testing 22 district and crop pairs, no pair shows a supported shift. See `docs/SCIENTIFIC_METHOD.md` and run `npm run screen:advisory` |
| GPM IMERG cross-check | Code and tests with labelled fixtures; **live download not yet confirmed** (`npm run probe:imerg`) |
| Crop traits and district coordinates | **Unverified assumptions.** Sourcing sheet and checker exist (`docs/CROP_DATA_SOURCING.md`); no value is verified yet |
| Bangla text | Draft, **not reviewed by a native speaker** |
| Frontend | Owned by a teammate. It is **not yet connected to the advisory endpoints** (see `docs/ADVISORY_API.md` for the contract) |

## Quick start

Full guide with troubleshooting: **[docs/SETUP.md](docs/SETUP.md)**.

```bash
cd backend
cp .env.example .env        # then fill in your database connection strings
npm install
npm run db:deploy           # create tables
npm run db:seed             # districts and crops
npm run ingest:nasa         # real NASA POWER data (or: npm run db:seed:synthetic for labelled demo data)
npm run dev                 # API on http://localhost:4000
# no database? the committed files in backend/data/offline/ are enough:  npm run start:offline

# second terminal
cd frontend
npm install
npm run dev                 # app on http://localhost:5173
```

Requires Node.js 22.18 or newer.

**Demo without a database or internet** (all 12 districts):

```bash
cd backend && npm ci
npm run check:offline       # validate the 12 files
npm run start:offline       # API on http://localhost:4000
npm run demo:all            # second terminal: every district through the API
```

Ports used together: API **4000**, Vite dev server **5173** (proxies `/api` to 4000), `CORS_ORIGIN=http://localhost:5173`.

## Layout

```
backend/    Express API, science, Prisma schema, scripts, tests
frontend/   React + Vite + Tailwind CSS single-page app
docs/       SETUP, OFFLINE, ARCHITECTURE, DATA_SOURCES, SCIENTIFIC_METHOD, TESTING, ADVISORY_API, FIELDS_API, CROP_DATA_SOURCING, AI_USE, BANGLA_REVIEW, DEMO_ALL_DISTRICTS
```

## Commands (in `backend/`)

| Command | What it does |
|---|---|
| `npm run dev` / `npm start` | Start the API (dev restarts on change) |
| `npm test` | Run the automated tests |
| `npm run db:deploy` / `db:seed` | Apply migrations / load districts and crops (safe to repeat) |
| `npm run ingest:nasa` | Download NASA POWER data (`-- --district=rajshahi` for one) |
| `npm run ingest:refresh` | Extend stored POWER data to about a week before today |
| `npm run start:offline` | Serve from the committed offline files only (`OFFLINE=1`); add `-- --with-frontend` to serve the built page too |
| `npm run demo:all` | Advisory and rotation check for every district; `-- --inprocess` needs no server |
| `npm run export:offline` / `check:offline` | Write / validate the offline climate files |
| `npm run screen:indicators` | Screen monsoon rain, dry-season rain, hot days, dry spells and onset for any real signal (Holm-corrected) |
| `npm run check:rotation` | Print the top rotation picks and the ranking-stability result for a district |
| `npm run screen:advisory` | Table of the advisory for every district and crop, with multiple-testing correction |
| `npm run check:crops` / `build:crop-sources` | Check the crop sourcing sheet / write verified values (dry run unless `-- --write`) |
| `npm run verify:live` | Confirm every district serves real, recent NASA data |
| `npm run probe:imerg` | Check that GPM IMERG can be reached (stores nothing) |

## Team rules

- Never commit `.env` files, keys, passwords or cookie files.
- Never present synthetic or fixture data as a NASA observation.
- Never present a heuristic score as a yield or profit forecast.
- Work on branches and open pull requests.