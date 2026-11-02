import React from "react";

const Footer = ({ language = "bn" }) => {
  const isBangla = language === "bn";

  return (
    <footer className="bg-[#03130b] border-t border-emerald-900/50 px-3 sm:px-6 py-4 mt-4 sm:mt-5 text-xs text-emerald-200/60">
      <div className="w-full max-w-[99%] 2xl:max-w-[99.5%] mx-auto space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-emerald-900/40">
          {/* Decision Support Disclosure */}
          <div>
            <span className="font-bold text-emerald-100 block mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

              {isBangla
                ? "সিদ্ধান্ত সহায়তা সতর্কবার্তা"
                : "Decision Support Disclosure"}
            </span>

            <p className="text-[11px] leading-relaxed text-emerald-200/70">
              {isBangla
                ? "ফিল্ড শিফট হলো নাসা উপগ্রহ তথ্য (HLS, SMAP, GPM IMERG, MODIS LST), কৃষকের তথ্য এবং স্বচ্ছ কৃষি নিয়মের ওপর ভিত্তি করে তৈরি একটি সিদ্ধান্ত সহায়তা প্রোটোটাইপ। এটি কোনোভাবেই মৃত্তিকা গবেষণাগারের পরীক্ষা, স্থানীয় কৃষি সম্প্রসারণ অধিদপ্তরের পরামর্শ কিংবা মাঠ পর্যায়ের বিশেষজ্ঞ মতামতকে প্রতিস্থাপন করে না."
                : "Field Shift is a decision-support prototype based on NASA Earth observation data (HLS, SMAP, GPM IMERG, MODIS LST), farmer-provided inputs, and transparent agronomic scoring rules. It does not replace soil laboratory testing, local agricultural extension knowledge, or on-farm agronomic advice."}
            </p>
          </div>

          {/* Scientific Limitations */}
          <div>
            <span className="font-bold text-emerald-100 block mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />

              {isBangla
                ? "বৈজ্ঞানিক সীমাবদ্ধতা ও পর্যবেক্ষণ মূলনীতি"
                : "Scientific Limitations & Operational Caveats"}
            </span>

            <ul className="text-[11px] leading-relaxed text-emerald-200/70 list-disc list-inside space-y-1">
              {isBangla ? (
                <>
                  <li>
                    <strong className="text-emerald-100">পূর্বাভাস নয়:</strong>{" "}
                    সাম্প্রতিক নাসা উপগ্রহ পর্যবেক্ষণ বিগত ৬১ দিনের পরিবেশগত চাপ
                    তুলে ধরে, যা কোনো দীর্ঘমেয়াদী পূর্বাভাস নয়।
                  </li>

                  <li>
                    <strong className="text-emerald-100">বন্যা ঝুঁকি:</strong>{" "}
                    সরাসরি নদীর পানি বৃদ্ধি ও আকস্মিক প্লাবন মডেলিং এই
                    প্রোটোটাইপের পরিধিভুক্ত নয়।
                  </li>

                  <li>
                    <strong className="text-emerald-100">
                      অনুকরণমূলক মৌসুম:
                    </strong>{" "}
                    মৌসুমী সময়কাল বারি নির্দেশিকার ওপর ভিত্তি করে
                    অনুকরণমূলকভাবে নির্ধারিত।
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong className="text-emerald-100">
                      Not a forecast:
                    </strong>{" "}
                    Recent NASA conditions represent current climate pressures,
                    not predictive forecasts.
                  </li>

                  <li>
                    <strong className="text-emerald-100">Flood risk:</strong>{" "}
                    Direct inundation modeling is outside the MVP scope.
                  </li>

                  <li>
                    <strong className="text-emerald-100">
                      Simplified windows:
                    </strong>{" "}
                    Seasons use canonical BARI calendar approximations.
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-emerald-300/50 pt-1">
          <span>
            {isBangla
              ? "নাসা স্পেস অ্যাপস ও বৈশ্বিক জলবায়ু অভিযোজন উদ্যোগ • বাংলাদেশ"
              : "NASA Space Apps & Global Climate Adaptation Initiative • Bangladesh"}
          </span>

          <span className="font-mono">
            NASA Applied Sciences • Climate-Resilient Agriculture v6.2
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
