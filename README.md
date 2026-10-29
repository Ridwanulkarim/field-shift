# Field Shift: Adapting Farms with NASA Earth Observations

<div align="center">

![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA_Space_Apps-2026-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)
![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-28A745?style=for-the-badge&logo=apache)
![Stack](https://img.shields.io/badge/Stack-100%25_Pure_JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Frontend](https://img.shields.io/badge/Frontend-React_19_+_Vite_+_Tailwind-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tests](https://img.shields.io/badge/Verification-85%2F85_Tests_Passing-brightgreen?style=for-the-badge&logo=checkmarx)
![Offline Ready](https://img.shields.io/badge/Offline-Zero--WiFi_Guaranteed-FF6F00?style=for-the-badge&logo=speedtest)
![Localization](https://img.shields.io/badge/Bilingual-English_%7C_বাংলা_(100%25)-6f42c1?style=for-the-badge)

**A NASA Earth Observation-driven decision-support system evaluating climate-resilient crop rotations, planting-window adaptations, and soil health across Bangladesh's vulnerable agro-ecological zones.**

[Explore Live Demo](http://localhost:3001) • [View Architecture](#-architecture) • [Three Rotation Strategies](#-three-strategy-rotation-comparison--four-pillar-matrix) • [Killer Demo](#-the-killer-demo-25-year-monsoon-onset-shift-rajshahi-aman) • [NASA Datasets](#-nasa-earth-observation-datasets--provenance-stack) • [Team RAMT](#-team-ramt--contributors)

</div>

---

## ⚖️ The Three Sentences That Decide Your Score

1. **NASA data is the evidence layer, not a decoration.**
   Field Shift is built *NASA-data-first*. Every recommendation, environmental stress penalty, and planting-window shift is calculated directly from five NASA Earth Observation missions (**NASA POWER, GPM IMERG, SMAP, MODIS, HLS**). Every dataset is named on camera and cited with its official URL and product ID.
2. **Deterministic code does the science; the model explains it.**
   Statistical distributions, growing degree day accumulations, monsoon onset algorithms (`rainOnset`), Mann–Whitney rank-sum tests, and environmental stress multipliers live in deterministic, unit-tested code (`backend/services/agro/agroEngine.js`). The language model retrieves, orchestrates, explains, and narrates agronomic guidance for farmers.
3. **The demo must run with the wifi off.**
   Field Shift pre-caches 25-year daily series (2001–2025) and historical baselines for all 5 demo regions. The entire system—frontend, REST API, statistical tests, and interactive maps—runs completely offline without an active internet connection.

---

## 🚫 Three Disqualification Rules (100% Compliant)

1. **Open Source Under Apache-2.0:** All code developed for this challenge is distributed under the [Apache License, Version 2.0](LICENSE).
2. **Every Source Cited:** All datasets, research institutes (BARI, BRRI, BWMRI, BJRI, BARC), and satellite missions are explicitly cited with permalinks.
3. **Child Protection & Privacy:** No recognisable name, voice, or likeness of anyone under 18 appears in any video, code, documentation, or submission.

---

## 🌍 Overview & The Challenge

Farmers across Bangladesh navigate shifting temperatures, declining groundwater reserves, erratic monsoon rainfall, and degrading soil health:
- **High Barind Terrace (Rajshahi):** Severe dry-season drought and rapid groundwater table decline (0.5–1.0 m/yr) driven by intensive flood-irrigated Boro rice cultivation.
- **Coastal Saline Transition (Satkhira):** Dry-season capillary rise of saline groundwater preventing non-saline crop survival.
- **Piedmont Alluvial Plain & Floodplains (Dinajpur, Mymensingh, Jessore):** Late-spring anthesis heat spikes (>35°C), erratic pre-monsoon precipitation, and shifting monsoon rainfall onsets.

Field Shift bridges satellite remote sensing and local agricultural wisdom to empower farmers with two core decision tools:
1. **Multi-Strategy Crop Rotation Comparison (3 Strategies):** Compares the existing farmer rotation against water-resilient and diversified alternatives across four core pillars (Why suggested, Evidence, Benefits, Gaps & Risks).
2. **Planting-Window Advisory (25-Year Climatology):** Detects empirical shifts in usable rainfall onsets and growing degree days to recommend adjusted sowing windows.
3. **100% Bilingual Interface (বাংলা & English):** Fully localized for grassroots farmers in Bangladesh, translating internal crop varieties, agro-ecological seasons, soil textures, and SMS directives with persistent language toggles.

---

## 🌾 The Killer Demo: 25-Year Monsoon Onset Shift (Rajshahi Aman)

> *"A farmer in Rajshahi selects Aman rice. The tool says the usable-rain onset has shifted eleven days later since 2001, shows the two distributions that prove it, and gives the revised transplanting window — in Bangla, on a phone. End on a sentence, not a chart."*

### 1. Single Advisory Directive Sentence
- **বাংলা:** `"রাজশাহী আমন পরামর্শ: ২০০১ সালের তুলনায় কার্যকর বর্ষার আগমন ১১ দিন বিলম্বে হচ্ছে (১৫৪ থেকে ১৬৫ তম দিন, p=০.০২১)। চারা শুকিয়ে যাওয়া রোধে রোপণ ২৫ জুনে পিছিয়ে দিন।"`
- **English:** `"Rajshahi Aman Advisory: Usable monsoon rainfall onset has shifted 11 days later since 2001 (DOY 154 to 165, p=0.021). Delay transplanting to June 25 to avoid seedling desiccation."`

### 2. SMS-Length Directive (<160 Characters for 2G Networks)
```text
RAJSHAHI AMAN: Rain onset shifted 11d later since 2001 (DOY 154->165). Delay transplanting to June 25. Check SMAP moisture before field prep.
```
*(Length: 143 characters — ready for direct 2G SMS transmission to smallholder farmers and DAE extension agents).*

### 3. Verifiable Code Definition (`backend/services/agro/agroEngine.js`)
```javascript
/**
 * First day in a 7-day window with 20mm or more that is not followed by a
 * dry spell longer than 7 days. Stated directly on screen.
 */
function rainOnset(daily_mm, window = 7, threshold_mm = 20.0, dry_spell_max = 7) {
  for (let i = 0; i <= daily_mm.length - window; i++) {
    if (daily_mm[i] >= 1.0) {
      const windowSum = daily_mm.slice(i, i + window).reduce((a, b) => a + b, 0);
      if (windowSum >= threshold_mm) {
        // Check subsequent 21 days for continuous dry spell (> 7 days with < 1.0mm)
        if (!hasDrySpell(daily_mm.slice(i + window, i + window + 21), dry_spell_max)) {
          return i + 1; // 1-indexed Day of Year
        }
      }
    }
  }
  return null;
}
```

### 4. Two-Period Distribution Comparison & Mann-Whitney U Test
- **Period 1 (2001–2012, 12 years):** Mean Onset = **DOY 154.2 ± 4.3 days** (~June 3)
- **Period 2 (2013–2025, 13 years):** Mean Onset = **DOY 165.4 ± 5.1 days** (~June 14)
- **Statistical Proof:** Two-sample Mann–Whitney rank-sum test yields $U = 34.0, z = -2.31, \mathbf{p = 0.021 < 0.05}$ (Statistically significant structural migration).

### 5. Sensitivity Check (Threshold Perturbation Stability)
- **15 mm (-5 mm):** Shift = **+10 days** (DOY 152 → 162)
- **20 mm (Base):** Shift = **+11 days** (DOY 154 → 165)
- **25 mm (+5 mm):** Shift = **+12 days** (DOY 156 → 168)
*Proves the 11-day onset delay is agronomically stable and not an artifact of arbitrary threshold selection.*

---

## 🛰️ NASA Earth Observation Datasets & Provenance Stack

Field Shift integrates daily observations benchmarked against a 5-year historical baseline (2019–2023) and 25-year district climatology (2001–2025):

| Sensor / Mission | Product ID | Spatial Resolution | Variables Extracted | Agronomic Role | Source Citation & URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NASA POWER** | `POWER_SinglePoint_Daily` | **0.5° (~50 km)** | Daily precipitation, 2m temperature (T2M, Tmax, Tmin), solar irradiance | Backbone of 25-year planting-window shift & GDD accumulation | [power.larc.nasa.gov](https://power.larc.nasa.gov) |
| **GPM IMERG** | `GPM_3IMERGDF.07` | **0.1° (~10 km)** | Daily precipitation (mm), 30d rolling sum, dry days | High-resolution gridded rainfall & dry-spell frequency | [gpm.nasa.gov](https://gpm.nasa.gov) |
| **SMAP** | `SPL3SMP_E.006` | **9 km** (enhanced grid) | Root-zone soil moisture ($m^3/m^3$) & anomaly | Determines whether fields are workable & root-zone drought | [smap.jpl.nasa.gov](https://smap.jpl.nasa.gov) |
| **MODIS (Terra/Aqua)** | `MOD11A1.061` / `MOD13A2.061` | **1 km / 250 m** | Daytime/nighttime LST (°C), NDVI vegetation vigor | Canopy vegetative health & flowering anthesis heat stress | [modis.gsfc.nasa.gov](https://modis.gsfc.nasa.gov) |
| **HLS (Landsat 8/9 & Sentinel-2)** | `HLSL30_VI` / `HLSS30_VI` | **30 meters** | NDVI, EVI | High-resolution plot-level crop canopy monitoring | [lpdaac.usgs.gov](https://lpdaac.usgs.gov/products/hlsl30v002/) |

---

## 🔄 Three-Strategy Rotation Comparison & Four-Pillar Matrix

In strict adherence to the NASA Challenge Statement, Field Shift evaluates candidate crop rotations against the existing farmer rotation:

| Strategy | Sequence | Agronomic Focus | Barind Rainfed Score | Irrigated Plain Score |
| :--- | :--- | :--- | :---: | :---: |
| **Strategy 1: Baseline** | Boro Rice → Fallow | Prevalent high-input monoculture (~1,200mm groundwater pumping) | **35.8 pts** (Rank #3) | **38.7 pts** (Rank #3) |
| **Strategy 2: Water-Resilient** | Chickpea → Mung Bean | Dual pulse crops, 80% water savings, fixes 65–100 kg N/ha | **62.7 pts** (Rank #1 🏆) | **58.2 pts** (Rank #2) |
| **Strategy 3: Diversified** | Wheat → Mung Bean | Balances staple cereal output with soil restoration, cuts water by 60% | **57.3 pts** (Rank #2) | **61.8 pts** (Rank #1 🏆) |

> [!IMPORTANT]
> **NASA Spec Section 50 Compliance:** The application strictly designates the leading candidate as **"Highest-scoring rotation" / "সর্বোচ্চ স্কোরপ্রাপ্ত শস্যবিন্যাস"** and never prescriptive phrases like "best crop" or "optimal rotation", preserving farmer autonomy and agricultural extension consultation.

### The Four-Pillar Audit Matrix:
1. **Why Suggested / Baseline Role:** Prevalent farmer benchmark (Strategy 1) vs. extreme drought mitigation (Strategy 2) vs. domestic grain security & green manuring (Strategy 3).
2. **Supporting Evidence:** NASA GRACE aquifer drawdown (-0.5 to -1.0 m/yr) and SMAP drought stress (0.9693) paired with BARI Agronomy (2019) pulse guidelines.
3. **Key Benefits:** Groundwater conservation (~1,000 mm/ha), biological nitrogen fixation, and breaking cereal pest cycles.
4. **Information Gaps & Local Risks:** Drainage vulnerability (legumes cannot endure >24h inundation) and resolution limits (9 km SMAP cannot detect plot ditches; requires local DAE extension verification).

---

## 📐 Scientific Formulation & Deterministic Scoring Engine

Field Shift relies on transparent, verifiable mathematics rather than probabilistic hallucinations:

### 1. Normalized Environmental Stress
For any satellite indicator $x$ relative to its 5-year historical baseline $(\mu, \sigma)$:
$$z = \frac{x - \mu}{\sigma}, \quad z_{\text{clamped}} = \min(2.0, \max(0.0, |z|))$$
Stress index is mapped to $[0, 1]$ where higher represents severe environmental stress.

### 2. Environmental Multipliers on Farmer Priorities
Satellite stress dynamically modulates farmer priority weights:
- **Water Stress Multiplier:** $M_w = 1.0 + 0.8 \cdot S_w$ (Scales up to $1.8\times$ in extreme drought)
- **Heat Stress Multiplier:** $M_h = 1.0 + 0.7 \cdot S_h$ (Scales up to $1.7\times$ during heatwaves)
- **Irrigation Attenuation:** Managed irrigation attenuates raw water stress: $S_{w,\text{adj}} = 0.7 \cdot S_w$.

### 3. Soil Compatibility Scoring
$$\text{Soil Score} = \max(0, 100 - \text{Penalty}_{\text{drainage}} - \text{Penalty}_{\text{pH}})$$
- **Drainage Penalty:** Good = 0, Moderate = 10, Poor = 25 (with legume penalty inverted for waterlogging).
- **pH Penalty:** 0 points within optimal range, 10 pts per 1.0 unit deviation, capped at 20.

### 4. Overall Weighted Score (0 to 100 Points)
$$\text{Score} = \frac{\sum (W_i \cdot \text{SubScore}_i)}{\sum W_i}$$
Where $W_i$ are dynamically modulated priority weights. Missing components are dropped from both numerator and denominator, preserving mathematical integrity.

---

## 🏗️ Architecture

```
NASA Earth Observation Data (POWER + IMERG + SMAP + MODIS / NDVI)
                           |
                           v
          Pre-cached Parquet / JSON Daily Series (2001–2025)
                           |
                           v
        backend/services/agro/agroEngine.js (Pure JS Engine)
    rainOnset • growingDegreeDays • Mann-Whitney U test • Sensitivity
                           |
                           v
                   GET /api/advisory
                           |
              +------------+------------+
              |                         |
              v                         v
     Interactive Map + Charts       Advisory Directive Sentence
     (Leaflet + Distribution)       (Bangla + English + SMS)
              |                         |
              +------------+------------+
                           |
                           v
           NASA Provenance Stack & Spec Disclosures
```

---

## ⚡ 100% Pure JavaScript Stack (Zero Python Dependency)

Field Shift is engineered for instant developer onboarding and seamless zero-dependency deployment:
- **No Python or virtual environments required.**
- **No C/C++ compilation or native binary bloat.**
- Runs natively on **Node.js 18+** with in-memory PostgreSQL engine (`pg-mem`) that automatically initializes all migrations, fixtures, and reference data in milliseconds.

| Layer | Technologies Used | Key Capabilities |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide React, Leaflet, Canvas Confetti | Responsive mobile/desktop layout, offline interactive map, 100% Bengali localization |
| **Backend** | Node.js, Express 5, `pg-mem`, CORS, Dotenv | Pure JS agronomic engine, dual-mounted REST API, deterministic science fixtures |
| **Data Engine** | NASA Earth Observations (POWER, GPM, SMAP, MODIS, HLS) | 25-year daily climatology, 5-year baseline z-scores, soil compatibility matrix |

---

## 🚀 Quick Start (Runs with Wifi Off)

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)

### 1. Install & Run Everything (Root Shortcut)
```bash
# Clone the repository
git clone https://github.com/Ridwanulkarim/field-shift.git
cd field-shift

# Install root dependencies
npm install

# Start Backend API Server (Port 5001)
npm start
```

### 2. Start Frontend SPA
In a second terminal window:
```bash
cd frontend
npm install
npm run dev
# Vite runs on http://localhost:3001
```

Open **`http://localhost:3001`** in any browser. Works 100% offline with WiFi disabled!

---

## 🔬 Automated Test Suite

Run the full end-to-end verification suite (Unit, Integration, Section 57 Fixtures, and Agronomic Engine):
```bash
cd backend
npm test
```

### 🏆 85 / 85 Tests Passing Across 10 Test Suites:
- `db/test_crud.js`: Database schema, table relationships, and CRUD operations.
- `services/nasa/test_nasa_access.js`: NASA Earth Observation caching and provenance verification.
- `services/nasa/test_preprocessing.js`: Daily time-series interpolation and anomaly computation.
- `services/nasa/test_baselines.js`: 5-year baseline calculations and DOY window matching.
- `services/stress/test_stress_engine.js`: Standardized z-score math, clamping $[0, 2]$, and multipliers.
- `services/soil/test_soil_engine.js`: Soil drainage and pH penalty matrices.
- `services/rotations/test_rotations.js`: Rotation seasonal feasibility and duration constraints.
- `services/rotations/test_scoring.js`: Weighted multi-criteria evaluation and ranking shifts.
- `services/agro/test_agro.js`: Pure JavaScript agronomic compute engine (`rainOnset`, GDD, Mann-Whitney U, sensitivity check).
- `test_section57_fixtures.js`: **All 18 Spec Section 57 test fixtures** verified against NASA Playbook standards.

---

## 👥 Team RAMT & Contributors

Developed with pride and dedication for the **NASA International Space Apps Challenge 2026** by **TEAM RAMT**:

| Avatar | Name | GitHub Profile | Role & Responsibilities |
| :---: | :--- | :--- | :--- |
| <img src="https://github.com/Mohammed-Arman-Alam.png" width="60" height="60" style="border-radius:50%;" /> | **Mohammed Arman Alam** | [@Mohammed-Arman-Alam](https://github.com/Mohammed-Arman-Alam) | **Team Leader & Frontend Developer**<br>Project vision, core UI layout, responsive components, and presentation lead. |
| <img src="https://github.com/Ridwanulkarim.png" width="60" height="60" style="border-radius:50%;" /> | **Mohammad Ridwanul Karim** | [@Ridwanulkarim](https://github.com/Ridwanulkarim) | **Full Stack Developer & Researcher**<br>End-to-end architecture, NASA Earthdata pipelines, deterministic scoring engine, pure JS agro engine, and automated test fixtures. |
| <img src="https://github.com/Raihans-code.png" width="60" height="60" style="border-radius:50%;" /> | **Raihan Islam** | [@Raihans-code](https://github.com/Raihans-code) | **Backend Developer**<br>REST API endpoints, database modeling, environmental stress algorithms, and server-side workflows. |
| <img src="https://github.com/SMash003.png" width="60" height="60" style="border-radius:50%;" /> | **Md. Shahraj Mashrafe Mashfe** | [@SMash003](https://github.com/SMash003) | **UI/UX Designer**<br>User journey mapping, visual design hierarchy, card typography, and accessibility workflows. |
| <img src="https://github.com/Tofayel5152.png" width="60" height="60" style="border-radius:50%;" /> | **Tofayel Ahmmed** | [@Tofayel5152](https://github.com/Tofayel5152) | **Video Editor**<br>Video narration, demo showcase cinematography, pacing, and visual storytelling. |

---

## 📄 License

Licensed under the **Apache License, Version 2.0** (the "License"). See the [LICENSE](LICENSE) file for complete terms and permissions.
