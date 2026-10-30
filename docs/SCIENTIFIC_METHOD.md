# Scientific method

All tunable numbers are in `backend/src/science/rules.js`. None is a NASA result; they are modelling choices that a domain expert should review. The score is a **heuristic for comparing options**. It does not predict yield, profit or soil improvement.

## 1. Climate indicators (from NASA POWER daily data)

Computed per calendar year, years with less than 90% of days present are skipped (`MIN_COVERAGE`).

| Indicator | Definition |
|---|---|
| Monsoon rainfall | Sum of daily corrected precipitation, 1 June to 30 September (mm) |
| Dry-season rainfall | Sum, 1 November to 31 March (mm) |
| Usable-rain onset | First day on or after 1 May whose 7-day rainfall total is at least 50 mm, searched until 31 August (day of year). **Our own heuristic definition, not an official onset index** |
| Pre-monsoon hot days | Days in March to May with maximum temperature at or above 35 deg C |
| Longest dry spell | Longest run of days below 1 mm in November to March |

**Trend statement.** For each indicator we show the mean of the earliest and latest block of years (10 years each for a 25-year series; the response states the block length) and a least-squares line over years. A trend is called "distinguishable from year-to-year variation" only if the slope's |t| is at least 2. With 25 yearly points this is a rough hint: on trend-free synthetic series it flags about 5% by chance alone (`validation-synthetic.test.js` checks this). It is never presented as proof of climate change, and fewer than 10 years gives "insufficient data".

The backend CLI `npm run analyze:onset` provides a separate early-versus-late comparison for onset dates. It reports the difference in median day-of-year and a two-sided Mann-Whitney test: an exact permutation distribution when there are no ties and an asymptotic, tie-corrected normal approximation otherwise. A result is labelled earlier or later only when the p-value is below 0.05; this is an exploratory comparison, not proof of a climate trend. Years without a qualifying onset are omitted, and fewer than three observations in either period is reported as insufficient data.

## 2. Per-crop climate (for scoring)

For a crop with typical months M, over the years with enough data:

- `rainMm` = mean total rainfall in M.
- `heatFraction` = mean share of days in M with maximum temperature at or above the crop's `heatThresholdC`.

## 3. Candidate rotations

A rotation is 1 to 3 crops that fit in one 12-month cycle on the same plot; two crops may share at most one month (turnaround). All such sets of 2 to 3 crops are generated and scored. The farmer's existing rotation is always evaluated and shown as the baseline. The three best-scoring alternatives are returned. An existing rotation that does not fit one year is rejected with a 422 and the reason.

## 4. Score (0 to 100)

Weighted average of components in [0, 1]. A component that cannot be computed (no climate data) is **left out and the remaining weights renormalised**, with an explicit information gap, instead of being guessed.

| Component | Value | Weight |
|---|---|---|
| `waterFit` | 1 - (irrigation need / water need) x access factor. Irrigation need = max(0, mean of crop's water-need range - rain). Access factor: none 1.0, limited 0.6, reliable 0.3 | 1 |
| `heatFit` | 1 - min(1, heatFraction x (heatSensitivity / 5) x 3) | 1 + heat priority |
| `soilFit` | 1 - min(1, (salinity level - crop tolerance)+/3 + (drainage level - crop tolerance)+/3) | 2 |
| `waterSaving` | 1 - min(1, total irrigation need (mm) / 1000) | water priority |
| `soilHealth` | 0.5 if a legume is included + 0.5 x family variety | soil priority |
| `diversification` | min(1, number of crops / 3) | diversification priority |
| `lowInput` | 1 - (mean input intensity - 1) / 4 | cost priority |

Farmer priorities are integers 0 to 3 (default 1) and set the weights of the priority-driven components. The score deliberately ignores how many months the plot is cropped (that would imply an income claim); a drop in cropping intensity is listed as a trade-off instead.

## 5. Explanations

Every strategy returns benefits, risks, information gaps and per-crop evidence (assumed water need, mean rainfall in the crop's months, share of hot days, and the status of the crop parameters). Alternatives also list where they beat the existing rotation and what they give up, each with the size of the difference in points.

## 6. What the method does not claim

- No yield, profit or income forecasts.
- No claim that rainfall alone decides sowing dates, or that grid-cell values describe a particular farm.
- Crop parameters are unverified assumptions until reviewed.
- Soil is only the farmer's two selections.

## 7. Validation done

- Unit tests with hand-computed expected values for every indicator, boundary cases, missing values and invalid inputs (`backend/tests/`).
- Trend code checked on 60 synthetic trend-free series (false-positive rate near chance).
- API and database integration tests, including the no-database and no-climate-data paths.

Still needed: review of crop parameters by an agronomist, a first live NASA run, and comparison of a few indicators against an independent source.
