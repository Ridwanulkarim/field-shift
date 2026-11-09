# Offline climate files

This folder holds committed snapshots of **real NASA POWER daily data**, one `<district>.json` per district plus `manifest.json`, so the API and the demo work with no database and no internet (`OFFLINE=1`).

**It is empty until you create the files.** They can only come from your database, because that is where the real downloads are stored:

```bash
cd backend
npm run export:offline      # while the database is reachable
npm run check:offline       # validates the files and runs the advisory from them
git add data/offline && git commit -m "Offline climate snapshot (real NASA POWER)"
```

Rules: never edit these files by hand (a sha256 inside each file detects it and the file is then refused); never put synthetic or fixture data here (the exporter and the loader both refuse it). Full guide: [docs/OFFLINE.md](../../../docs/OFFLINE.md).
