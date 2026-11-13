import { Link, useLocation, useNavigate } from "react-router";
import { AlertTriangle, ArrowRight, BadgeCheck, Sprout } from "lucide-react";

import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
import {
  alternativesOf,
  cropNames,
  existingOf,
  readSavedEvaluation,
  signed,
  strategyLabel,
  watchItems,
} from "../utils/rotationView";
import { tr, trList } from "../utils/bnText";

const translations = {
  en: {
    eyebrow: "EVALUATE OPTIONS",
    title: "Rotation comparison",
    description: "Your current rotation next to the highest-scoring alternatives.",
    editPlan: "Edit plan",
    noResult: "There is no evaluation to show yet.",
    goPlanner: "Go to the planner",
    currentTitle: "Your current rotation",
    alternativesTitle: "Better-scoring options",
    alternativesDescription: "Ranked by the heuristic score, highest first.",
    score: "score",
    outOf: "out of 100",
    rank: (n) => `#${n}`,
    documented: "Documented pattern",
    documentedHelp: "Reported in a BRRI/BARI survey or trial. This is not a recommendation for your farm.",
    monthsInField: (n) => `In crop about ${n} months a year`,
    why: "What improves",
    watch: "What to watch",
    nothingToWatch: "No major trade-off found by these rules.",
    details: "See full details",
    versus: (d) => `${d} points compared with your current rotation`,
    verdictBetter: (name, label, score, delta, current) =>
      `Highest-scoring option for ${name}: ${label} (score ${score}, ${delta} points compared with your current rotation, ${current}).`,
    verdictNone: (name, current, score) =>
      `For ${name}, none of the alternatives scores higher than your current rotation (${current}, score ${score}).`,
    limitations: "Limits to keep in mind",
    disclaimer: "Scores compare options under simple rules. They are not validated yield or profit predictions.",
  },
  bn: {
    eyebrow: "বিকল্প মূল্যায়ন",
    title: "শস্য পর্যায় তুলনা",
    description: "আপনার বর্তমান পর্যায়ের পাশে সর্বোচ্চ স্কোরের বিকল্পগুলো।",
    editPlan: "পরিকল্পনা সম্পাদনা",
    noResult: "দেখানোর মতো কোনো মূল্যায়ন এখনও নেই।",
    goPlanner: "পরিকল্পনায় যান",
    currentTitle: "আপনার বর্তমান পর্যায়",
    alternativesTitle: "বেশি স্কোরের বিকল্প",
    alternativesDescription: "অনুমানভিত্তিক স্কোর অনুযায়ী, সর্বোচ্চ আগে।",
    score: "স্কোর",
    outOf: "১০০-র মধ্যে",
    rank: (n) => `#${n.toLocaleString("bn-BD")}`,
    documented: "নথিভুক্ত পদ্ধতি",
    documentedHelp: "BRRI/BARI-র জরিপ বা পরীক্ষায় উল্লেখ আছে। এটি আপনার জমির জন্য সুপারিশ নয়।",
    monthsInField: (n) => `বছরে প্রায় ${n.toLocaleString("bn-BD")} মাস জমিতে ফসল থাকে`,
    why: "যা ভালো হয়",
    watch: "যা লক্ষ্য রাখবেন",
    nothingToWatch: "এই নিয়মে বড় কোনো ঘাটতি পাওয়া যায়নি।",
    details: "বিস্তারিত দেখুন",
    versus: (d) => `বর্তমান পর্যায়ের তুলনায় ${d} পয়েন্ট`,
    verdictBetter: (name, label, score, delta, current) =>
      `${name} জেলায় সর্বোচ্চ স্কোরের বিকল্প: ${label} (স্কোর ${score}, আপনার বর্তমান পর্যায় ${current}-এর তুলনায় ${delta} পয়েন্ট)।`,
    verdictNone: (name, current, score) =>
      `${name} জেলায় কোনো বিকল্পের স্কোরই আপনার বর্তমান পর্যায়ের (${current}, স্কোর ${score}) চেয়ে বেশি নয়।`,
    limitations: "যা মনে রাখতে হবে",
    disclaimer: "স্কোর সহজ নিয়মে বিকল্প তুলনা করে। এগুলো যাচাইকৃত ফলন বা লাভের পূর্বাভাস নয়।",
  },
};

function ScoreBar({ score, label, shown }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${shown ?? score}`}>
      <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.max(0, Math.min(100, Number(score)))}%` }} />
    </div>
  );
}

export default function ComparisonPage() {
  const { language } = useLanguage();
  const lang = language === "bn" ? "bn" : "en";
  const t = translations[lang];
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const { state } = useLocation();
  const navigate = useNavigate();
  const nf = (n) => Number(n).toLocaleString(locale, { maximumFractionDigits: 1 });

  const saved = readSavedEvaluation();
  const result = state?.result ?? saved?.result ?? null;
  const payload = state?.payload ?? saved?.payload ?? null;

  const current = existingOf(result);
  const alternatives = alternativesOf(result);
  const districtName = result?.district ? (lang === "bn" ? result.district.nameBn : result.district.nameEn) : "";
  const top = alternatives[0] ?? null;

  const openDetails = (strategy) =>
    navigate("/recommendation", { state: { result, payload, selectedId: strategy.id } });

  const verdict = (() => {
    if (!current || current.score == null) return "";
    if (top && top.score > current.score) {
      return t.verdictBetter(districtName, strategyLabel(top, lang), nf(top.score), signed(top.comparison?.scoreDifference ?? top.score - current.score, locale), strategyLabel(current, lang));
    }
    return t.verdictNone(districtName, strategyLabel(current, lang), nf(current.score));
  })();

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        action={
          <Link className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/planner">
            {t.editPlan}
          </Link>
        }
      />

      {!result || !current ? (
        <Card className="p-6">
          <p className="text-slate-700">{t.noResult}</p>
          <Link className="mt-4 inline-flex text-sm font-medium text-green-700 hover:underline" to="/planner">
            {t.goPlanner}
          </Link>
        </Card>
      ) : (
        <>
          {verdict && (
            <Card className="border-green-200 bg-green-50/60 p-5">
              <p className="flex items-start gap-3 text-lg font-semibold leading-snug text-slate-900">
                <Sprout className="mt-1 shrink-0 text-green-700" size={22} />
                {verdict}
              </p>
            </Card>
          )}

          <Card className="mt-5 p-5">
            <SectionHeading title={t.currentTitle} />
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">{cropNames(current, lang).join(" → ")}</h3>
                {current.score != null && (
                  <span className="text-lg font-semibold text-slate-900">
                    {nf(current.score)} <small className="text-xs font-normal text-slate-500">{t.outOf}</small>
                  </span>
                )}
              </div>
              {current.score != null && <ScoreBar score={current.score} label={t.score} shown={nf(current.score)} />}
              <p className="mt-3 text-sm text-slate-600">{t.monthsInField(current.monthsInField)}</p>
              {current.pattern?.documented && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-800" title={t.documentedHelp}>
                  <BadgeCheck size={16} /> {t.documented}
                </p>
              )}
              {current.summary && <p className="mt-3 text-sm leading-6 text-slate-600">{tr(current.summary, lang)}</p>}
            </div>
          </Card>

          <Card className="mt-5 p-5">
            <SectionHeading title={t.alternativesTitle} description={t.alternativesDescription} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {alternatives.map((strategy) => {
                const cmp = strategy.comparison;
                const watch = watchItems(strategy, lang);
                const improvements = lang === "bn"
                  ? (cmp?.improvements?.length ? trList(cmp.improvements, "bn") : (strategy.benefitsBn ?? trList(strategy.benefits ?? [], "bn")))
                  : (cmp?.improvements?.length ? cmp.improvements : strategy.benefits ?? []);
                return (
                  <article className="flex flex-col rounded-xl border border-slate-200 p-5" key={strategy.id}>
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${strategy.rank === 1 ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                        {t.rank(strategy.rank)}
                      </span>
                      <span className="text-lg font-semibold text-slate-900">
                        {nf(strategy.score)} <small className="text-xs font-normal text-slate-500">{t.outOf}</small>
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-900">{cropNames(strategy, lang).join(" → ")}</h3>
                    <ScoreBar score={strategy.score} label={t.score} shown={nf(strategy.score)} />
                    {cmp?.scoreDifference != null && <p className="mt-2 text-sm font-medium text-green-800">{t.versus(signed(cmp.scoreDifference, locale))}</p>}
                    {strategy.pattern?.documented && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-800" title={t.documentedHelp}>
                        <BadgeCheck size={16} /> {t.documented}
                      </p>
                    )}

                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-800">{t.why}</p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-600">
                        {improvements.slice(0, 3).map((x, i) => (
                          <li key={i}>• {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-slate-800">{t.watch}</p>
                      {watch.length ? (
                        <ul className="mt-1 space-y-1 text-sm text-slate-600">
                          {watch.slice(0, 3).map((x, i) => (
                            <li key={i}>• {x}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-slate-500">{t.nothingToWatch}</p>
                      )}
                    </div>

                    <Button className="mt-5 self-start" onClick={() => openDetails(strategy)}>
                      {t.details}
                      <ArrowRight size={16} />
                    </Button>
                  </article>
                );
              })}
            </div>
          </Card>

          {result.limitations?.length > 0 && (
            <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <summary className="flex cursor-pointer items-center gap-2 font-medium">
                <AlertTriangle size={18} className="shrink-0" />
                {t.limitations}
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {trList(result.limitations, lang).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}

          <p className="mt-4 text-sm text-slate-500">{t.disclaimer}</p>
        </>
      )}
    </>
  );
}
