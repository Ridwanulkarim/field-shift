# How AI was used in this project

NASA Space Apps asks teams to say where AI tools were used. This page is the record. Update it when that changes.

| Area | What AI did | What a human must still confirm |
|---|---|---|
| Code | An AI assistant (Claude) helped write and refactor the backend (API, science modules, tests, offline mode) in sessions directed by a team member. | Review every change; run `npm test` yourself. A passing test proves the code does what the test says, not that the science is right. |
| Crop traits (`backend/src/data/reference/crops.js`) | An AI assistant typed the water need, heat threshold, tolerances, months and input intensity from general knowledge. They are labelled `UNVERIFIED_GENERAL_KNOWLEDGE` and are **not** from a BRRI, BARI or FAO table. | An agronomist must review the crops used in the demo. Verified values enter only through `docs/templates/crop-traits-sourcing.csv` -> `npm run check:crops` -> `npm run build:crop-sources -- --write`. Today 0 of 198 trait rows are verified. |
| Cropping patterns (`croppingPatterns.json`) | An AI-generated summary of publication pages was used to record pattern names, regions and area shares. Status: `SECONDARY_READING_NOT_AGRONOMIST_VERIFIED`. | Check each row against the original paper before calling it "BRRI-documented". |
| Bangla text | AI-drafted. | A native speaker must review every row of `docs/templates/bangla-review.csv` (`npm run export:bangla`) and the reviewer must be recorded in `docs/BANGLA_REVIEW.md`. Until then the response says `BANGLA_DRAFT_NOT_NATIVE_REVIEWED`. |
| Documentation | AI-assisted drafting. | Read it against the code. |

## What AI did not do

- It did not produce, alter or invent NASA data. Climate series come from NASA POWER downloads stored with their provenance; synthetic data is labelled and can never be exported to the offline files or used for an advisory.
- It did not decide the scientific conclusion. The planting-window result is computed by deterministic, tested code (Mann-Whitney test, Hodges-Lehmann interval, Holm correction). The current honest result for Rajshahi Aman is "no clear change".
- The rotation score is a transparent heuristic, not a trained model and not a yield or profit forecast.
