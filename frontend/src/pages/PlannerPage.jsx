import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router";
import useAxios from "../hooks/useAxios";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";

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
    water: "Water saving",
    heat: "Heat resilience",
    soil: "Soil health",
    diversification: "Crop diversification",
    lowInput: "Low input cost",
    risk: "Risk tolerance",
    importance: "Set the importance for this planning scenario.",
    district: "District",
    selectDistrict: "Select a district",
    salinity: "Salinity",
    drainage: "Drainage",
    irrigation: "Irrigation",
    compare: "Compare rotation options",
    loading: "Loading planning options…",
    submitting: "Evaluating…",
    loadError: "Could not load crops, districts, or planning options.",
    evaluateError:
      "Could not evaluate this rotation. Check your selections and try again.",
    noCrops: "No crops were returned by the API.",
  },
  bn: {
    eyebrow: "পরিকল্পনা কর্মক্ষেত্র",
    title: "শস্য পর্যায় পরিকল্পনাকারী",
    description:
      "মৌসুমভিত্তিক ফসলের পর্যায় তৈরি করুন এবং আপনার জমির জন্য গুরুত্বপূর্ণ বিষয়গুলোর অগ্রাধিকার নির্ধারণ করুন।",
    sequenceTitle: "শস্য পর্যায়ের তালিকা",
    sequenceDescription:
      "প্রস্তাবিত পর্যায়ের প্রতিটি মৌসুমের জন্য একটি ফসল নির্বাচন করুন।",
    season: "মৌসুম",
    addSeason: "মৌসুম যোগ করুন",
    reset: "পুনরায় সেট করুন",
    prioritiesTitle: "পরিকল্পনার অগ্রাধিকার",
    prioritiesDescription: "প্রতিটি বিষয়ের আপেক্ষিক গুরুত্ব নির্ধারণ করুন।",
    water: "পানি সাশ্রয়",
    heat: "তাপ সহনশীলতা",
    soil: "মাটির স্বাস্থ্য",
    diversification: "শস্যের বৈচিত্র্য",
    lowInput: "কম উপকরণ খরচ",
    risk: "ঝুঁকি গ্রহণের মাত্রা",
    importance: "এই পরিকল্পনার জন্য বিষয়টির গুরুত্ব নির্ধারণ করুন।",
    district: "জেলা",
    selectDistrict: "জেলা নির্বাচন করুন",
    salinity: "লবণাক্ততা",
    drainage: "পানি নিষ্কাশন",
    irrigation: "সেচ",
    compare: "শস্য পর্যায়ের বিকল্প তুলনা করুন",
    loading: "পরিকল্পনার তথ্য লোড হচ্ছে…",
    submitting: "মূল্যায়ন হচ্ছে…",
    loadError: "ফসল, জেলা বা পরিকল্পনার তথ্য লোড করা যায়নি।",
    evaluateError:
      "শস্য পর্যায় মূল্যায়ন করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।",
    noCrops: "API থেকে কোনো ফসল পাওয়া যায়নি।",
  },
};

const fallbackMeta = {
  salinity: ["none", "slight", "moderate", "high"],
  drainage: ["good", "moderate", "poor"],
  irrigation: ["none", "limited", "reliable"],
};

function getDistrictSlug(district) {
  return district.slug ?? district.code ?? "";
}

function getDistrictLabel(district, language) {
  if (language === "bn") {
    return district.nameBn || district.nameEn || district.name || district.slug;
  }
  return district.nameEn || district.name || district.slug;
}

/*
 * Adjust this helper if your actual /api/meta response uses another shape.
 * It supports common forms such as:
 *   { salinity: ["low", "moderate", "high"] }
 *   { options: { salinity: [...] } }
 */
function getMetaOptions(meta, key) {
  const value = meta?.[key] ?? meta?.options?.[key];

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : (item.value ?? item.slug ?? item.name),
      )
      .filter(Boolean);
  }

  return fallbackMeta[key];
}

export default function PlannerPage() {
  const axios = useAxios();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [crops, setCrops] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [meta, setMeta] = useState({});
  const [district, setDistrict] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [soil, setSoil] = useState({
    salinity: "none",
    drainage: "moderate",
  });
  const [irrigation, setIrrigation] = useState("limited");
  const [priorities, setPriorities] = useState({
    waterSaving: 1,
    heatResilience: 1,
    soilHealth: 1,
    diversification: 1,
    lowInput: 1,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoading(true);
      setError("");

      try {
        const [cropsResponse, districtsResponse, metaResponse] =
          await Promise.all([
            axios.get("/crops"),
            axios.get("/districts"),
            axios.get("/meta"),
          ]);

        if (!active) return;

        const cropList = cropsResponse.data.crops ?? [];
        const districtList = districtsResponse.data.districts ?? [];

        setCrops(cropList);
        setDistricts(districtList);
        setMeta(metaResponse.data ?? {});

        if (districtList.length) {
          setDistrict(getDistrictSlug(districtList[0]));
        }

        // Use actual crop slugs from the API, not hardcoded display names.
        setSeasons(cropList.slice(0, 3).map((crop) => crop.slug));
      } catch (err) {
        if (active) {
          setError(err.response?.data?.error?.message || t.loadError);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, [axios, t.loadError]);

  const salinityOptions = useMemo(
    () => getMetaOptions(meta, "salinity"),
    [meta],
  );
  const drainageOptions = useMemo(
    () => getMetaOptions(meta, "drainage"),
    [meta],
  );
  const irrigationOptions = useMemo(
    () => getMetaOptions(meta, "irrigation"),
    [meta],
  );

  const cropLabel = (crop) =>
    language === "bn"
      ? crop.nameBn || crop.nameEn || crop.slug
      : crop.nameEn || crop.slug;

  const changeSeason = (index, value) => {
    setSeasons((current) =>
      current.map((crop, i) => (i === index ? value : crop)),
    );
  };

  const reset = () => {
    setSeasons(crops.slice(0, 3).map((crop) => crop.slug));
    setPriorities({
      waterSaving: 1,
      heatResilience: 1,
      soilHealth: 1,
      diversification: 1,
      lowInput: 1,
    });
    setSoil({
      salinity: "none",
      drainage: "moderate",
    });
    setIrrigation("limited");
    setError("");
  };

  const evaluate = async (event) => {
    event.preventDefault();
    setError("");

    if (!district || seasons.length === 0 || seasons.some((slug) => !slug)) {
      setError(t.evaluateError);
      return;
    }

    const payload = {
      district,
      existingRotation: seasons,
      soil,
      irrigation,
      priorities,
      constraints: {},
    };

    setSubmitting(true);
    console.log("SUBMITTED PAYLOAD:", JSON.stringify(payload, null, 2));
    try {
      const response = await axios.post("/evaluate", payload);

      // ComparisonPage can read this with useLocation().state.result.
      navigate("/comparison", {
        state: {
          result: response.data,
          payload,
        },
      });
    } catch (err) {
      console.error("Evaluation status:", err.response?.status);
      console.log(
        "BACKEND ERROR:",
        JSON.stringify(err.response?.data, null, 2),
      );
      console.error("Submitted payload:", payload);

      const details = err.response?.data?.error?.details;

      const detailMessage = Array.isArray(details)
        ? details.map((item) => `${item.field}: ${item.message}`).join(" | ")
        : "";

      setError(
        detailMessage || err.response?.data?.error?.message || t.evaluateError,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const priorityLabels = {
    waterSaving: t.water,
    heatResilience: t.heat,
    soilHealth: t.soil,
    diversification: t.diversification,
    lowInput: t.lowInput,
  };

  if (loading) {
    return <p className="py-10 text-center text-slate-600">{t.loading}</p>;
  }

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {crops.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-4 text-amber-800">{t.noCrops}</p>
      ) : (
        <form onSubmit={evaluate}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionHeading
                title={t.sequenceTitle}
                description={t.sequenceDescription}
              />

              <label className="mb-5 block text-sm font-medium text-slate-700">
                {t.district}
                <select
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                >
                  <option value="">{t.selectDistrict}</option>
                  {districts.map((item) => {
                    const slug = getDistrictSlug(item);
                    return (
                      <option key={slug} value={slug}>
                        {getDistrictLabel(item, language)}
                      </option>
                    );
                  })}
                </select>
              </label>

              <div className="space-y-3">
                {seasons.map((cropSlug, index) => (
                  <label
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    key={index}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-semibold text-green-800">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                        {t.season} {index + 1}
                      </span>
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-2"
                        value={cropSlug}
                        onChange={(event) =>
                          changeSeason(index, event.target.value)
                        }
                      >
                        {crops.map((crop) => (
                          <option key={crop.slug} value={crop.slug}>
                            {cropLabel(crop)}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setSeasons((current) => {
                      const nextCrop = crops.find(
                        (crop) => !current.includes(crop.slug),
                      );

                      return current.length < 3 && nextCrop
                        ? [...current, nextCrop.slug]
                        : current;
                    })
                  }
                  disabled={
                    seasons.length >= 3 ||
                    !crops.some((crop) => !seasons.includes(crop.slug))
                  }
                >
                  {t.addSeason}
                </Button>

                <Button type="button" variant="ghost" onClick={reset}>
                  <RotateCcw size={15} />
                  {t.reset}
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeading
                title={t.prioritiesTitle}
                description={t.prioritiesDescription}
              />

              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  {t.salinity}
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={soil.salinity}
                    onChange={(event) =>
                      setSoil({ ...soil, salinity: event.target.value })
                    }
                  >
                    {salinityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  {t.drainage}
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={soil.drainage}
                    onChange={(event) =>
                      setSoil({ ...soil, drainage: event.target.value })
                    }
                  >
                    {drainageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  {t.irrigation}
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={irrigation}
                    onChange={(event) => setIrrigation(event.target.value)}
                  >
                    {irrigationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-5">
                {Object.entries(priorities).map(([key, value]) => (
                  <label className="block" key={key}>
                    <span className="mb-2 flex justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">
                        {priorityLabels[key]}
                      </span>
                      <span className="text-slate-600">{value}</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={value}
                      className="w-full accent-green-700"
                      onChange={(event) =>
                        setPriorities((current) => ({
                          ...current,
                          [key]: Number(event.target.value),
                        }))
                      }
                    />
                    <span className="text-xs text-slate-500">
                      {t.importance}
                    </span>
                  </label>
                ))}
              </div>

              <Button
                type="submit"
                disabled={submitting || !district}
                className="mt-6 w-full"
              >
                {submitting ? t.submitting : t.compare}
                {!submitting && <ArrowRight size={16} />}
              </Button>
            </Card>
          </div>
        </form>
      )}
    </>
  );
}
