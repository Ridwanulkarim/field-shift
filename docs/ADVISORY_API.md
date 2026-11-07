# Advisory API (contract for the frontend)

`GET /api/districts/:slug/advisory?crop=aman[&lang=bn][&split=2013][&usualFrom=07-15&usualTo=08-15]`

One call returns the decision, the evidence behind it and a sentence the farmer can act on. It is the planting-window analysis
(`/planting-window`, unchanged) presented as a decision. Nothing new is decided here.

| Query | Required | Meaning |
|---|---|---|
| `crop` | yes | Crop slug, for example `aman`, `aus`. |
| `lang` | no | `en` (default) or `bn`: which sentence is in `sentence.text`. Both are always returned. |
| `split` | no | Year dividing the early and late periods (default is the fixed project split). |
| `includeHeat` | no | `true` adds growing degree days as experimental evidence. Default `false`: heat is left out. It never affects the decision. |
| `usualFrom`, `usualTo` | both or neither | The farmer's own usual transplanting window as `MM-DD`. At most 120 days; 29 February is not accepted. |

Errors use the standard shape: 422 `VALIDATION_ERROR` (with `details[].field`), 404 `DISTRICT_NOT_FOUND`, 404 `NO_REAL_CLIMATE_DATA`
(never falls back to demo data), 503 when the database is unavailable.

## Response (fields to show, in this order)

1. `sentence.text` (end the screen on this) with `sentence.en` / `sentence.bn`. `sentence.reviewStatus` is `BANGLA_DRAFT_NOT_NATIVE_REVIEWED` until a native speaker has reviewed the Bangla.
2. `decision`: `action` (`delay`, `advance`, `none`), `direction`, `shiftDays`, `confidence` (`supported`, `weak`, `none`, `not_applicable`), `reason`.
3. `window` (null unless `usualFrom`/`usualTo` were sent): `usual`, `revised`, `changed`. This is the farmer's own window moved by the supported shift, not an agronomic recommendation.
4. `evidence.distributions.early` / `.late`: `valuesDayOfYear` (one value per year, for a dot plot), `summary` (min, q1, median, q3, max and `*Date` as `MM-DD`), counts of censored and unknown years. Day of year is on a 365-day calendar (1 June is 152).
5. `evidence.onsetDates` (median dates and measured shift), `evidence.excludedYears` (years left out and why), `evidence.strength` (p-value, definitions agreeing, start-boundary check, and `shiftEstimate` with a 95% interval), `evidence.heat` (null unless `includeHeat=true`; unverified parameters, never part of the decision).
6. `provenance`, `dataLabel`, `latestObservationDate`, `status`/`statusNote`, `limitations`, `disclaimer`. Show the limitations and status; this is an experimental result from one modelled rainfall source.

`ETag` and `Cache-Control: public, max-age=300` are set; send `If-None-Match` to get 304.

## What the result does not mean

Rainfall onset is a heuristic definition, the series is short, and a difference between two periods is an indication, not proof of
climate change. The advisory does not predict yield and does not replace local agricultural extension advice.

## Decision rule and what `confidence` means

The action comes from fixed rules in `rules.js`, decided before looking at any data:

| Rule | Value |
|---|---|
| Early and late periods | Split year 2013 (2001–2012 vs 2013 onwards), fixed in advance |
| Test | Two-sided Mann-Whitney on yearly onset days (ties and continuity corrected); years with no qualifying rain enter at day 244 (censored), not dropped |
| Significance | p below 0.05 |
| Minimum size | At least 1 day |
| Robustness | At least 60% of the alternative onset definitions (5 rain thresholds x 3 window lengths, same season start) reach the same verdict |
| Boundary check | If 50% or more of the years in a period start on the first day the search allows, the shift may be understated; no advice is given |
| Minimum data | At least 3 usable years in each period |

`confidence`: `supported` = a shift was found and passed the robustness check; `weak` = something was seen but it is definition-sensitive or boundary-limited, so no advice; `none` = no shift was distinguished from year-to-year variation (or too few usable years); `not_applicable` = no onset rule for this crop. The meaning is also returned in `decision.confidenceMeaning`.

### Reading a result such as p = 0.87 (Rajshahi Aman)
- A p-value of 0.87 says the two periods are entirely compatible with no difference. It does not prove there was no change.
- With 12 and 14 years the test can miss real shifts. The advisory therefore returns `shiftEstimate`: the estimated shift and a 95% interval (for the Rajshahi values, an estimate of 0 days with an interval of about −8 to +7 days). A shift inside that interval cannot be ruled out, and the sentence says so.
- "15 of 15 definitions agree" is not 15 independent confirmations: all vary only the rain threshold and window length on the same data and the same 1 June start. When many years start on 1 June, they share the same blind spot.
- Many district and crop pairs tested together will show a few "significant" results by chance alone.

## Partial years
A year is used only if its onset search was fully observed. An onset found before the data end is kept; a year with no rain seen when the data end before the season is over is excluded (`excludedYears`), never counted as "no onset". The period years shown in the sentence are the years actually used. Growing degree days are reported only when at least 98% of the crop's days are observed, so a year with data ending in October is left out of the Aman (July–November) heat figures.

## Other contract change: soil in `POST /api/evaluate`

Soil that is not entered is no longer filled in as `none` / `good`. `soil.salinity` and `soil.drainage` are now `null` when missing; the soil-match component (`soilFit`) is `null` and left out of the score; and `soilBasis` reports each as `entered`, `field_record` or `not_entered`. The strategy `informationGaps` says the soil match was not used. The frontend should show "soil not entered" instead of "good soil" when it sees `null`.

## Screening many districts

`npm run screen:advisory` (read-only) prints one table of every district and onset crop with a Holm correction for testing many pairs. It is for choosing what to examine, not a result: a few rows will look significant by chance, and districts that share a NASA grid cell count once.
