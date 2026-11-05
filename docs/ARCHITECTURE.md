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
- The repository caches immutable daily series by dataset-run ID, while the evaluation service caches
  derived climate indicators and crop metrics in bounded in-process caches. A new ingestion creates a
  new run ID, so refreshed data is used without manual cache invalidation; old entries are evicted
  after a small fixed limit.
- Helmet, compression, and method-sensitive in-process rate limits are applied before API routes.
- Field APIs use an opaque, signed random `field_shift_session` HttpOnly cookie. The database unique
  constraint on `Field.sessionId` enforces one field per anonymous session; this is not farmer
  identity and clearing browser storage loses access to the prior field. Production requires
  `ANONYMOUS_SESSION_SECRET`; expiry is checked server-side.
- Daily climate responses are calendar-complete: dates absent from storage are returned with `null`
  measurements. They include an ETag keyed by dataset run and requested range and are publicly
  cacheable for five minutes.
- Climate responses include a shared-grid-cell list derived from the stored daily series, rather than
  hard-coded district names. This describes identical source series, not field-level similarity.
- Stored NASA observations are labeled `cached`; `demo` is reserved for synthetic data and
  `unavailable` means no usable observations exist. The ingestion command reports a successful
  upstream retrieval separately rather than labeling all stored data `live`.
- `npm run ingest:refresh` fetches the latest seven-day lag window and atomically stores a merged run.
  A failed refresh records the failed attempt and does not replace the previous successful run.
- NASA ingestion validates coordinates, calendar dates, matching variable date sets, units, fill
  values and plausible ranges. Cross-process ingestion locks are stored in `DatasetIngestionLock`;
  failed run history is retained when successful data is replaced.

## API

| Method and URL | Purpose |
|---|---|
| `GET /api/health` | Process is alive |
| `GET /api/health/db` | Database reachable (503 if not) |
| `GET /api/health/data` | Per district: `nasa`, `synthetic` or `none`, plus recent failed ingestions |
| `GET /api/meta` | Form options, priority list, disclaimer |
| `GET /api/districts` | Districts with `climateData` status and dynamic shared-grid-cell metadata |
| `GET /api/crops` | Crops with their traits and `basis` |
| `GET /api/districts/:slug/climate` | Provenance, coverage and yearly climate indicators |
| `GET /api/districts/:slug/climate/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` | Calendar-complete real NASA POWER daily values for a capped date range; includes provenance, freshness, ETag and cache headers |
| `POST /api/fields` | Register a field boundary and optional soil metadata |
| `GET /api/fields` | List fields with GeoJSON boundaries |
| `GET /api/fields/:id` | Retrieve one field |
| `PATCH /api/fields/:id` | Update field metadata or boundary |
| `DELETE /api/fields/:id` | Delete a field |
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

An evaluation may also include `fieldId` for a registered field. The field must
belong to the selected district. Its stored salinity measurement is converted
to the evaluation salinity category, and the response includes the selected
field context. Other evaluation inputs, such as drainage and irrigation access,
remain explicit user inputs.

The response contains `strategies` (the existing rotation first, then three ranked alternatives). Each strategy has `score`, `components`, `benefits`, `risks`, `informationGaps`, `evidence` and, for alternatives, a `comparison` with the existing rotation. It also returns `climate` (with provenance and a notice when data are synthetic or missing), `method`, `limitations` and `disclaimer`.

Detailed field boundary and anonymous-session API documentation is in [FIELDS_API.md](./FIELDS_API.md).

## Database (Prisma schema in `backend/prisma/schema.prisma`)

- `District`, `Crop`: reference data (seeded from `src/data/reference/`).
- `DatasetRun`: one ingestion attempt per district (or, for a standalone grid-cell run, per cell) and source with source, endpoint, request parameters, retrieval time, fill value, units, row and missing counts, status (`SUCCESS` or `FAILED`), error message and notes. `districtId` is nullable: a district run has it, a standalone cell run has `NULL` and a `gridCellId`. Deleting a district cascades to its own runs only. Successful retention is scoped to the district, or to the cell for a cell run, plus the source and the synthetic/real category; `runScope` in `climateStore.js` refuses a run that has neither, so a delete can never match unrelated runs.
- `ClimateDaily`: legacy POWER-compatible daily precipitation (mm), maximum and minimum temperature (deg C), plus a nullable `measurements` JSON column that is reserved and currently unused (it will be dropped or reshaped when GPM IMERG is added). `null` means missing.
- `DatasetIngestionLock`: one row per running ingestion (`key`, `owner`, `acquiredAt`); a stale lock older than 30 minutes can be taken over. Used through raw SQL in `climateStore.js`. The key is per grid cell (`NASA POWER:grid:<cellKey>`), for district and cell ingestions alike.
- Field location: `Field.boundary` is a PostGIS `MultiPolygon`. `getFieldGeoContext` returns its representative point (`ST_PointOnSurface`) and an exact `spansMultipleCells` flag (polygon against the grid cells it touches); `src/geo/fieldLocation.js` turns that into the cell, caveats and response blocks. Climate for a field is the stored run of its representative point's cell (`getClimateByCell`).
- `Field.sessionId`: nullable for backward-compatible migration of pre-existing rows and populated
  for all new API-created fields; it has a unique index and is never exposed in API responses.

Migrations are plain SQL in `backend/prisma/migrations/` and are applied with `npm run db:deploy`.