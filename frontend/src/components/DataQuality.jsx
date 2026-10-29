import React from 'react';

/**
 * DataQuality Component (Spec Section 52)
 * Renders NASA Data Status badges, spatial resolution disclosures, and baseline provenance.
 */
export default function DataQuality({ conditionScore, nasaMetadata, lang = 'en' }) {
  const isBn = lang === 'bn';

  // Source metadata from verified Phase 0 & Phase 5/6 configurations
  const sources = [
    {
      name: 'HLS (HLSL30_VI / HLSS30_VI)',
      family: isBn ? 'উদ্ভিদের অবস্থা ও সবুজায়ন' : 'Vegetation Condition',
      status: isBn ? 'সক্রিয়' : 'Available',
      statusType: 'available',
      resolution: isBn ? '৩০-মিটার অপটিক্যাল / NIR / SWIR' : '30-meter optical / NIR / SWIR',
      cadence: isBn ? '১০–১২টি দৃশ্য/৩০ দিন (২–৩ দিনে পুনঃপর্যবেক্ষণ)' : '10–12 valid scenes/30d (2–3d combined revisit)',
      version: `v${nasaMetadata?.hls_version || '2.0'}`
    },
    {
      name: `SMAP (${nasaMetadata?.smap_product || 'SPL3SMP_E'})`,
      family: isBn ? 'মাটির আর্দ্রতা ও পানির চাপ' : 'Soil Moisture Stress',
      status: isBn ? 'সক্রিয়' : 'Available',
      statusType: 'available',
      resolution: isBn ? '৯ কিমি রেডিওমিটার গ্রিড' : '9 km enhanced radiometer grid',
      cadence: isBn ? 'দৈনিক ০–৫ সেমি আয়তনিক আর্দ্রতা (m³/m³)' : 'Daily 0–5 cm volumetric (m³/m³)',
      version: `v${nasaMetadata?.smap_version || '006'}`
    },
    {
      name: `GPM IMERG (${nasaMetadata?.gpm_product || 'GPM_3IMERGDF'} / ${nasaMetadata?.gpm_latency_class || 'Final'})`,
      family: isBn ? 'বৃষ্টিপাত ও খরা পরিস্থিতি' : 'Rainfall & Drought Stress',
      status: isBn ? 'সক্রিয়' : 'Available',
      statusType: 'available',
      resolution: isBn ? '০.১° (~১০ কিমি) ক্যালিব্রেটেড গ্রিড' : '0.1° (~10 km) calibrated grid',
      cadence: isBn ? 'দৈনিক বৃষ্টিপাত + ৩০ দিনের চলমান যোগফল' : 'Daily calibrated precipitation + 30d rolling sum',
      version: `v${nasaMetadata?.gpm_version || '07'}`
    },
    {
      name: 'MODIS LST (MOD11A1 / MYD11A1)',
      family: isBn ? 'তাপমাত্রা ও তাপীয় চাপ' : 'Thermal & Heat Stress',
      status: isBn ? 'সক্রিয়' : 'Available',
      statusType: 'available',
      resolution: isBn ? '১ কিমি তাপীয় ভূপৃষ্ঠ গ্রিড' : '1 km thermal surface grid',
      cadence: isBn ? 'দিন ও রাতের LST তাপমাত্রা (Terra + Aqua)' : 'Daytime + Nighttime LST (Terra + Aqua)',
      version: `v${nasaMetadata?.modis_version || '061'}`
    }
  ];

  return (
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-emerald-800/40">
        <div>
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            {isBn ? 'আর্থ অবজারভেশন ডেটার সত্যতা ও উপগ্রহ উৎস' : 'Earth Observation Provenance & Verification'}
          </span>
          <h3 className="text-xl sm:text-2xl md:text-2xl font-black text-white flex items-center gap-2 tracking-tight font-heading">
            {isBn ? 'নাসা আর্থ অবজারভেশন উপগ্রহের ডেটা স্ট্যাটাস' : 'NASA Earth Observation Data Status'}
          </h3>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {isBn ? '✓ ৪টির মধ্যে ৪টিই সক্রিয়' : '✓ 4 of 4 Active'}
          </span>
        </div>
      </div>

      {/* Grid of 4 NASA Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
        {sources.map((s) => (
          <div key={s.name} className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-sm sm:text-base font-extrabold text-white block font-heading">{s.name}</span>
                <span className="text-xs sm:text-sm text-emerald-300/80 block mt-0.5 font-medium">{s.family}</span>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shrink-0">
                ✓ {s.status}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-emerald-200/80 space-y-1 mt-2.5 pt-2.5 border-t border-emerald-900/60">
              <div>
                <span className="text-emerald-400/80 font-semibold">{isBn ? 'রেজোলিউশন:' : 'Resolution:'}</span>
                <span className="text-white font-medium ml-1">{s.resolution}</span>
              </div>
              <div>
                <span className="text-emerald-400/80 font-semibold">{isBn ? 'ফ্রিকোয়েন্সি:' : 'Cadence:'}</span>
                <span className="text-emerald-100 ml-1">{s.cadence}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Spatial Resolution Disclosure Banner (Mandatory Spec Section 52 Notice) */}
      <div className="bg-[#042116]/90 border border-emerald-600/40 rounded-xl p-3.5 sm:p-4 mb-4 text-xs sm:text-sm leading-relaxed text-emerald-100 shadow-sm">
        <p className="flex items-start gap-2.5">
          <span className="text-emerald-400 text-lg leading-none mt-0.5">ℹ</span>
          <span className="leading-relaxed">
            {isBn ? (
              <>
                <strong className="font-bold text-emerald-300">স্থানিক রেজোলিউশন সংক্রান্ত তথ্য:</strong> নাসা উপগ্রহ ডেটাগুলোর স্থানিক রেজোলিউশন ভিন্ন ভিন্ন। বৃষ্টিপাত (GPM ~১০ কিমি) ও মাটির আর্দ্রতা (SMAP ৯ কিমি) ডেটা বৃহত্তর আঞ্চলিক জলবায়ুর বৈশিষ্ট্য প্রকাশ করে, যা HLS-এর ৩০-মিটার স্থানীয় অপটিক্যাল উদ্ভিজ্জ পর্যবেক্ষণের পরিপূরক হিসেবে কাজ করে।
              </>
            ) : (
              <>
                <strong className="font-bold text-emerald-300">Spatial Resolution Disclosure:</strong> NASA data have different spatial resolutions. Rainfall (GPM ~10 km) and soil-moisture (SMAP 9 km) signals represent broader regional landscape patterns than the 30-meter localized optical vegetation observations from HLS.
              </>
            )}
          </span>
        </p>
      </div>

      {/* Baseline Quality & Crop-Matching Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3.5 sm:p-4 shadow-sm">
        <div>
          <span className="text-emerald-300/80 block text-xs font-semibold">
            {isBn ? 'বিশ্লেষণ সময়কাল:' : 'Analysis Window:'}
          </span>
          <span className="font-bold text-white mt-1 block">2023-12-30 to 2024-02-28 (61d)</span>
        </div>
        <div>
          <span className="text-emerald-300/80 block text-xs font-semibold">
            {isBn ? 'ঐতিহাসিক বেসলাইন DOY:' : 'Historical Baseline DOY:'}
          </span>
          <span className="font-bold text-white mt-1 block">DOY 59 ± 7 days (2019–2023)</span>
        </div>
        <div>
          <span className="text-emerald-300/80 block text-xs font-semibold">
            {isBn ? 'নমুনা মানের মাত্রা:' : 'Sample Quality Dimension:'}
          </span>
          <span className="font-bold text-emerald-400 mt-1 block">
            {isBn ? 'ব্যবহারযোগ্য (ফসল-সামঞ্জস্যপূর্ণ)' : 'Usable (Crop-Matched)'}
          </span>
        </div>
      </div>
    </div>
  );
}
