# Field Shift Backend Service

> **RESTful API and Scientific Stress Engine for NASA Earth Observation-Driven Agricultural Adaptation.**  
> Maintained by **Raihan Islam** ([@Raihans-code](https://github.com/Raihans-code)) - Backend Developer, Team RAMT.

---

## 🏛️ Architecture Overview

The Field Shift backend is built on **Node.js** and **Express.js**, designed to deliver real-time agronomic evaluations by fusing NASA satellite observations with agro-ecological field data.

```
backend/
├── app.js                    # Express application entrypoint & middleware configuration
├── server.js                 # HTTP listener & port binding (Default: 5001)
├── config/                   # NASA Earthdata API credentials & endpoints
├── db/                       # Normalized PostgreSQL database & in-memory pg-mem mock
│   ├── schema.sql            # 23 DDL tables strictly conforming to Spec Section 43
│   ├── seed_crops.js         # 12 Bangladesh varieties (BARI, BRRI, BWMRI, BJRI)
│   └── seed_demo_fields.js   # 5 Agro-Ecological Zone pilot fields
├── models/                   # Data access layers (Fields, Crops, Observations, Rotations)
├── routes/                   # Express REST route controllers
│   ├── fields.js             # /api/fields endpoints
│   ├── crops.js              # /api/crops endpoints
│   └── rotations.js          # /api/rotations endpoints
├── services/
│   ├── nasa/                 # NASA CMR, AppEEARS subsetting & data preprocessing
│   ├── stress/               # Z-score standardization, water, heat & vegetative stress engines
│   ├── soil/                 # 3×3 drainage penalty matrix & linear pH penalty scaling
│   └── rotations/            # Seasonal feasibility, dynamic multipliers & ranking engine
└── test/                     # 84 automated unit/integration tests & 18 Section 57 fixtures
```

---

## 🛰️ NASA Stress Engines & Multipliers

1. **Water Stress Index ($WSI$):** Computed from SMAP surface soil moisture anomalies benchmarked against 4-year baseline distributions ($Z$-score standardized).
2. **Heat Stress Index ($HSI$):** Extracted from MODIS daytime Land Surface Temperature anomalies during crop flowering anthesis windows.
3. **Vegetative Health ($VSI$):** Derived from HLS 30m NDVI/EVI rolling means.
4. **Dynamic Score Multipliers:**
   $$\text{Weight}_{water} = \text{Priority}_{water} \times (1 + \text{Stress}_{water})$$
   $$\text{Weight}_{heat} = \text{Priority}_{heat} \times (1 + \text{Stress}_{heat})$$

---

## 🚀 Running the Backend

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
npm install
```

### Starting the Server
```bash
npm start
# Server runs on http://localhost:5001
```

### Running Test Suites
```bash
npm test
# Runs all 84 test cases across 10 verification suites (100% passing)
```

---

## 👥 Contributors & Backend Credits
- **Raihan Islam** ([@Raihans-code](https://github.com/Raihans-code)) - Backend Developer
- **Mohammad Ridwanul Karim** ([@Ridwanulkarim](https://github.com/Ridwanulkarim)) - Full Stack Developer & Researcher
- **Mohammed Arman Alam** ([@Mohammed-Arman-Alam](https://github.com/Mohammed-Arman-Alam)) - Team Leader & Frontend Developer
- **Md. Shahraj Mashrafe Mashfe** ([@SMash003](https://github.com/SMash003)) - UI/UX Designer
