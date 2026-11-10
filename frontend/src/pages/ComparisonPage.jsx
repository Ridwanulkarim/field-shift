
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { rotations } from "../data/mockData";
import {
  PageHeading,
  Card,
  SectionHeading,
} from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";


const translations = {
  en: {
    eyebrow: "EVALUATE OPTIONS",
    title: "Rotation comparison",
    description:
      "Compare candidate crop sequences using their relative scores, benefits and risks.",
    editPlan: "Edit plan",
    candidateTitle: "Candidate rotations",
    candidateDescription:
      "Illustrative results for interface preview only.",
    topScore: "Top illustrative score",
    alternative: "Alternative",
    riskProfile: "Risk profile",
    recommendedInsight:
      "Review this option against local conditions.",
    alternativeInsight:
      "Review the trade-offs before selecting.",
    bottomText:
      "Want to review the evidence and limitations behind the leading option?",
    recommendation: "View recommendation",
    score: "Score",
  },

  bn: {
    eyebrow: "বিকল্প মূল্যায়ন",
    title: "শস্য পর্যায় তুলনা",
    description:
      "আপেক্ষিক স্কোর, সুবিধা এবং ঝুঁকির ভিত্তিতে সম্ভাব্য শস্য পর্যায়গুলোর তুলনা করুন।",
    editPlan: "পরিকল্পনা সম্পাদনা",
    candidateTitle: "সম্ভাব্য শস্য পর্যায়",
    candidateDescription:
      "শুধুমাত্র ইন্টারফেসের প্রিভিউর জন্য নমুনা ফলাফল।",
    topScore: "সর্বোচ্চ নমুনা স্কোর",
    alternative: "বিকল্প",
    riskProfile: "ঝুঁকির ধরন",
    recommendedInsight:
      "স্থানীয় পরিস্থিতির সঙ্গে এই বিকল্পটি পর্যালোচনা করুন।",
    alternativeInsight:
      "নির্বাচনের আগে সুবিধা ও অসুবিধাগুলো পর্যালোচনা করুন।",
    bottomText:
      "সেরা বিকল্পটির প্রমাণ এবং সীমাবদ্ধতা পর্যালোচনা করতে চান?",
    recommendation: "সুপারিশ দেখুন",
    score: "স্কোর",
  },
};

const ComparisonPage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        action={
          <Link className="button secondary" to="/planner">
            {t.editPlan}
          </Link>
        }
      />

      <Card>
        <SectionHeading
          title={t.candidateTitle}
          description={t.candidateDescription}
        />

        <div className="comparison-grid">
          {rotations.map((item, i) => (
            <article
              className={`rotation-card ${i === 0 ? "recommended" : ""}`}
              key={item.name}
            >
              <div className="rotation-top">
                <span className="pill">
                  {i === 0 ? t.topScore : t.alternative}
                </span>

                <span className="score">
                  {item.score}
                  <small>/100</small>
                </span>
              </div>

              <h3>{item.name}</h3>

              <p>
                {language === "bn"
                  ? item.noteBn || item.note
                  : item.note}
              </p>

              <div className="progress">
                <i style={{ width: `${item.score}%` }} />
              </div>

              <div className="risk-row">
                <span>{t.riskProfile}</span>
                <b>
                  {language === "bn"
                    ? item.riskBn || item.risk
                    : item.risk}
                </b>
              </div>

              <div className="rotation-insight">
                {i === 0 ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}

                <span>
                  {i === 0
                    ? t.recommendedInsight
                    : t.alternativeInsight}
                </span>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <div className="bottom-action">
        <p>{t.bottomText}</p>

        <Link className="button primary" to="/recommendation">
          {t.recommendation}
          <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
};

export default ComparisonPage;
