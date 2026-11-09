# Offline mode (the wifi-off demo)

Without PostgreSQL/PostGIS the API used to answer 503. It now has a file-based data source.

## What is stored

`backend/data/offline/<district>.json` holds the **real NASA POWER daily series** of one district exactly as the database stored it
(date, precipitation, Tmax, Tmin) plus its provenance: source, run id, retrieval time, request parameters, units. Each file carries a
sha256 of its provenance and rows. A file that was edited by hand, truncated, not strictly ascending by date, labelled synthetic, or whose
source is not "NASA POWER" is **refused** (the reason is printed at start-up and the district is simply not served). `manifest.json` lists
what was exported. Synthetic data cannot be exported or served.

**The folder is empty in the repository until you create the files**, because the real downloads exist only in your database:

```bash
cd backend
npm run export:offline                       # every district with real stored data; or: -- --districts=rajshahi,bogura
npm run check:offline                        # validates the files and runs the advisory from them, no database, no network
git add data/offline && git commit -m "Offline climate snapshot (real NASA POWER)"
```

## How the API chooses (decided once, at start-up)

| Situation | Mode (`/api/health` -> `dataMode`) |
|---|---|
| `OFFLINE=1` | `offline-files`. The database is never opened and the network is never used. Fails fast if there are no valid files. |
| Database configured and files exist | `database-with-offline-fallback`. If a database read **fails** (not if it returns nothing), that read is answered from the files, and for 30 s every read goes to the files so one request never mixes two sources. Then the database is tried again. Each fallback is logged and `degraded` is `true` in `/api/health`. |
| Database configured, no files | `database` (as before) |
| No database, files exist | `offline-files` |
| Neither | `none`: data routes answer 503 |

Every response served from a file says so: `provenance.servedFrom = "offline-file"`, `dataLabel.servedFrom`, the original retrieval time, the
export time and a note. A response from the database says `servedFrom: "database"`. Nothing is silently substituted.

What does **not** work offline: the field endpoints (`/api/fields...`, boundaries) need PostGIS and answer 503 with an explanation; IMERG cross-checks.
District advisories, climate, crops and `POST /api/evaluate` (district level) all work.

## Running the demo with wifi off

```bash
cd frontend && npm run build               # once, while online
cd ../backend
npm run start:offline -- --with-frontend   # API + built page on http://localhost:4000, OFFLINE=1
```

Rehearsal checklist: wifi off -> open http://localhost:4000 -> pick Rajshahi + Aman -> the card shows the data label "offline file"
-> `curl localhost:4000/api/health` shows `"dataMode":"offline-files"` -> `npm run check:offline` exits 0.
Same-origin POSTs (the page served by this server) are accepted; a POST from any other origin is still rejected with 403.

## Honest limits

- The snapshot is as old as the export. The advisory shows the data end date and the retrieval time.
- Jashore and Khulna share one NASA grid cell (about 0.5 degrees), so their files hold identical series. The API reports this in
  `sharedGridCellWith`; say so in the demo.
