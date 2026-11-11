import { Link } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  AlertTriangle,
  Satellite,
} from "lucide-react";
import { PageHeading, Card, SectionHeading } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
const translations = {
  en: {
    eyebrow: "DECISION SUPPORT",
    title: "Rotation recommendation",
    description:
      "Review the leading option, why it may fit and what still needs local verification.",

    topOption: "TOP ILLUSTRATIVE OPTION",
    cropSequence: "Aman Rice → Lentil → Mung bean",
    candidateDescription:
      "A candidate sequence to review against field conditions, local agronomic guidance and the assumptions used in the evaluation.",
    score: "Illustrative score",

    whyTitle: "Why this option is surfaced",
    reasons: [
      "Potential to diversify seasonal crop sequences.",
      "Can be assessed against soil-health priorities.",
      "Allows comparison of water requirements across seasons.",
    ],

    tradeoffsTitle: "Trade-offs to consider",
    tradeoffs: [
      "Actual suitability depends on local planting windows.",
      "Water access and drainage can change the outcome.",
      "Market access, seed availability and labour are not guaranteed.",
    ],

    evidenceTitle: "Evidence and limitations",
    evidenceDescription:
      "A recommendation should remain explainable and traceable.",
    evidenceItems: [
      "Earth observation context",
      "Evaluation assumptions",
      "Uncertainty and limitations",
    ],
    evidenceNote:
      "Replace these illustrative explanations with the evidence and limitations returned by the existing backend.",

    bottomText: "Review planting-window context for a district and crop.",
    advisoryButton: "Open planting advisory",
  },

  bn: {
    eyebrow: "সিদ্ধান্ত সহায়তা",
    title: "শস্য পর্যায়ক্রম সুপারিশ",
    description:
      "প্রধান বিকল্পটি পর্যালোচনা করুন, কেন এটি উপযুক্ত হতে পারে এবং কোন বিষয়গুলো স্থানীয়ভাবে যাচাই করা প্রয়োজন তা দেখুন।",

    topOption: "সর্বোচ্চ প্রস্তাবিত বিকল্প",
    cropSequence: "আমন ধান → মসুর ডাল → মুগ ডাল",
    candidateDescription:
      "মাঠের অবস্থা, স্থানীয় কৃষি নির্দেশনা এবং মূল্যায়নে ব্যবহৃত অনুমানের ভিত্তিতে এই সম্ভাব্য শস্য পর্যায়ক্রমটি পর্যালোচনা করুন।",
    score: "নমুনা স্কোর",

    whyTitle: "কেন এই বিকল্পটি প্রস্তাব করা হয়েছে",
    reasons: [
      "মৌসুমি শস্য পর্যায়ক্রমে বৈচিত্র্য আনার সম্ভাবনা রয়েছে।",
      "মাটির স্বাস্থ্য উন্নয়নের অগ্রাধিকারের ভিত্তিতে মূল্যায়ন করা যায়।",
      "বিভিন্ন মৌসুমে পানির চাহিদা তুলনা করার সুযোগ দেয়।",
    ],

    tradeoffsTitle: "যেসব বিষয় বিবেচনা করতে হবে",
    tradeoffs: [
      "প্রকৃত উপযোগিতা স্থানীয় রোপণের সময়সীমার ওপর নির্ভর করে।",
      "পানির প্রাপ্যতা ও নিষ্কাশন ব্যবস্থা ফলাফল পরিবর্তন করতে পারে।",
      "বাজার সুবিধা, বীজের প্রাপ্যতা এবং শ্রমিক নিশ্চিত নয়।",
    ],

    evidenceTitle: "প্রমাণ ও সীমাবদ্ধতা",
    evidenceDescription:
      "একটি সুপারিশের ব্যাখ্যা এবং তথ্যের উৎস যাচাইযোগ্য হওয়া উচিত।",
    evidenceItems: [
      "পৃথিবী পর্যবেক্ষণ সংক্রান্ত তথ্য",
      "মূল্যায়নের অনুমানসমূহ",
      "অনিশ্চয়তা ও সীমাবদ্ধতা",
    ],
    evidenceNote:
      "এই নমুনা ব্যাখ্যাগুলোর পরিবর্তে বিদ্যমান ব্যাকএন্ড থেকে প্রাপ্ত প্রমাণ ও সীমাবদ্ধতার তথ্য ব্যবহার করুন।",

    bottomText: "একটি জেলা ও ফসলের জন্য রোপণের উপযুক্ত সময় পর্যালোচনা করুন।",
    advisoryButton: "রোপণ পরামর্শ দেখুন",
  },
};

const RecommendationPage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Card className="recommendation-hero">
        <div className="recommendation-badge">
          <CheckCircle2 size={16} /> {t.topOption}
        </div>

        <h2>{t.cropSequence}</h2>

        <p>{t.candidateDescription}</p>

        <div className="recommendation-score">
          <b>87</b>
          <span>
            / 100
            <br />
            {t.score}
          </span>
        </div>
      </Card>

      <div className="recommendation-grid">
        <Card>
          <SectionHeading title={t.whyTitle} />

          <ul className="reason-list">
            {t.reasons.map((reason, index) => (
              <li key={index}>
                <CheckCircle2 />
                {reason}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading title={t.tradeoffsTitle} />

          <ul className="reason-list caution">
            {t.tradeoffs.map((tradeoff, index) => (
              <li key={index}>
                <AlertTriangle />
                {tradeoff}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="evidence-card">
        <SectionHeading
          title={t.evidenceTitle}
          description={t.evidenceDescription}
        />

        <div className="audit-items">
          <span>
            <Satellite /> {t.evidenceItems[0]}
          </span>

          <span>
            <Info /> {t.evidenceItems[1]}
          </span>

          <span>
            <AlertTriangle /> {t.evidenceItems[2]}
          </span>
        </div>

        <p className="muted">{t.evidenceNote}</p>
      </Card>

      <div className="bottom-action">
        <p>{t.bottomText}</p>

        <Link className="button primary" to="/advisory">
          {t.advisoryButton}
          <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
};

export default RecommendationPage;
