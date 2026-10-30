# Testing

Framework: Vitest (tests) and Supertest (HTTP). Working directory for all commands: `field-shift/backend`.

```bash
npm test                 # everything that needs no database
npm run test:watch       # re-run on save
TEST_DATABASE_URL="postgresql://..." npm test   # also run the database tests
```

Expected: `104 passed | 4 skipped` without a database, `108 passed` with one.

| File | Kind | What it checks |
|---|---|---|
| `health.test.js` | integration | `/api/health`, JSON 404, config parsing (valid and invalid `PORT`) |
| `api.test.js` | integration | All routes with a fake repository: 503 without a database, `/api/meta`, districts, crops, climate, `/api/evaluate` success, unknown district (404), invalid input (422), bad JSON (400), synthetic and missing-data notices |
| `validation.test.js` | unit | Request validation: defaults, ranges, unknown fields, path-like input, all problems reported at once |
| `stats.test.js` | unit | mean, rounding, linear regression, trend summary |
| `climate.test.js` | unit | Yearly rainfall, heat days, dry spell, usable-rain onset, coverage, with hand-built series and missing values |
| `calendar.test.js` | unit | Month windows that wrap around December |
| `rotation.test.js` | unit | Feasibility, candidate generation, scoring, explanations, determinism, single-crop and sparse rotations |
| `power.test.js` | unit | NASA POWER URL, response parser (fill values, wrong units, out-of-range values) and retry logic, using a clearly labelled **hand-built sample**, not NASA data |
| `validation-synthetic.test.js` | scientific | Trend detection on trend-free synthetic data stays near the chance rate |
| `db.integration.test.js` | integration | Real PostgreSQL: health check, ingestion storage, API end to end. Skipped without `TEST_DATABASE_URL` |

**Unit vs integration:** unit tests call one function with known inputs. Integration tests start the whole API (and optionally a real database) and call it over HTTP.

**Manual checks** (before every demo): `/api/health`, `/api/health/db`, `/api/health/data`; evaluate Rajshahi with Boro + Aman; confirm the banner matches the data actually loaded (NASA vs synthetic); switch to Bangla; test on a phone-width window.

**What is not tested automatically:** a live call to NASA POWER (no test may depend on the internet) and the React screens (checked by hand).
