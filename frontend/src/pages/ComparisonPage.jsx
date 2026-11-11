import { Link, useLocation, useNavigate } from "react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";

const translations = {
  en: {
    eyebrow: "EVALUATE OPTIONS",
    title: "Rotation comparison",
    description: "Compare the strategies returned by the rotation evaluation.",
    editPlan: "Edit plan",
    candidateTitle: "Evaluated strategies",
    candidateDescription:
      "These are the strategies returned for your submitted inputs.",
    recommended: "Selected strategy",
    alternative: "Alternative",
    noResult: "No evaluation result was passed to this page.",
    goPlanner: "Return to planner",
    score: "Score",
    reasons: "Reasons",
    limitations: "Limitations",
    select: "View recommendation",
    disclaimer:
      "Model scores are not validated yield or profitability predictions.",
  },
  bn: {
    eyebrow: "বিকল্প মূল্যায়ন",
    title: "শস্য পর্যায় তুলনা",
    description: "শস্য পর্যায় মূল্যায়ন থেকে পাওয়া কৌশলগুলো তুলনা করুন।",
    editPlan: "পরিকল্পনা সম্পাদনা",
    candidateTitle: "মূল্যায়িত কৌশল",
    candidateDescription:
      "আপনার দেওয়া তথ্যের ভিত্তিতে API থেকে পাওয়া কৌশলগুলো।",
    recommended: "নির্বাচিত কৌশল",
    alternative: "বিকল্প",
    noResult: "এই পৃষ্ঠায় কোনো মূল্যায়নের ফলাফল পাওয়া যায়নি।",
    goPlanner: "পরিকল্পনায় ফিরুন",
    score: "স্কোর",
    reasons: "কারণ",
    limitations: "সীমাবদ্ধতা",
    select: "সুপারিশ দেখুন",
    disclaimer: "মডেলের স্কোর যাচাইকৃত ফলন বা লাভের পূর্বাভাস নয়।",
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

function getStrategyName(strategy, index, language) {
  return (
    (language === "bn" ? strategy?.labelBn : strategy?.label) ??
    strategy?.label ??
    strategy?.labelBn ??
    (getSequence(strategy, language).length
      ? getSequence(strategy, language).join(" → ")
      : `${language === "bn" ? "কৌশল" : "Strategy"} ${index + 1}`)
  );
}

function getReasons(strategy) {
  return asArray(
    strategy?.reasons ?? strategy?.explanations ?? strategy?.benefits,
  );
}

function getText(value) {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object") {
    return value.message || value.text || value.description || "";
  }
  return "";
}

export default function ComparisonPage() {
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

  const navigate = useNavigate();

  const strategies = [...asArray(result?.strategies)].sort((a, b) => {
    const rankA = Number(a.rank ?? a.ranking ?? a.rankScore);
    const rankB = Number(b.rank ?? b.ranking ?? b.rankScore);

    // Put strategies with an explicit rank first; lower rank is better.
    if (Number.isFinite(rankA) && !Number.isFinite(rankB)) return -1;
    if (!Number.isFinite(rankA) && Number.isFinite(rankB)) return 1;
    if (Number.isFinite(rankA) && Number.isFinite(rankB)) return rankA - rankB;

    // Fall back to a score only if the API provides one.
    const scoreA = Number(a.score ?? a.rankingScore);
    const scoreB = Number(b.score ?? b.rankingScore);
    if (Number.isFinite(scoreA) && Number.isFinite(scoreB))
      return scoreB - scoreA;

    return 0;
  });
  const alternatives = asArray(result?.alternativesConsidered);

  const items = strategies;

  const chooseStrategy = (strategy, index) => {
    navigate("/recommendation", {
      state: {
        result,
        payload,
        selectedStrategy: strategy,
        selectedIndex: index,
      },
    });
  };

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        action={
          <Link
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            to="/planner"
          >
            {t.editPlan}
          </Link>
        }
      />

      {!result ? (
        <Card className="p-6">
          <p className="text-slate-700">{t.noResult}</p>
          <Link
            className="mt-4 inline-flex text-sm font-medium text-green-700 hover:underline"
            to="/planner"
          >
            {t.goPlanner}
          </Link>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <SectionHeading title={t.candidateTitle} />
          <p className="text-slate-600">
            {result.message || result.disclaimer || t.noResult}
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <SectionHeading
              title={t.candidateTitle}
              description={t.candidateDescription}
            />

            <div className="grid gap-4 md:grid-cols-2">
              {items.map((strategy, index) => {
                const score = strategy.score ?? strategy.rankingScore;
                const reasons = getReasons(strategy);
                const isPrimary = index === 0;
                const sequence = getSequence(strategy, language);

                return (
                  <article
                    className="rounded-xl border border-slate-200 p-5"
                    key={
                      strategy.id ??
                      `${getStrategyName(strategy, index, language)}-${index}`
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isPrimary
                            ? "bg-green-50 text-green-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isPrimary ? t.recommended : t.alternative}
                      </span>

                      {score != null && (
                        <span className="text-right text-lg font-semibold text-slate-900">
                          {score}
                          <small className="ml-1 text-xs font-normal text-slate-500">
                            {t.score}
                          </small>
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                      {getStrategyName(strategy, index, language)}
                    </h3>

                    {sequence.length > 0 && (
                      <p className="mt-2 text-sm text-slate-600">
                        {sequence.join(" → ")}
                      </p>
                    )}

                    {score != null && (
                      <div
                        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
                        aria-label={`${t.score}: ${score}`}
                      >
                        <div
                          className="h-full rounded-full bg-green-600"
                          style={{
                            width: `${Math.max(0, Math.min(100, Number(score)))}%`,
                          }}
                        />
                      </div>
                    )}

                    {reasons.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-slate-800">
                          {t.reasons}
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                          {reasons.map((reason, reasonIndex) => (
                            <li key={reasonIndex}>• {getText(reason)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button
                      className="mt-5"
                      onClick={() => chooseStrategy(strategy, index)}
                    >
                      {t.select}
                      <ArrowRight size={16} />
                    </Button>
                  </article>
                );
              })}
            </div>
          </Card>

          {result.limitations && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t.limitations}</p>
                <p className="mt-1">
                  {Array.isArray(result.limitations)
                    ? result.limitations.map(getText).filter(Boolean).join(" ")
                    : getText(result.limitations)}
                </p>
              </div>
            </div>
          )}

          <p className="mt-4 text-sm text-slate-500">{t.disclaimer}</p>
        </>
      )}
    </>
  );
}
