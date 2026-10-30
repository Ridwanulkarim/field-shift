# Field Shift

NASA Space Apps Challenge 2026: **Field Shift: Adapting Farms with NASA Data**.

A decision-support tool for exploring crop-rotation options in Bangladesh. You pick a district, your current crops, your soil and your priorities. Field Shift compares your rotation with alternatives using NASA POWER climate data and simple, documented rules, and explains each option: the reasons, the evidence, the benefits, the risks and what it does not know. It supports farmer judgment and does not replace local agricultural expertise.

## What works and how far it has been verified

| Part | Status |
|---|---|
| API, rotation engine, validation, database layer | Built and covered by 108 automated tests (all passing against a real PostgreSQL) |
| Interface (English and Bangla labels, phone layout) | Built; checked in a real browser at phone width |
| Synthetic demo data | Works offline; always labelled **SYNTHETIC** |
| **Live NASA POWER download** | **Written but never run against NASA by its authors.** Your first `npm run ingest:nasa` is the real test |
| Crop traits and district coordinates | **Unverified assumptions.** Must be reviewed before submission (see `docs/DATA_SOURCES.md`) |
| Explanations text | English only (interface labels are bilingual) |

## Quick start

Full guide with Neon steps and troubleshooting: **[docs/SETUP.md](docs/SETUP.md)**.

```bash
cd backend
cp .env.example .env        # then paste your Neon connection strings into .env
npm install
npm run db:deploy           # create tables
npm run db:seed             # districts and crops
npm run ingest:nasa         # real NASA data (or: npm run db:seed:synthetic for demo data)
npm run dev                 # API on http://localhost:4000

# second terminal
cd frontend
npm install
npm run dev                 # app on http://localhost:5173
```

Requires Node.js 22.18 or newer.

## Layout

```
backend/    Express API, science, Prisma schema, scripts, tests
frontend/   React + Vite + Tailwind CSS single-page app
docs/       SETUP, ARCHITECTURE, DATA_SOURCES, SCIENTIFIC_METHOD, TESTING
```

## Commands (in `backend/`)

| Command | What it does |
|---|---|
| `npm run dev` / `npm start` | Start the API (dev restarts on change) |
| `npm test` | Run the automated tests |
| `npm run db:deploy` | Apply database migrations |
| `npm run db:seed` | Load districts and crops (safe to repeat) |
| `npm run ingest:nasa` | Download NASA POWER data (`-- --district=rajshahi` for one) |
| `npm run db:seed:synthetic` | Load labelled synthetic demo data |
| `npm run analyze:onset` | Compare early and late usable-rain onset dates (`-- --district=rajshahi --split=2013`) |

## Team rules

- Never commit `.env` files, keys or passwords.
- Never present synthetic or fixture data as a NASA observation.
- Never present a heuristic score as a yield or profit forecast.
- Work on branches and open pull requests.
