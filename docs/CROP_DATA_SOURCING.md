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
