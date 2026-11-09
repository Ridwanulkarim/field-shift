# Bangla review

Every Bangla sentence Field Shift can show is a **machine-assisted draft that no native speaker has reviewed**. The API says so in `reviewStatus: BANGLA_DRAFT_NOT_NATIVE_REVIEWED`. It must stay that way until the steps below are done.

## For the reviewer
Open `docs/templates/bangla-review.csv` in Excel or Google Sheets (UTF-8; it opens correctly). Each row has an English sentence and its Bangla draft. For each row fill in:

| Column | What to enter |
|---|---|
| `verdict` | `ok` if the Bangla is correct and natural; `change` if it needs fixing; `unclear_english` if the English is unclear |
| `corrected_bangla` | Your wording, only when the verdict is `change` |
| `reviewer`, `review_date` | Your name and the date (YYYY-MM-DD) |
| `notes` | Anything else, such as a better term |

Please judge: correct meaning; plain words a farmer in Bangladesh would understand; polite, not commanding, tone; consistent terms (for example how "usable rain", "transplanting", "median" are written); natural number and date wording. Please **ignore the numbers and dates in the examples**: they are invented to show the wording and are not real results. Notes on the English are also welcome.

## For the developer
1. `cd backend && npm run export:bangla` regenerates the sheet from the real code (no database or network needed).
2. Apply corrections to the Bangla strings in `src/science/plantingAdvisory.js`, `farmerAdvisory.js` and `fieldSummary.js`, and to `nameBn` / `labelBn` in the reference data. Never edit the sheet instead of the code.
3. Re-run `npm test` and `npm run export:bangla`, and give the reviewer the new sheet to confirm every row is `ok`.
4. Only then change `reviewStatus` from the draft label, and record the reviewer's name and date here:

| Reviewer | Date | Scope | Result |
|---|---|---|---|
| (none yet) | | | |
