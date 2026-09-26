-- ==============================================================================
-- Field Shift Database Schema v6.2
-- Authoritative PostgreSQL DDL matching Section 43 of Final MVP Specification
-- ==============================================================================

-- Drop tables if needed (in reverse dependency order)
DROP TABLE IF EXISTS rotations CASCADE;
DROP TABLE IF EXISTS field_condition_scores CASCADE;
DROP TABLE IF EXISTS earth_observations CASCADE;
DROP TABLE IF EXISTS baselines CASCADE;
DROP TABLE IF EXISTS field_crop_history CASCADE;
DROP TABLE IF EXISTS fields CASCADE;
DROP TABLE IF EXISTS crops CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS drainage_penalties CASCADE;

-- ------------------------------------------------------------------------------
-- 1. SEASONS (Configurable Bangladesh Seasonal Windows - Section 28)
-- ------------------------------------------------------------------------------
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE CHECK (name IN ('Kharif-1', 'Kharif-2', 'Rabi')),
    start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 31),
    end_month INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
    end_day INTEGER NOT NULL CHECK (end_day BETWEEN 1 AND 31),
    approx_days INTEGER NOT NULL CHECK (approx_days > 0),
    region VARCHAR(100) DEFAULT 'Bangladesh',
    source_reference TEXT,
    configurable BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. DRAINAGE PENALTIES (Section 33 Table - 9 Combination Rows)
-- ------------------------------------------------------------------------------
CREATE TABLE drainage_penalties (
    id SERIAL PRIMARY KEY,
    waterlogging_tolerance VARCHAR(20) NOT NULL CHECK (waterlogging_tolerance IN ('Low', 'Medium', 'High')),
    drainage_class VARCHAR(20) NOT NULL CHECK (drainage_class IN ('good', 'moderate', 'poor')),
    penalty_points INTEGER NOT NULL CHECK (penalty_points >= 0),
    version VARCHAR(20) NOT NULL DEFAULT 'v6.2',
    CONSTRAINT unique_tolerance_drainage_version UNIQUE(waterlogging_tolerance, drainage_class, version)
);

-- ------------------------------------------------------------------------------
-- 3. FIELDS (Section 43)
-- ------------------------------------------------------------------------------
CREATE TABLE fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    boundary_geojson JSONB,
    area_hectares NUMERIC(8, 2),
    soil_type VARCHAR(100),
    soil_ph NUMERIC(4, 2),
    organic_matter_percent NUMERIC(5, 2),
    drainage VARCHAR(50) CHECK (drainage IS NULL OR drainage IN ('good', 'moderate', 'poor')),
    irrigation_available BOOLEAN NOT NULL DEFAULT false,
    current_crop VARCHAR(100),
    current_crop_family VARCHAR(100),
    previous_crop VARCHAR(100),
    previous_crop_family VARCHAR(100),
    current_season VARCHAR(50),
    is_demo BOOLEAN NOT NULL DEFAULT false,
    data_label VARCHAR(100), -- 'Pre-processed NASA observations' or 'Simulated demonstration data'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. FIELD CROP HISTORY (Section 43 & Section 11)
-- Match by year + season. Rabi spans 2 calendar years, stored under start year.
-- ------------------------------------------------------------------------------
CREATE TABLE field_crop_history (
    id SERIAL PRIMARY KEY,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    year INTEGER NOT NULL, -- Rabi start-year: Nov 2024 to Feb 2025 is 2024
    season VARCHAR(50) NOT NULL CHECK (season IN ('Kharif-1', 'Kharif-2', 'Rabi')),
    crop VARCHAR(100) NOT NULL,
    crop_family VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL, -- 'farmer-supplied' or 'hand-entered demo data'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crop_history_field_lookup ON field_crop_history(field_id, year, season);

-- ------------------------------------------------------------------------------
-- 5. CROPS (Section 43, 26, 27, 33)
-- waterlogging_tolerance is nullable to allow unknown tolerance per Section 33.
-- Each trait carries its own source status flag.
-- ------------------------------------------------------------------------------
CREATE TABLE crops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    crop_family VARCHAR(100) NOT NULL,
    water_demand NUMERIC(5, 2) CHECK (water_demand IS NULL OR (water_demand >= 0 AND water_demand <= 100)),
    heat_tolerance NUMERIC(5, 2) CHECK (heat_tolerance IS NULL OR (heat_tolerance >= 0 AND heat_tolerance <= 100)),
    soil_health_benefit NUMERIC(5, 2) CHECK (soil_health_benefit IS NULL OR (soil_health_benefit >= 0 AND soil_health_benefit <= 100)),
    diversity_value NUMERIC(5, 2) CHECK (diversity_value IS NULL OR (diversity_value >= 0 AND diversity_value <= 100)),
    profitability_value NUMERIC(5, 2) CHECK (profitability_value IS NULL OR (profitability_value >= 0 AND profitability_value <= 100)),
    water_demand_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (water_demand_status IN ('verified', 'prototype-mapped', 'unverified')),
    heat_tolerance_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (heat_tolerance_status IN ('verified', 'prototype-mapped', 'unverified')),
    soil_health_benefit_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (soil_health_benefit_status IN ('verified', 'prototype-mapped', 'unverified')),
    diversity_value_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (diversity_value_status IN ('verified', 'prototype-mapped', 'unverified')),
    profitability_value_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (profitability_value_status IN ('verified', 'prototype-mapped', 'unverified')),
    growing_days INTEGER NOT NULL CHECK (growing_days > 0),
    suitable_seasons JSONB NOT NULL,
    waterlogging_tolerance VARCHAR(20) CHECK (waterlogging_tolerance IS NULL OR waterlogging_tolerance IN ('Low', 'Medium', 'High')),
    min_soil_ph NUMERIC(4, 2),
    max_soil_ph NUMERIC(4, 2),
    source_name VARCHAR(255),
    source_url TEXT,
    source_reference TEXT,
    source_notes TEXT,
    trait_mapping_method VARCHAR(100),
    trait_mapping_version VARCHAR(20),
    source_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (source_status IN ('verified', 'prototype-mapped', 'unverified')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. EARTH OBSERVATIONS (Section 43)
-- Daily NASA observations and rolling variables. Unique per field + observation_date.
-- ------------------------------------------------------------------------------
CREATE TABLE earth_observations (
    id SERIAL PRIMARY KEY,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL,
    ndvi NUMERIC(6, 4),
    evi NUMERIC(6, 4),
    ndmi NUMERIC(6, 4),
    ndmi_anomaly NUMERIC(6, 4),
    soil_moisture NUMERIC(6, 4),
    soil_moisture_anomaly NUMERIC(6, 4),
    rainfall_mm NUMERIC(8, 2) CHECK (rainfall_mm IS NULL OR rainfall_mm >= 0),
    rolling_30d_rainfall NUMERIC(8, 2) CHECK (rolling_30d_rainfall IS NULL OR rolling_30d_rainfall >= 0),
    rainfall_anomaly NUMERIC(8, 2),
    dry_day_count INTEGER CHECK (dry_day_count IS NULL OR dry_day_count >= 0),
    daytime_lst_c NUMERIC(6, 2),
    nighttime_lst_c NUMERIC(6, 2),
    daytime_lst_anomaly NUMERIC(6, 2),
    nighttime_lst_anomaly NUMERIC(6, 2),
    hot_day_count INTEGER CHECK (hot_day_count IS NULL OR hot_day_count >= 0),
    vegetation_stress NUMERIC(5, 4) CHECK (vegetation_stress IS NULL OR (vegetation_stress >= 0 AND vegetation_stress <= 1)),
    water_stress_index NUMERIC(5, 4) CHECK (water_stress_index IS NULL OR (water_stress_index >= 0 AND water_stress_index <= 1)),
    adjusted_water_stress NUMERIC(5, 4) CHECK (adjusted_water_stress IS NULL OR (adjusted_water_stress >= 0 AND adjusted_water_stress <= 1)),
    heat_stress_index NUMERIC(5, 4) CHECK (heat_stress_index IS NULL OR (heat_stress_index >= 0 AND heat_stress_index <= 1)),
    quality_status VARCHAR(50),
    hls_product VARCHAR(50),
    hls_version VARCHAR(20),
    smap_product VARCHAR(50),
    smap_version VARCHAR(20),
    gpm_product VARCHAR(50),
    gpm_version VARCHAR(20),
    gpm_latency_class VARCHAR(20) CHECK (gpm_latency_class IS NULL OR gpm_latency_class IN ('Final', 'Late', 'Early')),
    modis_product VARCHAR(50),
    modis_version VARCHAR(20),
    processing_date TIMESTAMPTZ,
    data_sources JSONB,
    analysis_window_start DATE,
    analysis_window_end DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_field_obs_date UNIQUE(field_id, observation_date)
);

CREATE INDEX idx_obs_field_date ON earth_observations(field_id, observation_date);

-- ------------------------------------------------------------------------------
-- 7. BASELINES (Section 43 & Section 14)
-- crop_matched applies ONLY to vegetation (EVI, NDVI, NDMI). For SMAP, GPM, MODIS it is NULL.
-- ------------------------------------------------------------------------------
CREATE TABLE baselines (
    id SERIAL PRIMARY KEY,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    variable VARCHAR(50) NOT NULL,
    season VARCHAR(50) NOT NULL CHECK (season IN ('Kharif-1', 'Kharif-2', 'Rabi')),
    mean NUMERIC(10, 4) NOT NULL,
    std NUMERIC(10, 4) NOT NULL,
    n INTEGER NOT NULL CHECK (n >= 0),
    n_years INTEGER NOT NULL CHECK (n_years >= 0),
    years_included JSONB NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    method VARCHAR(100) NOT NULL,
    sample_quality VARCHAR(20) NOT NULL CHECK (sample_quality IN ('usable', 'limited')),
    crop_matched BOOLEAN, -- true, false, or NULL (strictly NULL for non-vegetation)
    gpm_latency_class VARCHAR(20) CHECK (gpm_latency_class IS NULL OR gpm_latency_class IN ('Final', 'Late', 'Early')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_baselines_field_var ON baselines(field_id, variable, season);

-- ------------------------------------------------------------------------------
-- 8. FIELD CONDITION SCORES (Section 43 & Section 23)
-- Uses raw environmental stress, never irrigation-adjusted stress.
-- ------------------------------------------------------------------------------
CREATE TABLE field_condition_scores (
    id SERIAL PRIMARY KEY,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,
    vegetation_condition_score NUMERIC(6, 2),
    water_condition_score NUMERIC(6, 2),
    heat_condition_score NUMERIC(6, 2),
    field_condition_score NUMERIC(6, 2),
    available_components JSONB NOT NULL,
    missing_components JSONB NOT NULL,
    nasa_sources_available INTEGER NOT NULL CHECK (nasa_sources_available BETWEEN 0 AND 4),
    data_quality_status VARCHAR(50) NOT NULL CHECK (data_quality_status IN ('normal', 'warning', 'insufficient_observations')),
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v6.2',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_field_condition_lookup ON field_condition_scores(field_id, window_end);

-- ------------------------------------------------------------------------------
-- 9. ROTATIONS (Section 43, 31-40)
-- Full reproducibility parameters, effective weights, cycle mode, and explanation.
-- ------------------------------------------------------------------------------
CREATE TABLE rotations (
    id SERIAL PRIMARY KEY,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    season_sequence JSONB NOT NULL,
    crops JSONB NOT NULL,
    rotation_cycle_mode VARCHAR(50) NOT NULL CHECK (rotation_cycle_mode IN ('continue_after_current', 'start_new_cycle')),
    repeat_context_crop VARCHAR(100),
    repeat_context_type VARCHAR(50) CHECK (repeat_context_type IS NULL OR repeat_context_type IN ('current', 'previous')),
    water_score NUMERIC(6, 2),
    soil_score NUMERIC(6, 2),
    heat_score NUMERIC(6, 2),
    diversity_score NUMERIC(6, 2),
    profitability_score NUMERIC(6, 2),
    base_soil_health_score NUMERIC(6, 2),
    drainage_penalty NUMERIC(6, 2),
    ph_penalty NUMERIC(6, 2),
    organic_matter_adjustment NUMERIC(6, 2) DEFAULT 0,
    soil_score_final NUMERIC(6, 2),
    water_stress_index NUMERIC(5, 4),
    adjusted_water_stress NUMERIC(5, 4),
    heat_stress_index NUMERIC(5, 4),
    water_multiplier NUMERIC(5, 4),
    heat_multiplier NUMERIC(5, 4),
    effective_water_weight NUMERIC(6, 3),
    effective_heat_weight NUMERIC(6, 3),
    overall_score NUMERIC(6, 2),
    feasibility_status VARCHAR(50) NOT NULL CHECK (feasibility_status IN ('Seasonally feasible', 'Not seasonally feasible')),
    sample_quality VARCHAR(20) CHECK (sample_quality IS NULL OR sample_quality IN ('usable', 'limited')),
    crop_matched BOOLEAN,
    data_quality_status VARCHAR(50),
    observation_ids_used JSONB,
    baseline_ids_used JSONB,
    explanation JSONB NOT NULL,
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v6.2',
    scored_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rotations_field_score ON rotations(field_id, overall_score DESC);
