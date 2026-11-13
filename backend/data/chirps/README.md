# CHIRPS cross-check files

This folder holds daily **CHIRPS rainfall** (area average over the same NASA POWER grid cell the advisory uses), one `<district>.json` per district, fetched through NASA SERVIR **ClimateSERV**. It is used only to check the NASA POWER rainfall that the planting advisory is built on. It is **not** used in any advisory yet.

**It is empty until you run the fetch.** Never put test or stand-in data here (the fetch script refuses to).

```bash
cd backend
npm run fetch:chirps -- --district=rajshahi --from=2020-06-01 --to=2020-06-30 --out=/tmp/chirps-probe   # 1. probe: one month, check the sample values
npm run fetch:chirps -- --district=rajshahi                                                               # 2. the real 2001-2025 fetch
npm run compare:chirps -- --district=rajshahi                                                             # 3. onset dates side by side
```

Full guide: [docs/CHIRPS_CROSSCHECK.md](../../../docs/CHIRPS_CROSSCHECK.md).
