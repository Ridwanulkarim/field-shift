# NASA Space Apps 2026 Bangladesh — Master Research & Build Dossier
**Project:** Field Shift: Adapting Farms with NASA Data (#07)
**Category:** Agriculture & Climate Adaptation (Advanced · Intermediate)
**Lead Researcher Dossier for PDF Compilation**

---

## 📌 Section 1: Mission Brief

### 1. Context & Scope
- **Official Theme:** *The Next Frontier* (NASA Space Apps 2026).
- **Confirmed Challenge:** Challenge #7 — *Field Shift: Adapting Farms with NASA Data*.
- **Critical Portal Warning:** On the NASA Space Apps submission portal, the challenge year filter must explicitly be set to **"2026 NASA Space Apps Challenges"** (defaulting to previous year leads to instant disqualification with zero score).

### 2. The Three Sentences That Decide Your Score
1. **NASA Data is the Evidence Layer, Not a Decoration:**
   - Evaluated on whether the project is *NASA-data-first* or merely *NASA-data-added*.
   - NASA datasets must be explicitly named on camera during the pitch video and detailed on the project submission page.
2. **Deterministic Code Does the Science; The Model Explains It:**
   - Numerical calculations, agronomic physics, thermal units (GDD), statistical distributions, and hypothesis tests (Mann-Whitney U) belong strictly in deterministic code.
   - The AI/LLM layer acts solely to retrieve, orchestrate, narrate, and contextualize insights in natural Bengali and SMS formats without hallucination.
3. **The Demo Must Run With the WiFi Off:**
   - The venue wifi will inevitably fail under load. All datasets, baseline distributions, and crop tables must be pre-cached locally.
   - A prerecorded offline fallback demo video is mandatory.

### 3. Three Disqualification Rules (Zero Tolerance)
1. **Open Source Mandate:** Everything built during the hackathon must remain open source under the **Apache-2.0** license.
2. **Mandatory Citations:** Every single dataset and source must be cited with active URLs, even publicly available or free datasets.
3. **Child Protection / Privacy:** No recognizable name, voice, or likeness of anyone under the age of 18 may appear in any video or submission material.
---

## 📌 Section 2: Shared Architecture

### 1. The Core Platform Philosophy
- **"One platform, fourteen science modules: Build the spine once and swap the middle."**
- A robust, modular 4-tier stack designed for resilience under zero-wifi hackathon constraints.

```
                  [ FRONTEND (Static, Offline-Capable) ]
          MapLibre GL / Canvas / React UI  +  Service Worker Cache
                                    │
                                    ▼
                         [ APP API (FastAPI / REST) ]
               Local Endpoints ── Disk Cache (Parquet/JSON/COG)
                                    │
                        [ Agent Orchestrator & MCP ]
                   Custom MCP Tools ── Strictly Tool-Bound
                                    │
                                    ▼
                   [ DATA ACQUISITION LAYER (Pre-Event) ]
             NASA POWER · GPM · SMAP · MODIS · earthaccess · CMR
```

### 2. The Strict "Layer Rule"
- **Frontend Isolation:** The frontend NEVER makes direct network calls to NASA or 3rd party APIs.
- **Demo API Guarantee:** During a demo, the API NEVER calls NASA live — it reads from local cache/fixtures.
- **Agent Boundaries:** AI models/agents never compute scientific numbers directly. They sit beside the API and access data exclusively through deterministic tools.
- **Acquisition Decoupling:** Acquisition runs before the event and in the background only when network allows.

### 3. Repository Architecture & The Physical Boundary
- **Pure JavaScript/Node.js Stack Decision:**
  - **No Python Dependency:** Instead of Python (`src/compute/agro.py` & FastAPI), the team utilizes a **100% Pure JavaScript / Node.js Stack**.
  - **Deterministic Engine (`backend/services/agro/agroEngine.js`):** All scientific math (Mann-Whitney U test, rain onset shift, GDD thermal units, soil matrices, adaptive multipliers) is executed deterministically in native JavaScript with 85/85 unit tests.
  - **The 20-Second Winning Pitch for Validity:**
    > *"Our scientific models and statistics live here in pure, tested deterministic JavaScript functions, completely decoupled from any language model hallucinations."*
  - **Benefits:** Zero Python virtual environment/pip friction, instant cross-platform portability on any judge's laptop, and sub-10ms response times.
- **`cache/` vs `demo_fixtures/`:**
  - `cache/`: Large raw downloaded datasets (gitignored).
  - `demo_fixtures/`: The exact, minimal committed bytes required to run the killer demo offline.
- **`docs/AI_USE.md`:** Documenting every AI tool used, prompts, and original human engineering.

### 4. The 3-Tier Offline Safety Net (`safe.py` pattern)
- **Fallback Hierarchy:** `Live API` (1st) $\rightarrow$ `Local Cache` (2nd) $\rightarrow$ `Committed Fixture` (3rd).
- **Zero-Crash Guarantee:** The wrapper function never throws or raises during a live presentation.
- **`OFFLINE=1` Flag:** Forces instant local fixture reads for wifi-off demonstrations.
- **Scientific Honesty Badge:** Displaying a subtle `cache` or `fixture` badge next to values in the UI demonstrates rigor and builds immense trust with judges.

---

## 📌 Section 3: Data Sources

### 1. NASA Earth Observation API Infrastructure
| Source | Base URL | Auth Requirement | Rate Limit | Key Agricultural Role |
| :--- | :--- | :--- | :--- | :--- |
| **NASA POWER** | `power.larc.nasa.gov/api/` | None (Open) | Throttled/grid cell | 25-yr daily rainfall, T2M, solar insolation |
| **GPM IMERG** | `gpm.nasa.gov` / Earthdata | EDL Bearer | High volume | 10km gridded rainfall, dry spell tracking |
| **SMAP L3/L4** | `appeears.earthdatacloud.nasa.gov` | EDL Token | Area sampling | Root-zone soil moisture ($0.18-0.32\text{ m}^3/\text{m}^3$) |
| **VIIRS / MODIS** | `firms.modaps.eosdis.nasa.gov` | Free `MAP_KEY` / Open | 5,000 req / 10m | NDVI vegetation greenness & LST heat stress |
| **GIBS WMTS** | `gibs.earthdata.nasa.gov/wmts/` | None (Open) | CDN cached | Instant satellite basemap tiles |
| **ASF (Sentinel-1)**| `api.daac.asf.alaska.edu` | EDL Account | Bulk download | Synthetic Aperture Radar (sees through monsoon clouds) |

### 2. Critical Remote Sensing Status Alert: The MODIS-to-VIIRS Transition
- **MODIS Decommissioning Timeline:** Terra and Aqua MODIS are winding down in late 2026; Suomi-NPP data stops on 1 November 2026.
- **Judge-Winning Specification:** Modern agricultural solutions must cite **VIIRS on NOAA-20 and NOAA-21** alongside historical MODIS baselines. Acknowledging this transition on camera proves elite remote-sensing literacy.

### 3. The 5/5 Criteria for NASA Data Usage: Multi-Agency Fusion
- **The Scoring Secret:** NASA judges award **5 out of 5** on data usage when NASA Earth observations are fused with local ground-truth observations.
- **Bangladesh Ground-Truth Integration:**
  - **BMD (Bangladesh Meteorological Department):** Station-level rainfall & temperature validation.
  - **BWDB (Bangladesh Water Development Board):** River water level & monsoon flood hydrology.
  - **BARI / BRRI / SRDI:** Soil pH, drainage textures, and certified crop varietal calendars.
- **Radar vs Optical Synergy:** During peak monsoon (July–August), optical satellites (Landsat/MODIS) suffer from extensive cloud cover; fusing **Sentinel-1 SAR (via ASF)** provides all-weather cloud-penetrating radar observation.

---

## 📌 Section 4: Acquisition Code & Caching Protocols

### 1. The Core Acquisition Rule
- **"Paste, run, cache. Every snippet writes to disk so the second run is free."**
- All data acquisition occurs prior to the event; the runtime application solely reads from local storage (`cache/` and `demo_fixtures/`).

### 2. Geographic & Sensor Specifications for Bangladesh
- **Bangladesh Official Bounding Box:**
  $$\text{bbox} = (88.0^\circ\text{E}, 20.0^\circ\text{N}, 93.0^\circ\text{E}, 27.0^\circ\text{N})$$
  *(West: 88, South: 20, East: 93, North: 27)*.

### 3. Key Dataset Query Formulas (Node.js & Pure JS Implementations)
1. **NASA POWER (Agroclimatology Community):**
   - **API Endpoint:** `https://power.larc.nasa.gov/api/temporal/daily/point`
   - **Parameters:** `T2M` (2-meter temperature), `PRECTOTCORR` (corrected precipitation), `ALLSKY_SFC_SW_DWN` (solar radiation).
   - **Community:** `AG` (Agriculture).
   - **Target Coordinates (Killer Demo):** Rajshahi ($24.37^\circ\text{N}, 88.60^\circ\text{E}$) and Dhaka ($23.81^\circ\text{N}, 90.41^\circ\text{E}$) across 25 years ($20010101 \rightarrow 20251231$).
   - **Storage:** Persisted locally as structured JSON fixtures (`demo_fixtures/power_rajshahi_25y.json`).

2. **FIRMS Active Thermal Sensor:**
   - **Sensor:** `VIIRS_NOAA20_NRT` / `VIIRS_NOAA21_NRT` *(avoid Suomi-NPP as it shuts down Nov 1, 2026)*.
   - **URL:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{sensor}/{bbox}/{days}`
   - **Rate Limit:** 5,000 transactions per 10 minutes.

3. **GIBS Basemap (No Key Needed):**
   - **Layer:** `MODIS_Terra_CorrectedReflectance_TrueColor` or VIIRS True Color.
   - **WMTS URL Pattern:** `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
   - **Rule:** Explicit date (`YYYY-MM-DD`) must be supplied; the keyword `current` is invalid.

4. **Sentinel-1 SAR Radar (ASF):**
   - Product: `GRD_HD` (Ground Range Detected).
   - Purpose: Cloud-penetrating backscatter for monsoon waterlogging and flood detection.

### 4. API Keys Checklist for Team Environment
- `EARTHDATA_USER` & `EARTHDATA_PASSWORD` (URS login)
- `FIRMS_MAP_KEY` (modaps.eosdis.nasa.gov)
- `NASA_API_KEY` (api.nasa.gov — registered for 1,000 req/hr)
- Secure rule: Stored in `.env`, strictly committing only `.env.example`.

---

## 📌 Section 5: Batch and Streaming Architectures

### 1. The Core Data Strategy: Batch vs Live
- **Download in Batch (Pre-Event Mandatory):**
  - Any time-series data covering decades (e.g., NASA POWER 2001–2025).
  - Any dataset requiring repetitive statistical calculations ($p$-values, Mann-Whitney U, anomaly z-scores).
  - Anything featured in the 240-second live demo.
- **Query Live (Only when "Right Now" is the core feature):**
  - Instant point queries or last-24h weather checks.
  - **The Cache Filling Rule:** *"Live and cached are not two modes; live is how the cache gets filled."* Every live call writes an MD5 content-hashed file to disk.

### 2. Optimal Storage Formats by Data Shape
| Data Shape | Recommended Format | Pure JS / Node.js Engine Equivalents | Agricultural Purpose |
| :--- | :--- | :--- | :--- |
| **Tabular Time-Series** | Parquet / Compressed JSON | `demo_fixtures/*.json` (in-memory $O(1)$) | 25-yr daily rainfall ($P$), $T_{2M}$, GDD |
| **Gridded Multi-Year** | Zarr / NetCDF4 | Pre-gridded JSON matrices | 10km GPM IMERG regional precipitation |
| **Map Vectors & Polygons**| GeoJSON / PMTiles | MapLibre GeoJSON layers | District boundaries, agro-ecological zones (AEZ) |
| **Relational Data** | SQLite / PostGIS | Pure in-memory SQL (`pg-mem`) | Soil pH, drainage penalty, crop profiles |

### 3. The Golden Rule of Demo Performance
> **"A chart must never wait on a query."**
- Every distribution curve, onset date histogram, and baseline delta must be pre-calculated into committed static fixtures.
- During the demo, chart rendering must be instant ($< 10\text{ ms}$).

### 4. Streaming Strategy (Replayed Fixtures)
- For challenges requiring live streams: WebSocket streaming should replay pre-recorded fixture arrays with `setInterval` / `async-await` sleep intervals (e.g., $0.2\text{s}$ per frame to compress 10 minutes into 2 minutes).
- **Zero-Failure Guarantee:** Replayed fixtures look 100% identical to live feeds on camera, eliminating any chance of live connection drops.

---

## 📌 Section 6: Agentic Design & AI Guardrails

### 1. The Core Agentic Axiom
> **"Agents retrieve, orchestrate, explain and narrate. They do not compute."**
- A strict division of responsibilities prevents hallucinations and guarantees mathematical validity.

```
                        [ ORCHESTRATOR AGENT ]
                                   │
      ┌────────────────┬───────────┴───────────┬────────────────┐
      ▼                ▼                       ▼                ▼
[ Retrieval Agent ] [ Analysis Agent ]  [ Narration Agent ] [ Provenance Guard ]
Fetches POWER, GPM, Calls Deterministic Translates findings Blocks any output
SMAP from cache     Agro Engine Tools   into simple Bangla  lacking dataset ID
```

### 2. The Strict Boundary Table
| The AI Model MAY | The AI Model MAY NOT |
| :--- | :--- |
| Select which dataset or tool answers a query | Compute a trend, $p$-value, GDD, or slope |
| Orchestrate multi-step tool calls | Calculate crop rotation compatibility scores |
| Summarize results into 140-char 2G SMS | Invent any numeric claim not returned by a tool |
| Draft farmer advisories in natural Bengali | Extrapolate arbitrary climate predictions |

### 3. Framework Selection for a 48-Hour Hackathon
- **Recommended:** **Plain State Machine / Tool Calling Loop** (Lowest token burn, zero runtime complexity, instant execution).
- **Avoid:** Over-complicated multi-agent frameworks (e.g., CrewAI burns $2\times-3\times$ more tokens and introduces fragility during live presentations).

### 4. Stopping Hallucinations: The Provenance Guard
- **The Provenance Rule:** Every single number stated in the UI or narration must trace directly to a tool execution result object.
- **The 10-Second Demo Secret for Validity Points:**
  - The frontend must include a **Provenance Drawer / JSON Inspector**.
  - During the video pitch or judge demo, opening the drawer for 10 seconds to reveal the raw deterministic JSON output proves the AI is tethered to verifiable science.

---

## 📌 Section 7: Model Context Protocol (MCP) Servers

### 1. The Role of MCP in NASA Space Apps
- **What is MCP?** An open standard allowing AI agents to securely query external tools, databases, and local files without hallucination.
- **Existing Open Source MCP Servers:**
  - `ProgramComputer/NASA-MCP-server`: Runs natively via Node.js (`npx @programcomputer/nasa-mcp-server`), exposing 20+ NASA APIs.
  - `nasa/earthdata-mcp`: Official NASA CMR catalog metadata server.
  - `eo-mcp`: Multi-cloud earth observation server for Copernicus, Landsat, and Sentinel-1.

### 2. Node.js / TypeScript Native MCP Architecture
- Since our team operates on a **100% Pure JavaScript/Node.js stack**, MCP tools can be implemented natively using `@modelcontextprotocol/sdk` or exposed directly as REST tools over `stdio` or HTTP.
- **Three Essential Agro-Tools for Field Shift:**
  1. `get_planting_window`: Computes monsoon onset shift (+11 days) and GDD accumulation from cached NASA POWER.
  2. `evaluate_crop_rotation`: Calculates biophysical stress score, soil pH/drainage compatibility, and adaptive multipliers.
  3. `check_provenance_citations`: Maps every recommendation to an official NASA/BARI source URL.

### 3. Two Night-Before Failure Pitfalls (Team Warning)
1. **Relative Paths in Config:** Always configure absolute paths (`/Users/apple/...`) in `claude_desktop_config.json` or client configs; relative paths silently fail.
2. **Forgetting Client Restarts:** Any configuration change requires a hard restart of the host agent/client.
3. **Inspector Verification:** Always verify tools prior to the demo using `npx @modelcontextprotocol/inspector`.

### 4. Docstring Quality Rule
- The model solely sees the tool description and parameter schema.
- Must explicitly state: **exact units** (e.g., $mm/\text{day}$, $^\circ\text{C}$, $m^3/m^3$), expected parameter formats (`YYYYMMDD`), and deterministic guarantees.

---

## 📌 Section 8: Skill Files & Repository Governance

### 1. The Anatomy of an Open Agent Skill
- Structure: A directory containing a `SKILL.md` file with standard YAML frontmatter:
  ```yaml
  ---
  name: <skill-name>
  description: <clear-actionable-purpose>
  license: Apache-2.0
  ---
  ```
- **Cross-Platform Interoperability:** Works natively across Claude, Antigravity, Gemini CLI, Cursor, and Copilot.

### 2. Four Core Skills for the Hackathon
1. **`space-apps-project`:** Master governance skill enforcing offline caching, open-source Apache-2.0 licensing, AI disclosure (`docs/AI_USE.md`), and under-18 privacy protection.
2. **`nasa-data-access`:** Governs endpoint validation, zero-crash local fallbacks, and parameter structures.
3. **`evidence-provenance`:** 
   - **The Scientific Phrasing Rule:**
     > *"Report what was measured, not what it means: 'rainfall declined 12% over 2001 to 2025, Mann-Kendall p = 0.01' rather than subjective claims like 'the climate is drying'."*
   - Never smooth over missing satellite observation gaps; state data limitations transparently.
4. **`judging-ready-submission`:** Structures the 7 mandatory submission fields to align with the Bangladesh and Global judging rubrics.

### 3. Root Governance Files: `CLAUDE.md` and `AGENTS.md`
- **Five Non-Negotiables:**
  1. Offline-first execution (`OFFLINE=1`).
  2. Deterministic science isolated in pure code (`backend/services/agro/agroEngine.js`).
  3. Every single quantitative claim cited with `dataset_id` and URL.
  4. Full transparency on AI tool usage in `docs/AI_USE.md`.
  5. Apache-2.0 open-source licensing with zero under-18 likeness.
- **Frontend Independence:** The frontend build system must run with zero internet connectivity on a portable laptop.

---

## 📌 Section 9: Judging Rubric & Submission Protocols

### 1. The Official Score Sheet (Total Points Breakdown)
| Evaluation Criterion | Point Scale | How to Earn the Top Band in Field Shift |
| :--- | :---: | :--- |
| **Impact** | 1–20 | Severe real-world problem (Barind groundwater depletion, delayed monsoon). Concrete measurable output: 140-char SMS directive for smallholders. |
| **Creativity** | 1–20 | Innovative connection: Satellite stress dynamically scaling farmer priorities via adaptive multipliers ($1.0\times \rightarrow 2.0\times$). |
| **Validity** | 1–20 | Physical compute engine boundary (`agroEngine.js`), 85 passing tests, Mann-Whitney U ($p < 0.05$), and UI Provenance Drawer. |
| **Relevance** | 1–20 | NASA-data-first architecture. Explicitly naming POWER, SMAP, GPM, MODIS/VIIRS on camera and in project text. |
| **Presentation** | 1–20 | 240-second pitch with clear narrative arc, problem definition, working killer demo, and crisp English delivery. |
| **Teamwork** | 1–5 | Genuine multi-disciplinary collaboration visible in GitHub commit history and defined roles (Leader, Researcher, UI/UX, Backend). |
| **User Experience (UX)** | 1–5 | Zero training required: 100% natural Bengali interface, mobile-first responsiveness, and single-sentence directive. |
| **NASA Data Usage** | 1–5 | **The 5/5 Rule:** NASA Earth observations fused with local ground truth (BARI, BRRI, BMD, BWDB). |
| **Challenge Named** | 0 or 1 | Explicitly stating Challenge #7 on the project page. |
| **Repository Open** | 0 or 1 | Public GitHub repo, verified in an incognito browser window. |
| **Project Page Complete**| 0 or 1 | Every required field filled prior to deadline. |
| **Diversity Bonus** | +5% | Applied to aggregate score for teams with $\ge 1$ women member. |

### 2. The 3 "Cheapest Single Points" Teams Lose (Must Secure First)
1. Challenge name and 2026 category explicitly stated.
2. Public repository link (tested without login in private/incognito window).
3. Project page fully submitted before the countdown ends.

### 3. The Three Video Deliverables
1. **Prescreening Video (240s):** Problem, challenge statement, team roster, and conceptual solution.
2. **Local Judging Video (240s):** Complete pitch featuring the working offline demo, dataset names spoken aloud on camera.
3. **Global Judging Video (30s):** High-tempo summary: team, problem, working solution, NASA data citation, and impact with English subtitles.

### 4. Mandatory AI Use Disclosure (`docs/AI_USE.md`)
- Strict compliance requirement: Disclosing all AI tools used, prompts, and clearly demarcating:
  - **What AI Did:** Initial scaffolding, documentation drafting, UI boilerplate.
  - **What the Human Team Did:** All agronomic science, statistical algorithms, testing suites, dataset selection, and architecture design.

---

## 📌 Section 10: Run-up Plan & Time-Critical Milestones

### 1. Countdown Timeline (From Setup to Submission)
| Milestone Date | Action Required | Responsible Role |
| :--- | :--- | :--- |
| **This Week** | Register Earthdata Login, collect FIRMS MAP_KEY, free api.nasa.gov key, and ADS token. Test each key. | All Team Members |
| **By 1 Oct** | Shortlist challenges, record and upload 240-second prescreening concept pitch video. | Team Leader |
| **28 Oct** | Full challenge statements land. Compare NASA named datasets, lock scope. Cache missing datasets. | Lead Researcher |
| **2–12 Nov** | Pre-build local `cache/` and `demo_fixtures/`. Wire MCP server/tools. Full dry run offline by **12 November**! | Backend & Data Lead |
| **13 Nov** | Submission and Judging guides publish. Claim free sponsor cloud credits; align AI disclosure text. | Team Leader |
| **Day One (Hackathon)** | 07:00 Registration $\rightarrow$ 10:30 Opening $\rightarrow$ 11:30 Mentors. **Local judging upload due at 18:30**. | Full Team |
| **Day Two, 12:00 PM** | **FEATURE FREEZE!** Last 4 hours strictly for video polishing, project page writing, and public repo. | Full Team |

### 2. The Emergency Protocol: What to Cut When Running Behind
If the team falls behind on time, execute cuts in this **strict, predetermined order**:
1. **Drop Geographic Scope First:** Focus on one district (Rajshahi), told properly and deeply, rather than 64 districts superficially.
2. **Drop Time Range:** Focus on 10 years instead of 25 years.
3. **Drop Interactivity:** Use fixed scenario cards instead of multi-parameter sliders.
4. **Drop Live Query:** Strictly read from static fixtures.
> **The Golden Survival Axiom:**
> *"Keep the killer demo moment intact to the very end — it is the only thing a judge will remember, and a project that does one thing convincingly outscores one that half-does five."*

---

## 🌾 Master Challenge Profile: #07 Field Shift — Adapting Farms with NASA Data
*(Official 2026 Challenge: Agriculture & Climate Adaptation | Level: Advanced · Intermediate)*

### 1. Brief & Strategic Directive
- **What the Challenge Asks:** Help farmers adapt their agricultural practices using satellite observations and predictive climate data.
- **The Build:** A planting-window advisory for Bangladeshi rice. Pick a district and a crop, and the tool shows how the onset of usable rainfall and the accumulation of growing degree days (GDD) have shifted over 25 years (2001–2025), then states the recommended window shift in whole days with the empirical evidence behind it.
- **The Killer Demo:**
  > *"A farmer in Rajshahi selects Aman rice. The tool says the usable-rain onset has moved eleven days later since 2001, shows the two distributions that prove it, and gives the revised transplanting window — in Bangla, on a phone."*
- **Where the Points Are (The Golden Maxim):**
  > *"Impact, if the output is a decision a real farmer could act on. The failure mode is a dashboard that shows data and leaves the farmer to work it out. **End on a sentence, not a chart.**"*

### 2. 48-Hour Execution Plan & Cut Priorities
- **Before the Event:** Cache POWER daily series for your districts, NDVI/EVI for the same areas, and SMAP root-zone soil moisture. Agree the agronomic definitions (what counts as onset, which degree-day base: $T_{\text{base}} = 10^\circ\text{C}$ for rice) with agricultural domain science.
- **Day 1 Morning:** Onset detection and degree-day accumulation in compute engine, with unit tests.
- **Day 1 Afternoon:** District map, crop selector, and the two-period distribution comparison (2001–2012 vs 2013–2025).
- **Day 1 Evening:** The advisory sentence and its assumptions. Record footage by 18:30.
- **Day 2 Morning:** Bangla interface, phone layout, SMS-length summary (under 160 characters). Test with someone outside the team.
- **Day 2 Noon:** **Freeze features, record final pitch, submit.**
- **Pre-Build Checklist:**
  - POWER, NDVI, and SMAP for target districts.
  - Crop calendar and degree-day thermal bases agreed.
  - Bangla strings drafted.
- **Cut in This Order (Emergency Protocol):**
  1. One crop instead of three.
  2. One district (Rajshahi), told properly and thoroughly.
  3. Drop SMAP, keep rainfall and temperature.
  4. Drop the map, keep the advisory sentence.

### 3. Data Specification & The Monsoon Onset Equation
- **NASA POWER:** Daily rainfall, temperature ($T_{2M}$), and solar radiation per district. The backbone of the entire advisory.
- **GPM IMERG:** Gridded precipitation when spatial detail is required rather than a single point.
- **SMAP L3/L4:** Root-zone soil moisture ($0.18-0.32\text{ m}^3/\text{m}^3$), which physically determines whether a field is workable.
- **MODIS / VIIRS NDVI:** Observed greenness to validate predicted windows against actual historical farmer planting dates.

#### The Authoritative Onset Definition:
```python
def rain_onset(daily_mm, window=7, threshold_mm=20, dry_spell_max=7):
    """
    First day of a 7-day window with 20mm or more that is not followed by a
    dry spell longer than 7 days. State this definition in the interface.
    """
    import numpy as np
    r = np.asarray(daily_mm, float)
    for i in range(len(r) - window - dry_spell_max):
        if r[i:i + window].sum() >= threshold_mm:
            after = r[i + window:i + window + dry_spell_max]
            if (after > 1.0).any():
                return i
    return None
```
- **The Validity Multiplier (Say the Definition Out Loud):**
  > *"Onset has a dozen definitions in the literature. Naming yours, and showing the result is stable if you shift the threshold by $\pm 5\text{mm}$, is the difference between a 10 and a 20 on validity."*

### 4. Technical Architecture: Pure JavaScript / Node.js Adaptation
Instead of Python/FastAPI, our project executes this exact pipeline deterministically in native JavaScript:
```
POWER · GPM · SMAP · MODIS/VIIRS
               │ (pre-event cached)
               ▼
   demo_fixtures/ (JSON per district)
               │
               ▼
backend/services/agro/agroEngine.js
onset · degree days · Mann-Whitney U test · sensitivity check
               │
               ▼
Express REST API (/api/rotations, /api/fields)
               │
      ┌────────┴────────┐
      ▼                 ▼
map + charts       advisory sentence
(MapLibre / Vite)  Bangla + English + 140-char SMS
               │
               ▼
assumptions + dataset citations + Provenance Drawer
```

### 5. Build Prompt Deliverables & Compliance Verification
- **Statistical Engine:** Mann-Whitney U test comparing 2001–2012 against 2013–2025; sensitivity analysis at $\text{threshold} \pm 5\text{mm}$.
- **API Spec:** `GET /advisory?district=&crop=` returning shift in whole days, two distributions, test statistic, assumptions, and provenance block.
- **Frontend Spec:** Mobile-first, dual-language (Bangla & English), district selector, 2-period distribution chart, single clear advisory sentence at the top, and under-160-character 2G SMS text.
- **Open Standards:** Apache-2.0 license, public repository, README listing every dataset with active URLs.

---
