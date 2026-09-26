# Field Shift: Adapting Farms with NASA Earth Observations

> **A NASA Earth Observation-driven decision-support system evaluating climate-resilient crop rotations across Bangladesh's vulnerable agro-ecological zones.**

---

## 🌍 Overview

**Field Shift** bridges satellite remote sensing and local agronomy to guide climate adaptation in Bangladesh agriculture. By combining **four NASA Earth Observation products** with localized soil and seasonal calendars, Field Shift evaluates candidate crop rotations against real-world environmental stress—identifying resilient crop sequences that conserve groundwater, avoid peak thermal anomalies, and restore soil health.

### The Challenge
- **High Barind Terrace (Rajshahi):** Severe dry-season drought and declining groundwater tables exacerbated by intensive, flooded Boro rice cultivation.
- **Coastal Saline Transition (Satkhira):** Dry-season capillary rise of saline groundwater limiting dry-season crop viability.
- **Floodplain Basins (Mymensingh, Jessore, Dinajpur):** Late-spring heat spikes during flowering anthesis and drainage/waterlogging challenges.

---

## 🛰️ NASA Earth Observation Datasets

Field Shift ingests and processes daily observations across a rolling 61-day analysis window (Anchor: `2024-02-28`) benchmarked against a 4-year historical baseline (2019–2022):

| Sensor / Mission | Product ID | Spatial Resolution | Variables Extracted | Agronomic Role |
| :--- | :--- | :--- | :--- | :--- |
| **HLS (Landsat 8/9 & Sentinel-2)** | `HLSL30_VI` / `HLSS30_VI` (v2.0) | **30 meters** | NDVI, EVI | Crop canopy vigor & vegetative health |
| **SMAP** | `SPL3SMP_E.006` | **9 km** (enhanced grid) | Soil moisture ($m^3/m^3$) & anomaly | Root-zone moisture stress & drought |
| **GPM IMERG** | `GPM_3IMERGDF.07` | **0.1° (~10 km)** | Daily precipitation (mm), 30d rolling sum, dry days | Water availability & dry-spell frequency |
| **MODIS (Terra & Aqua)** | `MOD11A1.061` / `MYD11A1.061` | **1 km** | Daytime & nighttime LST (°C), hot-day count | Thermal anomalies & heat stress during flowering |

---

## 🏗️ Architecture

```
field-shift/
├── backend/                  # Node.js Express REST API
│   ├── config/               # Environment & NASA API endpoints
│   ├── db/                   # Schema, migrations & pg-mem in-memory / PostgreSQL DB
│   │   ├── schema.sql        # 23 DDL statements strictly normalized (Spec Section 43)
│   │   ├── seed_crops.js     # 12 Bangladesh crop varieties (BRRI, BARI, BWMRI, BJRI)
│   │   └── seed_demo_fields.js # 5 Bangladesh pilot fields (Spec Section 51)
│   ├── models/               # Data access models (Fields, Crops, Observations, Rotations)
│   ├── routes/               # REST API endpoints (/api/fields, /api/crops, /api/rotations)
│   ├── services/
│   │   ├── nasa/             # Earthdata auth, CMR queries, AppEEARS subsetting
│   │   ├── stress/           # Z-score standardization, water/heat/vegetation stress engines
│   │   ├── soil/             # 3×3 drainage penalty matrix, linear pH penalty scaling
│   │   └── rotations/        # Seasonal feasibility, dynamic multipliers & Section 49 explanations
│   └── test/                 # 84 Unit & Integration Tests + 18 Section 57 Test Fixtures
└── frontend/                 # React 19 + Vite 8 + Tailwind CSS 4 SPA
    ├── src/
    │   ├── components/       # Leaflet Map, RotationCard, PrioritySlider, WarningCard
    │   ├── pages/            # FieldDashboard, RotationPlanner, RotationComparison, Recommendation
    │   ├── services/         # API client interfacing directly with backend
    │   └── utils/            # Bilingual EN/বাংলা dictionaries & number formatting
```

---

## 🧪 Scientific Scoring Engine & Dynamic Multipliers

Instead of static recommendations, Field Shift modulates scoring weights using **live NASA stress indexes**:

$$\text{effective\_water\_weight} = \text{water\_priority} \times (1 + \text{adjusted\_water\_stress})$$

$$\text{effective\_heat\_weight} = \text{heat\_priority} \times (1 + \text{heat\_stress\_index})$$

### The Section 40 Ranking Inversion
- **High Water Stress (Unirrigated Barind):** Option A (*Chickpea → Mung Bean*) scores **63.2**, defeating Option B (*Wheat → Mung Bean*, **58.0**).
- **Irrigated Condition:** Irrigation factor ($0.7\times$) reduces adjusted water stress, allowing heat resilience to dominate and Option B to rank #1.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)

### 1. Start the Backend API Server
```bash
cd backend
npm install
npm start
# Server listens on http://localhost:5001
```

### 2. Start the Frontend Development Server
```bash
cd ../frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:3001
```

Open your browser and navigate to **`http://localhost:3001`**.

---

## 🔬 Testing & Verification

Field Shift includes an end-to-end automated verification suite covering all 18 test fixtures mandated by Spec Section 57:

```bash
cd backend
npm test
```
* **84 / 84 Tests Passing (10 suites)**: Database CRUD, NASA Preprocessing, Baselines, Stress Engines, Soil Compatibility, Rotation Feasibility, Scoring Engine, and Section 57 Fixtures.

---

## 🛡️ Transparency & Disclosures (Spec Section 56)

- **Highest-scoring Rotation:** Field Shift strictly uses the term *"Highest-scoring rotation"* and explicitly avoids the misleading phrase *"Best rotation"*.
- **No Forecast Claim:** NASA observations describe recent environmental stress (61-day proxy) and do not constitute seasonal weather forecasts.
- **Resolution Transparency:** HLS (30m), MODIS (1km), SMAP (9km), and GPM (~10km) resolutions are clearly disclosed on all map layers and audit drawers.
- **Qualitative Extension:** Soil and advisory texts are grounded in empirical BRRI/BARI agronomic manuals with zero invented quantitative yield predictions.

---

## 📄 License
This project is open-source under the MIT License. Developed for climate adaptation research with NASA Earth Observation datasets.
