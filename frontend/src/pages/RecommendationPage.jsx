import { Link, useLocation } from "react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";

import { PageHeading, Card, SectionHeading } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";

const translations = {
  en: {
    eyebrow: "DECISION SUPPORT",
    title: "Rotation recommendation",
    description:
      "Review the selected strategy, its evidence, and its limitations.",
    topOption: "SELECTED STRATEGY",
    sequence: "Crop sequence",
    score: "Model score",
    whyTitle: "Why this option",
    alternativesTitle: "Other options considered",
    evidenceTitle: "Evidence and limitations",
    noResult: "No evaluation result was passed to this page.",
    goPlanner: "Return to planner",
    advisoryButton: "Open planting advisory",
    caveat:
      "This model score is not a guarantee of agricultural success or a validated yield or profitability prediction.",
    none: "No details were returned for this section.",
    stability: "Stability",
    soilBasis: "Soil basis",
    climate: "Climate context",
    limitations: "Limitations",
    notModeled: "Not modeled",
    disclaimer: "Disclaimer",
  },
  bn: {
    eyebrow: "সিদ্ধান্ত সহায়তা",
    title: "শস্য পর্যায়ের সুপারিশ",
    description: "নির্বাচিত কৌশল, এর প্রমাণ এবং সীমাবদ্ধতা পর্যালোচনা করুন।",
    topOption: "নির্বাচিত কৌশল",
    sequence: "শস্যের পর্যায়ক্রম",
    score: "মডেল স্কোর",
    whyTitle: "এই বিকল্পের কারণ",
    alternativesTitle: "বিবেচিত অন্যান্য বিকল্প",
    evidenceTitle: "প্রমাণ ও সীমাবদ্ধতা",
    noResult: "এই পৃষ্ঠায় কোনো মূল্যায়নের ফলাফল পাওয়া যায়নি।",
    goPlanner: "পরিকল্পনায় ফিরুন",
    advisoryButton: "রোপণ পরামর্শ দেখুন",
    caveat:
      "এই মডেল স্কোর কৃষি সাফল্যের নিশ্চয়তা বা যাচাইকৃত ফলন কিংবা লাভের পূর্বাভাস নয়।",
    none: "এই অংশের জন্য কোনো তথ্য ফেরত আসেনি।",
    stability: "স্থিতিশীলতা",
    soilBasis: "মাটির ভিত্তি",
    climate: "জলবায়ু প্রসঙ্গ",
    limitations: "সীমাবদ্ধতা",
    notModeled: "মডেলে অন্তর্ভুক্ত নয়",
    disclaimer: "দায়মুক্তি",
  },
};

const asArray = (value) => (Array.isArray(value) ? value : []);

function getSequence(strategy, language) {
  const sequence =
    strategy?.cropSequence ??
    strategy?.sequence ??
    strategy?.crops ??
    strategy?.rotation;

  if (!Array.isArray(sequence)) return [];

  return sequence
    .map((crop) => {
      if (typeof crop === "string") return crop;

      return (
        (language === "bn" ? crop?.labelBn : crop?.label) ??
        crop?.label ??
        crop?.labelBn ??
        crop?.nameEn ??
        crop?.name ??
        crop?.slug ??
        ""
      );
    })
    .filter(Boolean);
}

function getText(value) {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object") {
    return (
      value.message || value.text || value.description || JSON.stringify(value)
    );
  }
  return "";
}

function renderValue(value, emptyText) {
  if (value == null || value === "") {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  if (Array.isArray(value)) {
    return value.length ? (
      <ul className="mt-2 space-y-2 text-sm text-slate-700">
        {value.map((item, index) => (
          <li className="flex gap-2" key={index}>
            <span className="text-green-700">•</span>
            <span>{getText(item)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-500">{emptyText}</p>
    );
  }

  if (typeof value === "object") {
    return (
      <dl className="mt-2 space-y-2 text-sm">
        {Object.entries(value).map(([key, item]) => (
          <div className="flex flex-wrap gap-x-2" key={key}>
            <dt className="font-medium text-slate-700">{key}:</dt>
            <dd className="text-slate-600">{getText(item)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <p className="mt-2 text-sm text-slate-700">{String(value)}</p>;
}

function getStrategyName(strategy, index, language) {
  return (
    (language === "bn" ? strategy?.labelBn : strategy?.label) ??
    strategy?.label ??
    strategy?.labelBn ??
    getSequence(strategy, language).join(" → ") ??
    `${language === "bn" ? "কৌশল" : "Strategy"} ${index + 1}`
  );
}

export default function RecommendationPage() {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const { state } = useLocation();

  const savedEvaluation = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("rotationEvaluation") || "null");
    } catch {
      return null;
    }
  })();

  const result = state?.result ?? savedEvaluation?.result ?? null;
  const payload = state?.payload ?? savedEvaluation?.payload ?? null;

  const strategies = [...asArray(result?.strategies)].sort((a, b) => {
    const rankA = Number(a.rank ?? a.ranking ?? a.rankScore);
    const rankB = Number(b.rank ?? b.ranking ?? b.rankScore);

    if (Number.isFinite(rankA) && !Number.isFinite(rankB)) return -1;
    if (!Number.isFinite(rankA) && Number.isFinite(rankB)) return 1;

    if (Number.isFinite(rankA) && Number.isFinite(rankB)) {
      return rankA - rankB;
    }

    const scoreA = Number(a.score ?? a.rankingScore);
    const scoreB = Number(b.score ?? b.rankingScore);

    if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
      return scoreB - scoreA;
    }

    return 0;
  });

  const selectedStrategy = state?.selectedStrategy ?? strategies[0] ?? null;

  const selectedIndex = strategies.findIndex(
    (item) => item === selectedStrategy,
  );

  const alternatives = strategies.filter((_, index) => index !== selectedIndex);

  const sequence = getSequence(selectedStrategy, language);

  const score = selectedStrategy?.score ?? selectedStrategy?.rankingScore;

  const reasons =
    selectedStrategy?.reasons ??
    selectedStrategy?.explanations ??
    selectedStrategy?.benefits;

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      {!result || !selectedStrategy ? (
        <Card className="p-6">
          <p className="text-slate-700">{t.noResult}</p>
          <Link
            className="mt-4 inline-flex text-sm font-medium text-green-700 hover:underline"
            to="/planner"
          >
            {t.goPlanner}
          </Link>
        </Card>
      ) : (
        <>
          <Card className="border-green-200 bg-green-50/50 p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              <CheckCircle2 size={15} />
              {t.topOption}
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-slate-900">
              {getStrategyName(selectedStrategy, selectedIndex, language) ||
                t.sequence}
            </h2>

            {sequence.length > 0 && (
              <p className="mt-2 text-slate-700">{sequence.join(" → ")}</p>
            )}

            {score != null && (
              <div className="mt-5 inline-flex items-baseline gap-2">
                <strong className="text-3xl text-green-800">{score}</strong>
                <span className="text-sm text-slate-600">{t.score}</span>
              </div>
            )}

            <p className="mt-4 flex gap-2 text-sm text-amber-900">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              {t.caveat}
            </p>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionHeading title={t.whyTitle} />
              {renderValue(reasons, t.none)}
            </Card>

            <Card className="p-5">
              <SectionHeading title={t.alternativesTitle} />
              {renderValue(
                alternatives.map((item, index) => {
                  const name = getStrategyName(item, index, language);
                  const itemScore = item?.score ?? item?.rankingScore;
                  return itemScore != null
                    ? `${name} (${t.score}: ${itemScore})`
                    : name;
                }),
                t.none,
              )}
            </Card>
          </div>

          <Card className="mt-5 p-5">
            <SectionHeading title={t.evidenceTitle} />
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                [t.whyTitle, result.decision],
                [t.climate, result.window],
                [t.evidenceTitle, result.evidence?.distributions],
                [t.limitations, result.limitations],
                [t.disclaimer, result.disclaimer],
              ].map(([label, value]) => (
                <section className="rounded-lg bg-slate-50 p-4" key={label}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Info size={16} className="text-slate-500" />
                    {label}
                  </h3>
                  {renderValue(value, t.none)}
                </section>
              ))}
            </div>
          </Card>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {language === "bn"
                ? "জেলা ও ফসলের রোপণ-সময়ের প্রসঙ্গ পর্যালোচনা করুন।"
                : "Review planting-window context for a district and crop."}
            </p>
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
              to="/advisory"
              state={{ payload, result }}
            >
              {t.advisoryButton}
              <ArrowRight size={16} />
            </Link>
          </div>
        </>
      )}
    </>
  );
}
