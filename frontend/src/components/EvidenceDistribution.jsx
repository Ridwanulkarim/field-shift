import { useLanguage } from "../layouts/context/LanguageContext";
import { digits, fmtNum, localeOf } from "../utils/i18n";

const TEXT = {
  en: {
    none: "No additional details were returned.",
    unit: "Measurement unit",
    unitDay: "Day of year (1 January = Day 1)",
    unspecified: "Not specified",
    early: "Early years",
    late: "Late years",
    totalYears: "Total years",
    confirmed: "Confirmed",
    censored: "Censored",
    unknown: "Unknown",
    summary: "Statistical summary",
    n: "Sample size",
    min: "Minimum",
    q1: "Q1",
    median: "Median",
    q3: "Q3",
    max: "Maximum",
    dates: "Date equivalents",
    q1Date: "Q1 date",
    medianDate: "Median date",
    q3Date: "Q3 date",
    observed: "Observed values",
  },
  bn: {
    none: "অতিরিক্ত কোনো তথ্য পাওয়া যায়নি।",
    unit: "পরিমাপের একক",
    unitDay: "বছরের দিন (১ জানুয়ারি = ১ম দিন)",
    unspecified: "উল্লেখ নেই",
    early: "আগের বছরগুলো",
    late: "পরের বছরগুলো",
    totalYears: "মোট বছর",
    confirmed: "নিশ্চিত",
    censored: "সীমিত (মৌসুম শেষ পর্যন্ত বৃষ্টি হয়নি)",
    unknown: "অজানা",
    summary: "পরিসংখ্যানগত সারসংক্ষেপ",
    n: "নমুনার সংখ্যা",
    min: "সর্বনিম্ন",
    q1: "প্রথম চতুর্থাংশ",
    median: "মধ্যমান",
    q3: "তৃতীয় চতুর্থাংশ",
    max: "সর্বোচ্চ",
    dates: "তারিখের সমতুল্য",
    q1Date: "প্রথম চতুর্থাংশের তারিখ",
    medianDate: "মধ্যমানের তারিখ",
    q3Date: "তৃতীয় চতুর্থাংশের তারিখ",
    observed: "পর্যবেক্ষিত মান",
  },
};

const EvidenceDistribution = ({ evidence }) => {
  const { language } = useLanguage();
  const lang = language === "bn" ? "bn" : "en";
  const t = TEXT[lang];
  const num = (v) => (v == null ? "—" : fmtNum(v, lang));

  if (!evidence?.distributions) {
    return <p className="text-sm text-gray-500">{t.none}</p>;
  }

  const distributions = evidence.distributions;

  const formatDate = (day) => {
    if (day == null) return "—";

    const date = new Date(Date.UTC(2025, 0, Number(day)));
    return date.toLocaleDateString(localeOf(lang), {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  };

  const groups = [
    { key: "early", label: t.early, color: "green" },
    { key: "late", label: t.late, color: "blue" },
  ];

  const stats = [
    ["n", t.n],
    ["min", t.min],
    ["q1", t.q1],
    ["median", t.median],
    ["q3", t.q3],
    ["max", t.max],
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-500">
          {t.unit}
        </p>
        <p className="mt-1 text-sm font-medium text-gray-800">
          {evidence.unit === "day of a 365-day year (1 January = 1)"
            ? t.unitDay
            : evidence.unit || t.unspecified}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map(({ key, label, color }) => {
          const item = distributions[key];
          if (!item) return null;

          const summary = item.summary || {};

          return (
            <div
              key={key}
              className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className={`border-b border-gray-200 p-4 ${
                color === "green" ? "bg-green-50" : "bg-blue-50"
              }`}>
                <p className="text-sm font-semibold text-gray-800">
                  {label}
                </p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {num(item.years ?? 0)}
                </p>
                <p className="text-xs text-gray-500">
                  {t.totalYears}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                {[
                  [t.confirmed, item.confirmedYears],
                  [t.censored, item.censoredYears],
                  [t.unknown, item.unknownYears],
                ].map(([name, value]) => (
                  <div key={name} className="min-w-0">
                    <p className="text-xs text-gray-500">{name}</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {num(value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 p-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-800">
                  {t.summary}
                </h4>

                <div className="space-y-2">
                  {stats.map(([keyName, labelName]) => (
                    <div
                      key={keyName}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-gray-500">
                        {labelName}
                      </span>
                      <span className="font-semibold text-gray-800 tabular-nums">
                        {num(summary[keyName])}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-600">
                    {t.dates}
                  </p>
                  {[
                    [t.q1Date, summary.q1Date],
                    [t.medianDate, summary.medianDate],
                    [t.q3Date, summary.q3Date],
                  ].map(([name, value]) => (
                    <div
                      key={name}
                      className="mt-2 flex justify-between gap-2 text-sm"
                    >
                      <span className="text-gray-500">{name}</span>
                      <span className="font-medium text-gray-800">
                        {value ? digits(value, lang) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {Array.isArray(item.valuesDayOfYear) && (
                <div className="border-t border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {t.observed}
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.valuesDayOfYear.map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {num(value)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
