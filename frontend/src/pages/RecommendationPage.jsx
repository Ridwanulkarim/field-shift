import { Link, useLocation } from "react-router";
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2 } from "lucide-react";

import { PageHeading, Card, SectionHeading } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
import {
  advisoryCropOf,
  alternativesOf,
  cropNames,
  existingOf,
  findStrategy,
  readSavedEvaluation,
  signed,
  watchItems,
  whyItems,
} from "../utils/rotationView";
import { tr, trList } from "../utils/bnText";
import { digits } from "../utils/i18n";

const translations = {
  en: {
    eyebrow: "DECISION SUPPORT",
    title: "Rotation recommendation",
    description: "Why this option scores well, what to watch, and what the evidence is.",
    noResult: "There is no evaluation to show yet.",
    goPlanner: "Go to the planner",
    topOption: "HIGHEST-SCORING OPTION",
    yourCurrent: "YOUR CURRENT ROTATION",
    score: "Heuristic score",
    outOf: "out of 100",
    headline: (name, label) => `For ${name}, consider ${label}.`,
    headlineCurrent: (name, label) => `Your current rotation for ${name}: ${label}.`,
    versus: (d, current) => `${d} points compared with your current rotation (${current}).`,
    documented: "Documented pattern",
    documentedHelp: "Reported in a BRRI/BARI survey or trial. This is not a recommendation for your farm.",
    stable: "The ranking is stable",
    unstable: "The ranking is sensitive to the weights",
    whyTitle: "Why it scores well",
    watchTitle: "What to watch",
    nothingToWatch: "No major trade-off found by these rules.",
    othersTitle: "Other options",
    current: "your current rotation",
    evidenceTitle: "Rain and heat evidence per crop",
    colCrop: "Crop",
    colMonths: "Growing months",
    colNeed: "Assumed water need (mm)",
    colRain: "Mean rain in those months (mm)",
    colHeat: "Days at or above the heat limit",
    gapsTitle: "What this does not know",
    notModeled: "Not modelled",
    soilBasis: "Soil basis",
    soilEntered: "You entered both soil values.",
    soilPartial: "Part of the soil information was not entered, so that match was left out of the score.",
    climateNote: (source, end) => `Climate data: ${source}, through ${end}.`,
    advisoryText: "Check when to plant: see whether the start of usable rain has moved.",
    advisoryButton: "Open planting advisory",
    caveat: "This score compares options under simple rules. It is not a guarantee of success or a validated yield or profit prediction. Please check with your local agricultural extension officer.",
    limitations: "Limits to keep in mind",
    disclaimer: "Disclaimer",
    back: "Back to comparison",
  },
  bn: {
    eyebrow: "সিদ্ধান্ত সহায়তা",
    title: "শস্য পর্যায়ের সুপারিশ",
    description: "কেন এই বিকল্পের স্কোর ভালো, কী লক্ষ্য রাখবেন এবং প্রমাণ কী।",
    noResult: "দেখানোর মতো কোনো মূল্যায়ন এখনও নেই।",
    goPlanner: "পরিকল্পনায় যান",
    topOption: "সর্বোচ্চ স্কোরের বিকল্প",
    yourCurrent: "আপনার বর্তমান পর্যায়",
    score: "অনুমানভিত্তিক স্কোর",
    outOf: "১০০-র মধ্যে",
    headline: (name, label) => `${name} জেলার জন্য ভেবে দেখুন: ${label}।`,
    headlineCurrent: (name, label) => `${name} জেলায় আপনার বর্তমান পর্যায়: ${label}।`,
    versus: (d, current) => `আপনার বর্তমান পর্যায় (${current})-এর তুলনায় ${d} পয়েন্ট।`,
    documented: "নথিভুক্ত পদ্ধতি",
    documentedHelp: "BRRI/BARI-র জরিপ বা পরীক্ষায় উল্লেখ আছে। এটি আপনার জমির জন্য সুপারিশ নয়।",
    stable: "র‍্যাঙ্কিং স্থিতিশীল",
    unstable: "র‍্যাঙ্কিং ওজনের পরিবর্তনে সংবেদনশীল",
    whyTitle: "কেন স্কোর ভালো",
    watchTitle: "যা লক্ষ্য রাখবেন",
    nothingToWatch: "এই নিয়মে বড় কোনো ঘাটতি পাওয়া যায়নি।",
    othersTitle: "অন্যান্য বিকল্প",
    current: "আপনার বর্তমান পর্যায়",
    evidenceTitle: "ফসলভিত্তিক বৃষ্টি ও তাপের প্রমাণ",
    colCrop: "ফসল",
    colMonths: "চাষের মাস",
    colNeed: "ধরে নেওয়া পানির প্রয়োজন (মিমি)",
    colRain: "ওই মাসগুলোর গড় বৃষ্টি (মিমি)",
    colHeat: "তাপসীমা ছোঁয়া বা ছাড়ানো দিন",
    gapsTitle: "যা এই হিসাবে জানা নেই",
    notModeled: "মডেলে অন্তর্ভুক্ত নয়",
    soilBasis: "মাটির ভিত্তি",
    soilEntered: "আপনি মাটির দুটি তথ্যই দিয়েছেন।",
    soilPartial: "মাটির কিছু তথ্য দেওয়া হয়নি, তাই সেই মিল স্কোর থেকে বাদ দেওয়া হয়েছে।",
    climateNote: (source, end) => `জলবায়ু তথ্য: ${source}, ${end} পর্যন্ত।`,
    advisoryText: "কখন রোপণ করবেন দেখুন: কার্যকর বৃষ্টি শুরুর সময় সরেছে কি না।",
    advisoryButton: "রোপণ পরামর্শ দেখুন",
    caveat: "এই স্কোর সহজ নিয়মে বিকল্প তুলনা করে। এটি সাফল্যের নিশ্চয়তা বা যাচাইকৃত ফলন বা লাভের পূর্বাভাস নয়। স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শ নিন।",
    limitations: "যা মনে রাখতে হবে",
    disclaimer: "দায়মুক্তি",
    back: "তুলনায় ফিরুন",
  },
};

function List({ items, empty }) {
  if (!items.length) return <p className="mt-2 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
      {items.map((item, i) => (
        <li className="flex gap-2" key={i}>
          <span className="text-green-700">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RecommendationPage() {
  const { language } = useLanguage();
  const lang = language === "bn" ? "bn" : "en";
  const t = translations[lang];
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const nf = (n, d = 1) => Number(n).toLocaleString(locale, { maximumFractionDigits: d });
  const { state } = useLocation();
  const monthName = (m) => new Date(Date.UTC(2001, m - 1, 1)).toLocaleDateString(locale, { month: "short", timeZone: "UTC" });

  const saved = readSavedEvaluation();
  const result = state?.result ?? saved?.result ?? null;
  const payload = state?.payload ?? saved?.payload ?? null;

  const current = existingOf(result);
  const alternatives = alternativesOf(result);
  // The page opens on the strategy picked on the comparison page, otherwise on the top-ranked alternative.
  const selected = findStrategy(result, state?.selectedId) ?? alternatives[0] ?? current;
  const others = [current, ...alternatives].filter((s) => s && s !== selected);

  const districtName = result?.district ? (lang === "bn" ? result.district.nameBn : result.district.nameEn) : "";
  const isCurrent = selected?.kind === "existing";
  const cmp = selected?.comparison;
  const watch = selected ? watchItems(selected, lang) : [];
  const why = selected ? whyItems(selected, lang) : [];
  const adviceCrop = advisoryCropOf(selected) ?? advisoryCropOf(current);
  const prov = result?.climate?.provenance;
  const soilBasis = result?.soilBasis;
  const soilComplete = soilBasis && Object.values(soilBasis).every((v) => v === "entered");

  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />

      {!result || !selected ? (
        <Card className="p-6">
          <p className="text-slate-700">{t.noResult}</p>
          <Link className="mt-4 inline-flex text-sm font-medium text-green-700 hover:underline" to="/planner">
            {t.goPlanner}
          </Link>
        </Card>
      ) : (
        <>
          <Card className="border-green-200 bg-green-50/50 p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              <CheckCircle2 size={15} />
              {isCurrent ? t.yourCurrent : t.topOption}
            </div>

            <h2 className="mt-4 text-2xl font-semibold leading-snug text-slate-900">
              {(isCurrent ? t.headlineCurrent : t.headline)(districtName, cropNames(selected, lang).join(" → "))}
            </h2>

            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {selected.score != null && (
                <span className="inline-flex items-baseline gap-2">
                  <strong className="text-3xl text-green-800">{nf(selected.score)}</strong>
                  <span className="text-sm text-slate-600">{t.score} · {t.outOf}</span>
                </span>
              )}
              {!isCurrent && cmp?.scoreDifference != null && current && (
                <span className="text-sm font-medium text-green-800">{t.versus(signed(cmp.scoreDifference, locale), cropNames(current, lang).join(" → "))}</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {selected.pattern?.documented && (
                <span className="inline-flex items-center gap-1.5 text-green-800" title={t.documentedHelp}>
                  <BadgeCheck size={16} /> {t.documented}
                </span>
              )}
              {!isCurrent && result.stability?.applicable && (
                <span className={result.stability.verdict === "stable" ? "text-green-800" : "text-amber-800"} title={tr(result.stability.explanation, lang)}>
                  {result.stability.verdict === "stable" ? t.stable : t.unstable}
                </span>
              )}
            </div>

            <p className="mt-4 flex gap-2 text-sm text-amber-900">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              {t.caveat}
            </p>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionHeading title={t.whyTitle} />
              <List items={why.slice(0, 6)} empty={t.nothingToWatch} />
            </Card>
            <Card className="p-5">
              <SectionHeading title={t.watchTitle} />
              <List items={watch} empty={t.nothingToWatch} />
            </Card>
          </div>

          <Card className="mt-5 p-5">
            <SectionHeading title={t.othersTitle} />
            <ul className="divide-y divide-slate-100">
              {others.map((s) => (
                <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" key={s.id}>
                  <span className="text-slate-800">
                    {cropNames(s, lang).join(" → ")}
                    {s.kind === "existing" && <span className="ml-2 text-xs text-slate-500">({t.current})</span>}
                  </span>
                  <span className="tabular-nums text-slate-700">{s.score != null ? nf(s.score) : "—"}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="mt-5 p-5">
            <SectionHeading title={t.evidenceTitle} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="px-2 py-2">{t.colCrop}</th>
                    <th className="px-2 py-2">{t.colMonths}</th>
                    <th className="px-2 py-2">{t.colNeed}</th>
                    <th className="px-2 py-2">{t.colRain}</th>
                    <th className="px-2 py-2">{t.colHeat}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.evidence.map((e) => (
                    <tr className="border-b border-slate-100 text-sm tabular-nums text-slate-800" key={e.crop}>
                      <td className="px-2 py-2">{lang === "bn" ? (e.cropBn ?? e.crop) : e.crop}</td>
                      <td className="px-2 py-2">{e.months.length ? `${monthName(e.months[0])} – ${monthName(e.months[e.months.length - 1])}` : "—"}</td>
                      <td className="px-2 py-2">{`${nf(e.assumedWaterNeedMm[0], 0)}–${nf(e.assumedWaterNeedMm[1], 0)}`}</td>
                      <td className="px-2 py-2">{e.meanRainDuringCropMm != null ? nf(e.meanRainDuringCropMm, 0) : "—"}</td>
                      <td className="px-2 py-2">{e.shareOfDaysAtOrAboveThreshold != null ? `${nf(e.shareOfDaysAtOrAboveThreshold * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {prov && <p className="mt-3 text-xs text-slate-600">{t.climateNote(prov.source, digits(prov.endDate, lang))}</p>}
          </Card>

          <Card className="mt-5 p-5">
            <details>
              <summary className="cursor-pointer font-semibold text-slate-900">{t.gapsTitle}</summary>
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{t.soilBasis}</h3>
                  <p className="mt-1 text-sm text-slate-700">{soilComplete ? t.soilEntered : t.soilPartial}</p>
                </div>
                {(lang === "bn" ? (selected.informationGapsBn ?? trList(selected.informationGaps ?? [], "bn")) : selected.informationGaps)?.length > 0 && (
                  <List items={lang === "bn" ? (selected.informationGapsBn ?? trList(selected.informationGaps ?? [], "bn")) : selected.informationGaps} empty="" />
                )}
                {result.notModeled?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t.notModeled}</h3>
                    <List items={result.notModeled.map((n) => (lang === "bn" ? n.bn : n.en))} empty="" />
                  </div>
                )}
                {result.limitations?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t.limitations}</h3>
                    <List items={trList(result.limitations, lang)} empty="" />
                  </div>
                )}
                {result.disclaimer && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t.disclaimer}</h3>
                    <p className="mt-1 text-sm text-slate-700">{tr(result.disclaimer, lang)}</p>
                  </div>
                )}
              </div>
            </details>
          </Card>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link className="text-sm font-medium text-green-800 hover:underline" to="/comparison" state={{ result, payload }}>
              {t.back}
            </Link>
            {adviceCrop && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">{t.advisoryText}</p>
                <Link
                  className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                  to="/advisory"
                  state={{ district: result.district?.slug, crop: adviceCrop }}
                >
                  {t.advisoryButton}
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
