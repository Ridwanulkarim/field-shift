# Crop data sourcing (Phase 4)

**Why this matters.** Every crop-level statement Field Shift makes (water need, heat exposure, salinity
tolerance, growing months) rests on `backend/src/data/reference/crops.js`. Today all 22 crops carry
`UNVERIFIED_GENERAL_KNOWLEDGE`: the values were typed in from general knowledge, not taken from a
BRRI, BARI or BARC table, and no agronomist has checked them. The API labels them that way. This work
replaces them with cited values. It needs no code, so teammates can start now.

## The sheet

Import `docs/templates/crop-traits-sourcing.csv` into a shared spreadsheet. It has one row per
crop and trait (22 crops x 9 traits = 198 rows). `current_value_UNVERIFIED` is what the code uses today.
Fill the other columns; do not edit that one.

| Column | What to enter |
|---|---|
| `verified_value` | The number exactly as the source gives it, in the unit in `unit_or_scale`. Leave blank if no source is found. |
| `status` | `unverified` (default), `verified`, `disputed` (two sources disagree: put both in `notes`), or `no_source_found`. |
| `source_title`, `source_organisation`, `source_year_or_edition`, `source_url` | Enough for someone else to find the same document. |
| `page_or_table` | The page, table or section where the number appears. Without it the row is not verified. |
| `region_or_variety_it_applies_to` | For example a variety, a season, or an agro-ecological zone. A value from one region is not automatically right for another. |
| `reviewer`, `review_date` | A second person who checked the number against the source. |

## Rules

1. **A number without a source stays `unverified`.** Never mark a value `verified` because it looks reasonable. This includes values suggested by an AI assistant, including Claude.
2. **Copy, do not round or convert silently.** If the source gives a range, enter both ends (`waterNeedMmMin` and `waterNeedMmMax`). If you convert units, say how in `notes`.
3. **Blank is better than a guess.** `no_source_found` is a good answer: the engine will treat that trait as unavailable instead of inventing it.
4. **One person enters, another reviews.** The reviewer reads the source page, not the sheet.
5. **Disagreement is data.** Record both values and both sources with `status = disputed`. We decide together which to use and write down why.

## Where to look

These are places to look, not citations. Confirm the exact edition and page yourself before entering anything.

- **BRRI** (Bangladesh Rice Research Institute): rice variety descriptions, rice cultivation handbooks, Aus, Aman and Boro seasons.
- **BARI** (Bangladesh Agricultural Research Institute): production technology handbooks for non-rice crops.
- **BARC** (Bangladesh Agricultural Research Council): fertiliser recommendation guide and agro-ecological zone documents.
- **DAE** (Department of Agricultural Extension): extension calendars and crop season guidance.
- **SRDI** (Soil Resource Development Institute): soil salinity survey reports and classes.
- **FAO Irrigation and Drainage Paper 56** (crop evapotranspiration, season lengths) and **Paper 29** (crop salinity tolerance thresholds), for traits Bangladeshi sources do not give numerically.

## Decisions to make before filling the sheet

These change what the columns should contain, so settle them as a team first.

1. **Salinity as a number.** The code uses a 1 to 5 tolerance scale. Published thresholds are usually numeric (electrical conductivity in dS/m). Recommendation: collect the numeric threshold, and replace the scale in code afterwards.
2. **Heat.** A single daily-maximum threshold is a simplification. Many crops are sensitive only at a stage (for example flowering). Record the stage when the source says so.
3. **Water need.** Decide whether the number means crop evapotranspiration alone or total water including land preparation and percolation losses (this matters a great deal for rice). Record which one each source means.
4. **Season months.** Sowing windows differ by region and variety. If sources give per-region windows, record each one; we may need a window per district.
5. **`inputIntensity`.** This is subjective. Source it or we drop it from the engine.

## After the sheet is filled

The next code step is a small import check that reads the CSV, rejects any row marked `verified` without a source, page and reviewer, and updates `crops.js` and each row's `basis`. Values that stay `unverified` keep the label in every API response.

## From sheet to app (how verified values get used)

1. Teammates fill the sheet (rules above).
2. `cd backend && npm run check:crops` lists every rejected row. A row marked `verified` without a source, page, region or variety, and reviewer is rejected, as is an out-of-range value or an AI assistant named as source or reviewer.
3. `npm run build:crop-sources` is a dry run that lists the values that would become verified. `npm run build:crop-sources -- --write` writes `backend/src/data/reference/cropSources.json` and refuses if any row is rejected.
4. Review the git diff of `cropSources.json` like code, commit it, then run `npm run db:seed` to update the database.
5. `crops.js` merges that file at start-up. Each crop then has `traitSources`: for every trait either `{ basis: "UNVERIFIED_GENERAL_KNOWLEDGE" }` or `{ basis: "VERIFIED", citation: {...} }`. `crop.basis` is `UNVERIFIED_GENERAL_KNOWLEDGE`, `PARTIALLY_VERIFIED` or `VERIFIED`. The original typed-in values stay in `BASE_CROPS` so the sheet's `current_value_UNVERIFIED` column keeps matching.

Never edit `cropSources.json` by hand: it is re-validated on load and the app refuses to start on an invalid entry.

## Soil rules

`docs/templates/soil-rules-sourcing.csv` lists the soil rules the code uses (salinity class cut points and the class-to-tolerance mapping). They are general-purpose assumptions, not an SRDI standard. Source them with the same rules as above. No code reads this sheet yet: when values are verified we will decide with the team how to apply them.
