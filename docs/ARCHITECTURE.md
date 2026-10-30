# Architecture

Field Shift is a modular monolith: one Express API, one React single-page app, one PostgreSQL database.

```
Browser (React + Vite + Tailwind)
   |  fetch("/api/...")            (Vite proxies to :4000 in development;
   v                                the API can also serve the built app)
Express API  backend/src
   routes/        HTTP only: parse, call the service, send JSON
   validation/    checks the request body, answers 422 with a list of problems
   services/      evaluationService: loads data via the repository, runs the science, shapes the response
   science/       PURE functions: statistics, climate indicators, rotation scoring, rules (no HTTP, no SQL)
   data/          repository (Prisma queries), reference data, climate store
   integrations/  nasa/power.js (NASA POWER client + parser), nasa/ingest.js, fixture/synthetic.js
   |
   v
PostgreSQL (Neon or local) via Prisma 7 with the `pg` driver adapter
```

## Rules the code follows

- The frontend never contains recommendation logic; it renders what `/api/evaluate` returns.
- Scientific code (`science/`) has no database and no HTTP, so it is tested directly.
- Every tunable number lives in `science/rules.js` with its status.
- If the database is not configured or unreachable, data routes answer **503**; they never return fake success.
- Errors always look like `{ "error": { "code", "message", "details?" } }`.
- Missing climate values are stored as `null`, never guessed.
- Synthetic data is flagged in the database (`isSynthetic`), in every API response and on screen.

## API

| Method and URL | Purpose |
|---|---|
| `GET /api/health` | Process is alive |
| `GET /api/health/db` | Database reachable (503 if not) |
| `GET /api/health/data` | Per district: `nasa`, `synthetic` or `none`, plus recent failed ingestions |
| `GET /api/meta` | Form options, priority list, disclaimer |
| `GET /api/districts` | Districts with `climateData` status |
| `GET /api/crops` | Crops with their traits and `basis` |
| `GET /api/districts/:slug/climate` | Provenance, coverage and yearly climate indicators |
| `POST /api/evaluate` | The recommendation (below) |

`POST /api/evaluate` body:

```json
{
  "district": "rajshahi",
  "existingRotation": ["boro", "aman"],
  "soil": { "salinity": "none", "drainage": "good" },
  "irrigation": "limited",
  "priorities": { "waterSaving": 1, "heatResilience": 1, "soilHealth": 1, "diversification": 1, "lowInput": 1 }
}
```

Only `district` and `existingRotation` are required. Unknown fields are rejected (typos). Status codes: 200 success, 400 malformed JSON, 404 unknown district, 413 body too large, 422 invalid content, 503 database unavailable.

The response contains `strategies` (the existing rotation first, then three ranked alternatives). Each strategy has `score`, `components`, `benefits`, `risks`, `informationGaps`, `evidence` and, for alternatives, a `comparison` with the existing rotation. It also returns `climate` (with provenance and a notice when data are synthetic or missing), `method`, `limitations` and `disclaimer`.

## Database (Prisma schema in `backend/prisma/schema.prisma`)

- `District`, `Crop`: reference data (seeded from `src/data/reference/`).
- `DatasetRun`: one ingestion attempt per district with source, endpoint, request parameters, retrieval time, fill value, units, row and missing counts, status (`SUCCESS` or `FAILED`), error message and notes.
- `ClimateDaily`: daily precipitation (mm), maximum and minimum temperature (deg C), linked to a run. `null` means missing.

Migrations are plain SQL in `backend/prisma/migrations/` and are applied with `npm run db:deploy`.
