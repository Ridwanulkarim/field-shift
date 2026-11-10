import {
  Activity,
  CloudRain,
  MapPinned,
  Satellite,
  TrendingUp,
} from "lucide-react";
import { PageHeading, StatCard, Card, SectionHeading } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";


const translations = {
  en: {
    eyebrow: "OVERVIEW",
    title: "Field dashboard",
    description:
      "A consolidated view of your field context, crop history and available environmental data.",

    stats: [
      {
        label: "Field condition score",
        value: "78 / 100",
        detail: "Illustrative heuristic score",
      },
      {
        label: "Registered fields",
        value: "02",
        detail: "Across 2 districts",
      },
      {
        label: "Climate context",
        value: "Available",
        detail: "Observation coverage varies",
      },
      {
        label: "Data provenance",
        value: "Auditable",
        detail: "Source and quality details",
      },
    ],

    fieldLocation: "Field location",
    fieldDescription: "Illustrative field overview in Bangladesh.",
    northPlot: "North Plot",
    riverField: "River-side Field",
    bangladesh: "BANGLADESH",

    environment: "Environmental context",
    environmentDescription: "Example indicators, not a forecast.",

    metrics: [
      ["Rainfall context", "Moderate", "68%"],
      ["Soil moisture context", "Stable", "74%"],
      ["Vegetation signal", "Healthy", "82%"],
    ],

    auditTitle: "NASA data quality & provenance",
    auditDescription:
      "Review source, temporal coverage and limitations before interpreting derived indicators.",

    auditItems: [
      "Earth observation sources",
      "Quality checks",
      "Derived indicators",
    ],

    backendNotice:
      "Connect this panel to the API response and metadata returned by your existing backend before production use.",
  },

  bn: {
    eyebrow: "সারসংক্ষেপ",
    title: "কৃষি জমির ড্যাশবোর্ড",
    description:
      "আপনার জমির অবস্থা, ফসলের ইতিহাস এবং উপলব্ধ পরিবেশগত তথ্যের একটি সমন্বিত চিত্র।",

    stats: [
      {
        label: "জমির অবস্থার স্কোর",
        value: "৭৮ / ১০০",
        detail: "নমুনাভিত্তিক মূল্যায়ন স্কোর",
      },
      {
        label: "নিবন্ধিত জমি",
        value: "০২",
        detail: "২টি জেলায় অবস্থিত",
      },
      {
        label: "জলবায়ু পরিস্থিতি",
        value: "উপলব্ধ",
        detail: "পর্যবেক্ষণের পরিধি ভিন্ন হতে পারে",
      },
      {
        label: "ডেটার উৎস ও নির্ভরযোগ্যতা",
        value: "যাচাইযোগ্য",
        detail: "উৎস ও মানের বিবরণ",
      },
    ],

    fieldLocation: "জমির অবস্থান",
    fieldDescription: "বাংলাদেশে জমির একটি নমুনাভিত্তিক চিত্র।",
    northPlot: "উত্তর প্লট",
    riverField: "নদী তীরবর্তী জমি",
    bangladesh: "বাংলাদেশ",

    environment: "পরিবেশগত পরিস্থিতি",
    environmentDescription: "নমুনা সূচক, আবহাওয়ার পূর্বাভাস নয়।",

    metrics: [
      ["বৃষ্টিপাতের পরিস্থিতি", "মাঝারি", "68%"],
      ["মাটির আর্দ্রতার অবস্থা", "স্থিতিশীল", "74%"],
      ["উদ্ভিদের অবস্থা", "স্বাস্থ্যকর", "82%"],
    ],

    auditTitle: "NASA ডেটার মান ও উৎস",
    auditDescription:
      "প্রাপ্ত সূচক ব্যাখ্যা করার আগে ডেটার উৎস, সময়কাল এবং সীমাবদ্ধতা পর্যালোচনা করুন।",

    auditItems: [
      "পৃথিবী পর্যবেক্ষণ তথ্যের উৎস",
      "ডেটার মান যাচাই",
      "বিশ্লেষণভিত্তিক সূচক",
    ],

    backendNotice:
      "প্রোডাকশনে ব্যবহারের আগে এই প্যানেলটি আপনার বিদ্যমান ব্যাকএন্ডের API রেসপন্স এবং মেটাডেটার সঙ্গে সংযুক্ত করুন।",
  },
};

const DashboardPage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const statIcons = [Activity, MapPinned, CloudRain, Satellite];

  const statTones = [undefined, "blue", "amber", undefined];

  const auditIcons = [Satellite, Activity, TrendingUp];

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <div className="stats-grid">
        {t.stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            icon={statIcons[index]}
            tone={statTones[index]}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <Card>
          <SectionHeading
            title={t.fieldLocation}
            description={t.fieldDescription}
          />

          <div className="map-placeholder">
            <div className="map-river" />

            <span className="map-marker marker-a">{t.northPlot}</span>

            <span className="map-marker marker-b">{t.riverField}</span>

            <span className="map-label">{t.bangladesh}</span>
          </div>
        </Card>

        <Card>
          <SectionHeading
            title={t.environment}
            description={t.environmentDescription}
          />

          <div className="metric-list">
            {t.metrics.map(([name, status, val]) => (
              <div className="metric-row" key={name}>
                <div>
                  <b>{name}</b>
                  <small>{status}</small>
                </div>

                <strong>{val}</strong>

                <div className="progress">
                  <i style={{ width: val }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="audit-card">
        <SectionHeading title={t.auditTitle} description={t.auditDescription} />

        <div className="audit-items">
          {t.auditItems.map((item, index) => {
            const Icon = auditIcons[index];

            return (
              <span key={item}>
                <Icon size={17} />
                {item}
              </span>
            );
          })}
        </div>

        <p className="muted">{t.backendNotice}</p>
      </Card>
    </>
  );
};

export default DashboardPage;
