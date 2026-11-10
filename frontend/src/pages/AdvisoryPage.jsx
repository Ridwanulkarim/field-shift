import { useState } from "react";
import { Copy, CalendarDays, Info } from "lucide-react";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";


const districts = [
  { en: "Rajshahi", bn: "রাজশাহী" },
  { en: "Dinajpur", bn: "দিনাজপুর" },
  { en: "Mymensingh", bn: "ময়মনসিংহ" },
  { en: "Jessore", bn: "যশোর" },
  { en: "Satkhira", bn: "সাতক্ষীরা" },
];

const crops = [
  { en: "Aman Rice", bn: "আমন ধান" },
  { en: "Aus Rice", bn: "আউশ ধান" },
  { en: "Boro Rice", bn: "বোরো ধান" },
  { en: "Wheat", bn: "গম" },
  { en: "Chickpea", bn: "ছোলা" },
];

const translations = {
  en: {
    eyebrow: "SEASONAL CONTEXT",
    title: "Planting window advisory",
    description:
      "Explore planting-window analysis by district and crop, including sensitivity and method details.",
    selectTitle: "Select your location and crop",
    selectDescription:
      "Choose a district and crop to inspect the advisory context.",
    district: "District",
    crop: "Crop",
    update: "Update advisory preview",
    preview: "PLANTING WINDOW PREVIEW",
    previewDescription:
      "Review the locally relevant planting window and its uncertainty before making a decision.",
    smsTitle: "SMS-ready summary",
    smsDescription: "Keep the message concise for sharing.",
    copied: "Copied",
    copy: "Copy SMS",
    methodTitle: "Method and sensitivity",
    methodDescription: "Interpret the advisory with its assumptions visible.",
    info: "Planting-window outputs are analytical guidance, not a guarantee of weather conditions or crop outcomes. Sensitivity to input data and method assumptions should be reviewed.",
    audit: [
      "District and crop selection",
      "Input data coverage",
      "Method assumptions",
      "Uncertainty disclosure",
    ],
    sms: (crop, district) =>
      `Field Shift: Review the planting window for ${crop} in ${district}. Check local field conditions and updated guidance before planting.`,
  },

  bn: {
    eyebrow: "মৌসুমি প্রেক্ষাপট",
    title: "ফসল রোপণের সময়সূচি পরামর্শ",
    description:
      "জেলা ও ফসল অনুযায়ী রোপণের সময় বিশ্লেষণ, সংবেদনশীলতা এবং পদ্ধতির বিস্তারিত দেখুন।",
    selectTitle: "আপনার অবস্থান ও ফসল নির্বাচন করুন",
    selectDescription:
      "পরামর্শের প্রেক্ষাপট দেখতে একটি জেলা ও ফসল নির্বাচন করুন।",
    district: "জেলা",
    crop: "ফসল",
    update: "পরামর্শ আপডেট করুন",
    preview: "রোপণের সময়সূচির প্রিভিউ",
    previewDescription:
      "সিদ্ধান্ত নেওয়ার আগে স্থানীয় রোপণের উপযুক্ত সময় ও এর অনিশ্চয়তা পর্যালোচনা করুন।",
    smsTitle: "এসএমএসের জন্য প্রস্তুত বার্তা",
    smsDescription: "শেয়ার করার জন্য বার্তাটি সংক্ষিপ্ত রাখুন।",
    copied: "কপি হয়েছে",
    copy: "এসএমএস কপি করুন",
    methodTitle: "পদ্ধতি ও সংবেদনশীলতা",
    methodDescription: "অনুমান ও শর্তাবলি বিবেচনা করে পরামর্শটি ব্যাখ্যা করুন।",
    info: "রোপণের সময়সূচির ফলাফল বিশ্লেষণভিত্তিক নির্দেশনা, আবহাওয়া বা ফসলের ফলনের নিশ্চয়তা নয়। ইনপুট ডেটা এবং পদ্ধতিগত অনুমানের সংবেদনশীলতা পর্যালোচনা করা উচিত।",
    audit: [
      "জেলা ও ফসল নির্বাচন",
      "ইনপুট ডেটার পরিধি",
      "পদ্ধতিগত অনুমান",
      "অনিশ্চয়তার বিবরণ",
    ],
    sms: (crop, district) =>
      `ফিল্ড শিফট: ${district} জেলায় ${crop} রোপণের উপযুক্ত সময় পর্যালোচনা করুন। রোপণের আগে স্থানীয় জমির অবস্থা ও হালনাগাদ পরামর্শ যাচাই করুন।`,
  },
};

const AdvisoryPage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [district, setDistrict] = useState("Rajshahi");
  const [crop, setCrop] = useState("Aman Rice");

  const [sms, setSms] = useState(translations.en.sms("Aman Rice", "Rajshahi"));

  const [copied, setCopied] = useState(false);

  const getDistrict = (value) =>
    districts.find((x) => x.en === value)?.[language] || value;

  const getCrop = (value) =>
    crops.find((x) => x.en === value)?.[language] || value;

  const updateAdvisory = () => {
    setSms(t.sms(getCrop(crop), getDistrict(district)));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sms);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <div className="advisory-layout">
        <Card>
          <SectionHeading
            title={t.selectTitle}
            description={t.selectDescription}
          />

          <div className="form-grid">
            <label>
              {t.district}
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {districts.map((x) => (
                  <option key={x.en} value={x.en}>
                    {x[language]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t.crop}
              <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                {crops.map((x) => (
                  <option key={x.en} value={x.en}>
                    {x[language]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Button className="advisory-submit" onClick={updateAdvisory}>
            {t.update}
          </Button>

          <div className="window-result">
            <div className="window-icon">
              <CalendarDays />
            </div>

            <div>
              <small>{t.preview}</small>
              <h3>
                {getCrop(crop)} · {getDistrict(district)}
              </h3>
              <p>{t.previewDescription}</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeading title={t.smsTitle} description={t.smsDescription} />

          <textarea
            className="sms-box"
            maxLength={160}
            value={sms}
            onChange={(e) => setSms(e.target.value)}
          />

          <div className="sms-footer">
            <span>{sms.length}/160 characters</span>

            <Button variant="secondary" onClick={copy}>
              <Copy size={15} />
              {copied ? t.copied : t.copy}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="method-card">
        <SectionHeading
          title={t.methodTitle}
          description={t.methodDescription}
        />

        <div className="info-banner">
          <Info size={18} />
          <p>{t.info}</p>
        </div>

        <div className="audit-items">
          {t.audit.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </Card>
    </>
  );
};

export default AdvisoryPage;
