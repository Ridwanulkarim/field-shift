-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_month" INTEGER NOT NULL,
    "start_day" INTEGER NOT NULL,
    "end_month" INTEGER NOT NULL,
    "end_day" INTEGER NOT NULL,
    "approx_days" INTEGER NOT NULL,
    "region" TEXT DEFAULT 'Bangladesh',
    "source_reference" TEXT,
    "configurable" BOOLEAN DEFAULT true,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drainage_penalties" (
    "id" SERIAL NOT NULL,
    "waterlogging_tolerance" TEXT NOT NULL,
    "drainage_class" TEXT NOT NULL,
    "penalty_points" INTEGER NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v6.2',

    CONSTRAINT "drainage_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "boundary_geojson" JSONB,
    "area_hectares" DECIMAL(65,30),
    "soil_type" TEXT,
    "soil_ph" DECIMAL(65,30),
    "organic_matter_percent" DECIMAL(65,30),
    "drainage" TEXT,
    "irrigation_available" BOOLEAN NOT NULL DEFAULT false,
    "current_crop" TEXT,
    "current_crop_family" TEXT,
    "previous_crop" TEXT,
    "previous_crop_family" TEXT,
    "current_season" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "data_label" TEXT,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_crop_history" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "crop_family" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "field_crop_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crops" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "crop_family" TEXT NOT NULL,
    "water_demand" DECIMAL(65,30),
    "heat_tolerance" DECIMAL(65,30),
    "soil_health_benefit" DECIMAL(65,30),
    "diversity_value" DECIMAL(65,30),
    "profitability_value" DECIMAL(65,30),
    "water_demand_status" TEXT NOT NULL DEFAULT 'unverified',
    "heat_tolerance_status" TEXT NOT NULL DEFAULT 'unverified',
    "soil_health_benefit_status" TEXT NOT NULL DEFAULT 'unverified',
    "diversity_value_status" TEXT NOT NULL DEFAULT 'unverified',
    "profitability_value_status" TEXT NOT NULL DEFAULT 'unverified',
    "growing_days" INTEGER NOT NULL,
    "suitable_seasons" JSONB NOT NULL,
    "waterlogging_tolerance" TEXT,
    "min_soil_ph" DECIMAL(65,30),
    "max_soil_ph" DECIMAL(65,30),
    "source_name" TEXT,
    "source_url" TEXT,
    "source_reference" TEXT,
    "source_notes" TEXT,
    "trait_mapping_method" TEXT,
    "trait_mapping_version" TEXT,
    "source_status" TEXT NOT NULL DEFAULT 'unverified',

    CONSTRAINT "crops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earth_observations" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "observation_date" DATE NOT NULL,
    "ndvi" DECIMAL(65,30),
    "evi" DECIMAL(65,30),
    "ndmi" DECIMAL(65,30),
    "ndmi_anomaly" DECIMAL(65,30),
    "soil_moisture" DECIMAL(65,30),
    "soil_moisture_anomaly" DECIMAL(65,30),
    "rainfall_mm" DECIMAL(65,30),
    "rolling_30d_rainfall" DECIMAL(65,30),
    "rainfall_anomaly" DECIMAL(65,30),
    "dry_day_count" INTEGER,
    "daytime_lst_c" DECIMAL(65,30),
    "nighttime_lst_c" DECIMAL(65,30),
    "daytime_lst_anomaly" DECIMAL(65,30),
    "nighttime_lst_anomaly" DECIMAL(65,30),
    "hot_day_count" INTEGER,
    "vegetation_stress" DECIMAL(65,30),
    "water_stress_index" DECIMAL(65,30),
    "adjusted_water_stress" DECIMAL(65,30),
    "heat_stress_index" DECIMAL(65,30),
    "quality_status" TEXT,
    "hls_product" TEXT,
    "hls_version" TEXT,
    "smap_product" TEXT,
    "smap_version" TEXT,
    "gpm_product" TEXT,
    "gpm_version" TEXT,
    "gpm_latency_class" TEXT,
    "modis_product" TEXT,
    "modis_version" TEXT,
    "processing_date" TIMESTAMPTZ(6),
    "data_sources" JSONB,
    "analysis_window_start" DATE,
    "analysis_window_end" DATE,

    CONSTRAINT "earth_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baselines" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "variable" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "mean" DECIMAL(65,30) NOT NULL,
    "std" DECIMAL(65,30) NOT NULL,
    "n" INTEGER NOT NULL,
    "n_years" INTEGER NOT NULL,
    "years_included" JSONB NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "sample_quality" TEXT NOT NULL,
    "crop_matched" BOOLEAN,
    "gpm_latency_class" TEXT,

    CONSTRAINT "baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_condition_scores" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "window_start" DATE NOT NULL,
    "window_end" DATE NOT NULL,
    "vegetation_condition_score" DECIMAL(65,30),
    "water_condition_score" DECIMAL(65,30),
    "heat_condition_score" DECIMAL(65,30),
    "field_condition_score" DECIMAL(65,30),
    "available_components" JSONB NOT NULL,
    "missing_components" JSONB NOT NULL,
    "nasa_sources_available" INTEGER NOT NULL,
    "data_quality_status" TEXT NOT NULL,
    "scoring_version" TEXT NOT NULL DEFAULT 'v6.2',

    CONSTRAINT "field_condition_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotations" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "season_sequence" JSONB NOT NULL,
    "crops" JSONB NOT NULL,
    "rotation_cycle_mode" TEXT NOT NULL,
    "repeat_context_crop" TEXT,
    "repeat_context_type" TEXT,
    "water_score" DECIMAL(65,30),
    "soil_score" DECIMAL(65,30),
    "heat_score" DECIMAL(65,30),
    "diversity_score" DECIMAL(65,30),
    "profitability_score" DECIMAL(65,30),
    "base_soil_health_score" DECIMAL(65,30),
    "drainage_penalty" DECIMAL(65,30),
    "ph_penalty" DECIMAL(65,30),
    "organic_matter_adjustment" DECIMAL(65,30) DEFAULT 0,
    "soil_score_final" DECIMAL(65,30),
    "water_stress_index" DECIMAL(65,30),
    "adjusted_water_stress" DECIMAL(65,30),
    "heat_stress_index" DECIMAL(65,30),
    "water_multiplier" DECIMAL(65,30),
    "heat_multiplier" DECIMAL(65,30),
    "effective_water_weight" DECIMAL(65,30),
    "effective_heat_weight" DECIMAL(65,30),
    "overall_score" DECIMAL(65,30),
    "feasibility_status" TEXT NOT NULL,
    "sample_quality" TEXT,
    "crop_matched" BOOLEAN,
    "data_quality_status" TEXT,
    "observation_ids_used" JSONB,
    "baseline_ids_used" JSONB,
    "explanation" JSONB NOT NULL,
    "scoring_version" TEXT NOT NULL DEFAULT 'v6.2',
    "scored_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seasons_name_key" ON "seasons"("name");

-- CreateIndex
CREATE UNIQUE INDEX "crops_name_key" ON "crops"("name");
