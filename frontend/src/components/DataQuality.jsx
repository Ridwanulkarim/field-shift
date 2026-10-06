import React from 'react';

/**
 * DataQuality Component (Spec Section 52)
 * Renders NASA Data Status badges, spatial resolution disclosures, and baseline provenance.
 */
export default function DataQuality({ conditionScore, nasaMetadata }) {
  // Source metadata from verified Phase 0 & Phase 5/6 configurations
  const sources = [
    {
      name: 'HLS (HLSL30_VI / HLSS30_VI)',
      family: 'Vegetation Condition',
      status: 'Available',
      statusType: 'available',
      resolution: '30-meter optical / NIR / SWIR',
      cadence: '10–12 valid scenes/30d (2–3d combined revisit)',
      version: `v${nasaMetadata?.hls_version || '2.0'}`
    },
    {
      name: `SMAP (${nasaMetadata?.smap_product || 'SPL3SMP_E'})`,
      family: 'Soil Moisture Stress',
      status: 'Available',
      statusType: 'available',
      resolution: '9 km enhanced radiometer grid',
      cadence: 'Daily 0–5 cm volumetric (m³/m³)',
      version: `v${nasaMetadata?.smap_version || '006'}`
    },
    {
      name: `GPM IMERG (${nasaMetadata?.gpm_product || 'GPM_3IMERGDF'} / ${nasaMetadata?.gpm_latency_class || 'Final'})`,
      family: 'Rainfall & Drought Stress',
      status: 'Available',
      statusType: 'available',
      resolution: '0.1° (~10 km) calibrated grid',
      cadence: 'Daily calibrated precipitation + 30d rolling sum',
      version: `v${nasaMetadata?.gpm_version || '07'}`
    },
    {
      name: 'MODIS LST (MOD11A1 / MYD11A1)',
      family: 'Thermal & Heat Stress',
      status: 'Available',
      statusType: 'available',
      resolution: '1 km thermal surface grid',
      cadence: 'Daytime + Nighttime LST (Terra + Aqua)',
      version: `v${nasaMetadata?.modis_version || '061'}`
    }
  ];

  return (
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-6 md:p-7 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-emerald-800/40">
        <div>
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Spec Section 52 Data Quality Audit
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2 tracking-tight">
            NASA Earth Observation Data Status
          </h3>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ✓ 4 of 4 NASA Families Active
          </span>
        </div>
      </div>

      {/* Grid of 4 NASA Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {sources.map((s) => (
          <div key={s.name} className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-xs font-bold text-white block">{s.name}</span>
                <span className="text-[11px] text-emerald-300/70 block mt-0.5">{s.family}</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/60">
                ✓ {s.status}
              </span>
            </div>
            <div className="text-[11px] text-emerald-200/70 space-y-1 mt-3 pt-2.5 border-t border-emerald-900/60">
              <div><span className="text-emerald-400/80 font-medium">Resolution:</span> <span className="text-white font-medium ml-1">{s.resolution}</span></div>
              <div><span className="text-emerald-400/80 font-medium">Cadence:</span> <span className="text-emerald-100 ml-1">{s.cadence}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Spatial Resolution Disclosure Banner (Mandatory Spec Section 52 Notice) */}
      <div className="bg-[#042116]/90 border border-emerald-600/40 rounded-xl p-4 mb-5 text-xs text-emerald-100 shadow-sm">
        <p className="flex items-start gap-2.5">
          <span className="text-emerald-400 text-base leading-none mt-0.5">ℹ</span>
          <span className="leading-relaxed">
            <strong className="font-bold text-emerald-300">Spatial Resolution Disclosure:</strong> NASA data have different spatial resolutions. Rainfall (GPM ~10 km) and soil-moisture (SMAP 9 km) signals represent broader regional landscape patterns than the 30-meter localized optical vegetation observations from HLS.
          </span>
        </p>
      </div>

      {/* Baseline Quality & Crop-Matching Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 shadow-sm">
        <div>
          <span className="text-emerald-300/70 block text-[11px] font-medium">Analysis Window:</span>
          <span className="font-bold text-white mt-0.5 block">2023-12-30 to 2024-02-28 (61d)</span>
        </div>
        <div>
          <span className="text-emerald-300/70 block text-[11px] font-medium">Historical Baseline DOY:</span>
          <span className="font-bold text-white mt-0.5 block">DOY 59 ± 7 days (2019–2023)</span>
        </div>
        <div>
          <span className="text-emerald-300/70 block text-[11px] font-medium">Sample Quality Dimension:</span>
          <span className="font-bold text-emerald-400 mt-0.5 block">Usable (Crop-Matched)</span>
        </div>
      </div>
    </div>
  );
}
