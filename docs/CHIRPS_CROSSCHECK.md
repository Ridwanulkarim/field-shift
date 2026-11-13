# CHIRPS cross-check (via NASA SERVIR ClimateSERV)

**Question:** does the planting advisory's usable-rain onset (and its early-vs-late shift) depend on using NASA POWER rainfall? We repeat the same calculation with a second, independent rainfall product and compare the results year by year.

**Not a validation against ground truth.** CHIRPS is itself a satellite-plus-station estimate. Agreement raises confidence; disagreement tells us how much the advisory depends on its source. Neither source measures a single farm.

## Sources
| | NASA POWER (existing) | CHIRPS (new, diagnostic) |
|---|---|---|
| Made by | NASA (model/satellite-based) | UC Santa Barbara Climate Hazards Center with USGS |
| Reached through | POWER API, stored in `data/offline/` | NASA SERVIR ClimateSERV, stored in `data/chirps/` |
| Area | one 0.5 x 0.625 degree grid cell | the **same cell**, as an area average (polygon) |
| Record | 2001-2025 as stored | 1981 to present (we fetch 2001-2025 to match) |

CHIRPS's own grid is finer than a POWER cell (the ClimateSERV documentation does not state it; check before quoting a figure).

## Status of the code
`src/integrations/climateserv/climateserv.js` follows the public ClimateSERV API documentation. It was run live by the team for Rajshahi (one-month probe, then 2001-2025: 9131 days, 0 missing; samples looked like mm/day). Its parsers stay strict and refuse anything unexpected (gaps, duplicates, fill or negative values become missing, never zero). Unit tests use clearly labelled fixtures.

## Steps
1. **Probe** (one month): `npm run fetch:chirps -- --district=rajshahi --from=2020-06-01 --to=2020-06-30 --out=/tmp/chirps-probe`. Read the printed sample. Values should be plausible mm/day (0 to a few tens in June). If the script refuses the response, its message says what differed; fix the parser, do not loosen it blindly.
2. **Fetch Rajshahi** 2001-2025 (25 requests, one per year): `npm run fetch:chirps -- --district=rajshahi`.
3. **Compare**: `npm run compare:chirps -- --district=rajshahi`. Read: the year-by-year table, how many years are within 3 and 7 days, whether the early-vs-late verdict and shift match, and how many onsets fall on the first allowed day in each source.
4. **Decide** from those numbers (this is a judgement, no threshold is built in). Only if the two sources tell the same story, run `--district=all` for the other 11 districts.
5. Only after that, consider a separate "this week" forecast panel (CHIRPS-GEFS). It is a different product with its own validation and is not started.

## What each outcome means
- **Close agreement and the same verdict:** the advisory's conclusion does not hinge on POWER. Say so in the advisory's source note, with both sources named.
- **Close dates but a different verdict:** the shift is near the test's threshold; report the verdict as uncertain.
- **Different dates:** the advisory depends on its rainfall source. Keep the "one modelled source" caveat and the experimental labels, and say how large the difference is.

## Result for Rajshahi (run by the team, 2001-2025, same POWER cell)
| Crop | Verdict POWER | Verdict CHIRPS | Shift POWER / CHIRPS | Median abs. difference | Within 7 days | r |
|---|---|---|---|---|---|---|
| Aus | earlier onset | earlier onset | -14.5 / -14 days | 9 days | 32% | 0.63 |
| Aman | no distinguishable shift | no distinguishable shift | +2.5 / +3.5 days | 4 days | 68% | 0.37 |

Reading: the **early-vs-late verdicts agree**, but **individual years only agree moderately**. POWER puts 24% of Aus onsets (2017-2022 in particular) on the first allowed day, 1 May, against 4% for CHIRPS, so POWER may be pinned at the window edge in those years. These are our measurements for one district; they say nothing about the other eleven until those are run.

## How it appears in the product
- `npm run compare:chirps` writes `data/chirps/compare-<slug>.json` (summary, daily alignment, SHA-256 of both series).
- At start-up the API reads those reports (`createCrossCheckProvider`). If a report exists for a district and crop, the advisory response carries `crossCheck` and the sentence's source caveat changes from "one modelled source" to "second source agrees / differs". **The decision and the window are never changed by the cross-check.** No report, no change.
- The advisory page shows the comparison in a section "Checked against a second source".
- Restart the backend after running the compare script.

## Daily alignment check
The compare script also prints the correlation of daily rainfall at lags of -2..+2 days. The best lag should be 0. If it is 1 or -1, the two products' day boundaries differ (for example UTC versus local day), and onset differences of a day or two are partly an artefact. Not yet verified: run `npm run compare:chirps -- --district=all` and read the table.

## Forecast probe
`npm run probe:climateserv` prints the raw parameter and dataset listings. A 10-day "this week" panel is intentionally not built: the forecast dataset numbers are unknown until the probe output is seen.
