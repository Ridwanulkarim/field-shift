import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";



const cropOptions = [
  { en: "Aman Rice", bn: "আমন ধান" },
  { en: "Aus Rice", bn: "আউশ ধান" },
  { en: "Boro Rice", bn: "বোরো ধান" },
  { en: "Wheat", bn: "গম" },
  { en: "Lentil", bn: "মসুর ডাল" },
  { en: "Mustard", bn: "সরিষা" },
  { en: "Mung bean", bn: "মুগ ডাল" },
  { en: "Chickpea", bn: "ছোলা" },
];

const translations = {
  en: {
    eyebrow: "PLANNING WORKSPACE",
    title: "Crop rotation planner",
    description:
      "Build a seasonal crop sequence and tune the factors that matter to your field.",

    sequenceTitle: "Rotation sequence",
    sequenceDescription:
      "Choose a crop for each season in your proposed sequence.",
    season: "SEASON",
    addSeason: "Add season",
    reset: "Reset",

    prioritiesTitle: "Planning priorities",
    prioritiesDescription:
      "Adjust the relative importance of each consideration.",

    water: "Water efficiency",
    soil: "Soil health",
    risk: "Risk tolerance",

    importance: "Set the importance for this planning scenario.",
    compare: "Compare rotation options",

    prototype:
      "Prototype note: this screen demonstrates the planner controls. Connect the form state to your existing rotation-evaluation API to calculate real candidate scores.",
  },

  bn: {
    eyebrow: "পরিকল্পনা কর্মক্ষেত্র",
    title: "শস্য পর্যায় পরিকল্পনাকারী",
    description:
      "মৌসুমভিত্তিক ফসলের পর্যায় তৈরি করুন এবং আপনার জমির জন্য গুরুত্বপূর্ণ বিষয়গুলোর অগ্রাধিকার নির্ধারণ করুন।",

    sequenceTitle: "শস্য পর্যায়ের তালিকা",
    sequenceDescription:
      "আপনার প্রস্তাবিত শস্য পর্যায়ের প্রতিটি মৌসুমের জন্য একটি ফসল নির্বাচন করুন।",
    season: "মৌসুম",
    addSeason: "মৌসুম যোগ করুন",
    reset: "পুনরায় সেট করুন",

    prioritiesTitle: "পরিকল্পনার অগ্রাধিকার",
    prioritiesDescription: "প্রতিটি বিষয়ের আপেক্ষিক গুরুত্ব নির্ধারণ করুন।",

    water: "পানির দক্ষ ব্যবহার",
    soil: "মাটির স্বাস্থ্য",
    risk: "ঝুঁকি গ্রহণের মাত্রা",

    importance: "এই পরিকল্পনার জন্য বিষয়টির গুরুত্ব নির্ধারণ করুন।",
    compare: "শস্য পর্যায়ের বিকল্প তুলনা করুন",

    prototype:
      "প্রোটোটাইপ নোট: এই পৃষ্ঠায় পরিকল্পনার নিয়ন্ত্রণগুলো প্রদর্শন করা হয়েছে। প্রকৃত প্রার্থী স্কোর গণনার জন্য ফর্মের তথ্য আপনার বিদ্যমান শস্য পর্যায় মূল্যায়ন API-এর সঙ্গে সংযুক্ত করুন।",
  },
};

const PlannerPage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [seasons, setSeasons] = useState(["Aman Rice", "Lentil", "Mung bean"]);

  const [priorities, setPriorities] = useState({
    water: 60,
    soil: 80,
    risk: 65,
  });

  const update = (i, value) =>
    setSeasons((old) => old.map((crop, index) => (index === i ? value : crop)));

  const getCropLabel = (crop) =>
    cropOptions.find((item) => item.en === crop)?.[language] || crop;

  const priorityLabels = {
    water: t.water,
    soil: t.soil,
    risk: t.risk,
  };

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <div className="planner-layout">
        <Card>
          <SectionHeading
            title={t.sequenceTitle}
            description={t.sequenceDescription}
          />

          <div className="season-list">
            {seasons.map((crop, i) => (
              <div className="season-row" key={i}>
                <span className="season-number">0{i + 1}</span>

                <div>
                  <small>
                    {t.season} {i + 1}
                  </small>

                  <select
                    value={crop}
                    onChange={(e) => update(i, e.target.value)}
                  >
                    {cropOptions.map((option) => (
                      <option key={option.en} value={option.en}>
                        {option[language]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="inline-actions">
            <Button
              variant="secondary"
              onClick={() =>
                setSeasons((old) => (old.length < 4 ? [...old, "Wheat"] : old))
              }
              disabled={seasons.length >= 4}
            >
              {t.addSeason}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setSeasons(["Aman Rice", "Lentil", "Mung bean"])}
            >
              <RotateCcw size={15} />
              {t.reset}
            </Button>
          </div>
        </Card>

        <Card>
          <SectionHeading
            title={t.prioritiesTitle}
            description={t.prioritiesDescription}
          />

          <div className="range-list">
            {Object.entries(priorities).map(([key, value]) => (
              <label className="range-item" key={key}>
                <span>
                  <b>{priorityLabels[key]}</b>
                  <strong>{value}%</strong>
                </span>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(e) =>
                    setPriorities({
                      ...priorities,
                      [key]: Number(e.target.value),
                    })
                  }
                />

                <small>{t.importance}</small>
              </label>
            ))}
          </div>

          <Link className="button primary full-button" to="/comparison">
            {t.compare}
            <ArrowRight size={16} />
          </Link>
        </Card>
      </div>

      <p className="helper-note">{t.prototype}</p>
    </>
  );
};

export default PlannerPage;
