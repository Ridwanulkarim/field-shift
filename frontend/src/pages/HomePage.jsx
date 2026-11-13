import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  GitCompareArrows,
  Lightbulb,
  MapPinned,
  Sprout,
  LayoutDashboard,
  CheckCircle2,
  Satellite,
} from "lucide-react";
import { FeatureCard, SectionHeading } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";

const features = [
  {
    icon: LayoutDashboard,
    title: "Field dashboard",
    description:
      "Review field condition indicators, crop history, climate context and NASA data quality information.",
    titleBn: "কৃষি জমির ড্যাশবোর্ড",
    descriptionBn:
      "জমির অবস্থা, ফসলের ইতিহাস, জলবায়ু পরিস্থিতি এবং NASA ডেটার মান পর্যালোচনা করুন।",
    to: "/dashboard",
  },
  {
    icon: MapPinned,
    title: "Field management",
    description:
      "Register and manage fields with district, soil, drainage, irrigation and crop-history details.",
    titleBn: "জমি ব্যবস্থাপনা",
    descriptionBn:
      "জেলা, মাটি, পানি নিষ্কাশন, সেচ এবং ফসলের ইতিহাসসহ জমি নিবন্ধন ও পরিচালনা করুন।",
    to: "/fields",
  },
  {
    icon: Sprout,
    title: "Crop rotation planner",
    description:
      "Build crop sequences across seasons and adjust priorities to explore different rotation options.",
    titleBn: "শস্য পর্যায় পরিকল্পনা",
    descriptionBn:
      "বিভিন্ন মৌসুমের ফসলের পর্যায় তৈরি করুন এবং বিভিন্ন বিকল্প যাচাই করতে অগ্রাধিকার পরিবর্তন করুন।",
    to: "/planner",
  },
  {
    icon: GitCompareArrows,
    title: "Rotation comparison",
    description:
      "Compare candidate rotations, scores, potential benefits, trade-offs and field-level risks.",
    titleBn: "শস্য পর্যায় তুলনা",
    descriptionBn:
      "সম্ভাব্য শস্য পর্যায়, স্কোর, সুবিধা, সীমাবদ্ধতা এবং জমিভিত্তিক ঝুঁকির তুলনা করুন।",
    to: "/comparison",
  },
  {
    icon: Lightbulb,
    title: "Recommendations",
    description:
      "Review the suggested rotation alongside its supporting evidence and practical limitations.",
    titleBn: "কৃষি সুপারিশ",
    descriptionBn:
      "প্রস্তাবিত শস্য পর্যায়ের পাশাপাশি এর প্রমাণ এবং ব্যবহারিক সীমাবদ্ধতা পর্যালোচনা করুন।",
    to: "/recommendation",
  },
  {
    icon: CalendarDays,
    title: "Planting advisory",
    description:
      "Explore district- and crop-specific planting-window analysis, sensitivity details and SMS sharing.",
    titleBn: "রোপণ পরামর্শ",
    descriptionBn:
      "জেলা ও ফসলভিত্তিক রোপণের সময়সূচি, সংবেদনশীলতা এবং এসএমএস শেয়ারিং সুবিধা দেখুন।",
    to: "/advisory",
  },
];

const steps = [
  {
    number: "01",
    title: "Add your field",
    description:
      "Enter location, soil and water-management details, along with crop history.",
    titleBn: "আপনার জমি যোগ করুন",
    descriptionBn:
      "জমির অবস্থান, মাটি, পানি ব্যবস্থাপনা এবং ফসলের ইতিহাসের তথ্য দিন।",
  },
  {
    number: "02",
    title: "Explore options",
    description:
      "Choose crops, seasons and priorities, then compare possible crop sequences.",
    titleBn: "বিভিন্ন বিকল্প দেখুন",
    descriptionBn:
      "ফসল, মৌসুম এবং অগ্রাধিকার নির্বাচন করুন, তারপর সম্ভাব্য শস্য পর্যায়ের তুলনা করুন।",
  },
  {
    number: "03",
    title: "Review the evidence",
    description:
      "Check the reasoning, risks, data provenance and limitations before making a decision.",
    titleBn: "প্রমাণ ও তথ্য পর্যালোচনা করুন",
    descriptionBn:
      "সিদ্ধান্ত নেওয়ার আগে যুক্তি, ঝুঁকি, ডেটার উৎস এবং সীমাবদ্ধতা যাচাই করুন।",
  },
];

const translations = {
  en: {
    heroTitle: "Make more informed decisions for",
    heroHighlight: "every field.",
    heroDescription:
      "Aboho brings field information and NASA Earth observation data together to help farmers explore crop-rotation options, understand climate context and review planting windows.",
    dashboard: "Open my dashboard",
    planner: "Explore rotation planner",
    evidence: "Evidence-led insights",
    observation: "Earth observation context",

    featureEyebrow: "WHAT YOU CAN DO",
    featureTitle: "Tools for better field decisions",
    featureDescription: "Explore the main features available in Aboho.",

    stepsEyebrow: "HOW IT WORKS",
    stepsTitle: "From field details to a clearer choice",
    stepsDescription:
      "A guided workflow that keeps the farmer and the field at the centre.",

    stepLabel: "STEP",

    disclaimerTitle: "Important to know",
    disclaimer:
      "Aboho is a decision-support tool, not a weather forecast or a guarantee of crop performance. Consider its results alongside local knowledge, field conditions and the uncertainty of Earth observation data.",

    ctaTitle: "Ready to explore your field?",
    ctaDescription: "Start with your field overview or create a field profile.",
    manageFields: "Manage fields",
    goDashboard: "Go to dashboard",

    nasa: "NASA data",
    earthObservation: "EARTH OBSERVATION",
    fieldIntelligence: "FIELD INTELLIGENCE",
    oneField: "One field at a time",
  },

  bn: {
    heroTitle: "প্রতিটি জমির জন্য আরও তথ্যভিত্তিক",
    heroHighlight: "সিদ্ধান্ত নিন।",
    heroDescription:
      "আবহ জমির তথ্য এবং NASA-এর পৃথিবী পর্যবেক্ষণ ডেটা একত্রিত করে কৃষকদের শস্য পর্যায়ের বিকল্প অনুসন্ধান, জলবায়ু পরিস্থিতি বোঝা এবং রোপণের উপযুক্ত সময় পর্যালোচনায় সহায়তা করে।",
    dashboard: "ড্যাশবোর্ড দেখুন",
    planner: "শস্য পর্যায় পরিকল্পনা দেখুন",
    evidence: "প্রমাণভিত্তিক তথ্য",
    observation: "পৃথিবী পর্যবেক্ষণের তথ্য",

    featureEyebrow: "আপনি যা করতে পারবেন",
    featureTitle: "উন্নত কৃষি সিদ্ধান্তের জন্য সরঞ্জাম",
    featureDescription: "আবহে উপলব্ধ প্রধান সুবিধাগুলো দেখুন।",

    stepsEyebrow: "যেভাবে কাজ করে",
    stepsTitle: "জমির তথ্য থেকে সঠিক সিদ্ধান্তের পথে",
    stepsDescription:
      "একটি নির্দেশিত প্রক্রিয়া যেখানে কৃষক এবং জমিকে সর্বোচ্চ গুরুত্ব দেওয়া হয়।",

    stepLabel: "ধাপ",

    disclaimerTitle: "গুরুত্বপূর্ণ তথ্য",
    disclaimer:
      "আবহ একটি সিদ্ধান্ত সহায়ক সরঞ্জাম, এটি আবহাওয়ার পূর্বাভাস বা ফসলের ফলনের নিশ্চয়তা নয়। এর ফলাফল স্থানীয় জ্ঞান, জমির অবস্থা এবং পৃথিবী পর্যবেক্ষণ ডেটার অনিশ্চয়তার সঙ্গে বিবেচনা করুন।",

    ctaTitle: "আপনার জমি সম্পর্কে জানতে প্রস্তুত?",
    ctaDescription:
      "আপনার জমির সারসংক্ষেপ দেখুন অথবা একটি নতুন জমির প্রোফাইল তৈরি করুন।",
    manageFields: "জমি পরিচালনা করুন",
    goDashboard: "ড্যাশবোর্ডে যান",

    nasa: "NASA ডেটা",
    earthObservation: "পৃথিবী পর্যবেক্ষণ",
    fieldIntelligence: "কৃষি জমির তথ্য",
    oneField: "প্রতিটি জমির জন্য আলাদা তথ্য",
  },
};

const HomePage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const translatedFeatures = features.map((item) => ({
    ...item,
    title: language === "bn" ? item.titleBn : item.title,
    description: language === "bn" ? item.descriptionBn : item.description,
  }));

  const translatedSteps = steps.map((item) => ({
    ...item,
    title: language === "bn" ? item.titleBn : item.title,
    description: language === "bn" ? item.descriptionBn : item.description,
  }));

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            {t.heroTitle} <em>{t.heroHighlight}</em>
          </h1>

          <p>{t.heroDescription}</p>

          <div className="hero-actions">
            <Link className="button light" to="/dashboard">
              {t.dashboard}
              <ArrowRight size={16} />
            </Link>

            <Link className="button outline-light" to="/planner">
              {t.planner}
            </Link>
          </div>

          <div className="hero-meta">
            <span>
              <CheckCircle2 size={15} />
              {t.evidence}
            </span>

            <span>
              <Satellite size={15} />
              {t.observation}
            </span>
          </div>
        </div>

        <div
          className="hero-art"
          aria-label={
            language === "bn"
              ? "মানচিত্রে কৃষি জমির চিত্র"
              : "Illustration representing a mapped agricultural field"
          }
        >
          <div className="field-map">
            <div className="field-lines" />
            <span className="map-pin" />

            <div className="map-chip chip-top">
              <small>{t.earthObservation}</small>
              <b>{t.nasa}</b>
            </div>

            <div className="map-chip chip-bottom">
              <small>{t.fieldIntelligence}</small>
              <b>{t.oneField}</b>
            </div>
          </div>
        </div>

        <div className="hero-decoration" />
      </section>

      <section className="content-section">
        <SectionHeading
          eyebrow={t.featureEyebrow}
          title={t.featureTitle}
          description={t.featureDescription}
        />

        <div className="feature-grid">
          {translatedFeatures.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="content-section">
        <SectionHeading
          eyebrow={t.stepsEyebrow}
          title={t.stepsTitle}
          description={t.stepsDescription}
        />

        <div className="steps-grid">
          {translatedSteps.map((item) => (
            <article className="step-card" key={item.number}>
              <span>
                {item.number} / {t.stepLabel}
              </span>

              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="disclaimer">
        <b>{t.disclaimerTitle}</b>
        <p>{t.disclaimer}</p>
      </aside>

      <section className="home-cta">
        <div>
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaDescription}</p>
        </div>

        <div>
          <Link className="button secondary" to="/fields">
            {t.manageFields}
          </Link>

          <Link className="button primary" to="/dashboard">
            {t.goDashboard}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
