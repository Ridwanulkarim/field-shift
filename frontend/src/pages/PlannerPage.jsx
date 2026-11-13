import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { useNavigate } from "react-router";
import useAxios from "../hooks/useAxios";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
import { useSelection } from "../layouts/context/SelectionContext";
import { friendlyError } from "../utils/friendlyError";
import { digits, fmtNum } from "../utils/i18n";

const translations = {
  en: {
    eyebrow: "PLANNING WORKSPACE",
    title: "Crop rotation planner",
    description:
      "Build a seasonal crop sequence and tune the factors that matter to your field.",
    sequenceTitle: "Rotation crops",
    sequenceDescription:
      "Choose one, two or three crops. After you pick a crop, the other lists only show crops that can share the same year with it.",
    season: "CROP",
    addSeason: "Add crop",
    removeCrop: "Remove",
    noMoreCompatible: "No other crop fits in the same year as your selection.",
    maxCropsReached: "A rotation can hold at most three crops.",
    droppedNotice: "Removed because it cannot share a year with your new choice:",
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
    fineTune: "Fine-tune (optional)",
    fineTuneHelp: "Soil, irrigation and what matters most to you. The defaults work for a first look.",
    priorityWords: ["Ignore", "Normal", "Important", "Very important"],
    options: {
      salinity: { none: "None or very low", slight: "Slight", moderate: "Moderate", high: "High" },
      drainage: { good: "Drains well", moderate: "Drains moderately", poor: "Water stays after rain" },
      irrigation: { none: "None (rain only)", limited: "Some (pump or canal, not always)", reliable: "Reliable" },
    },
  },
  bn: {
    eyebrow: "পরিকল্পনা কর্মক্ষেত্র",
    title: "শস্য পর্যায় পরিকল্পনাকারী",
    description:
      "মৌসুমভিত্তিক ফসলের পর্যায় তৈরি করুন এবং আপনার জমির জন্য গুরুত্বপূর্ণ বিষয়গুলোর অগ্রাধিকার নির্ধারণ করুন।",
    sequenceTitle: "পর্যায়ের ফসল",
    sequenceDescription:
      "এক, দুই বা তিনটি ফসল নির্বাচন করুন। একটি ফসল বাছাই করলে বাকি তালিকায় কেবল সেই ফসলের সাথে একই বছরে চাষযোগ্য ফসল দেখাবে।",
    season: "ফসল",
    addSeason: "ফসল যোগ করুন",
    removeCrop: "সরান",
    noMoreCompatible: "আপনার নির্বাচনের সাথে একই বছরে চাষ করা যায় এমন আর কোনো ফসল নেই।",
    maxCropsReached: "একটি পর্যায়ে সর্বোচ্চ তিনটি ফসল থাকতে পারে।",
    droppedNotice: "নতুন নির্বাচনের সাথে একই বছরে চাষ করা যায় না, তাই সরানো হয়েছে:",
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
    fineTune: "সূক্ষ্ম সমন্বয় (ঐচ্ছিক)",
    fineTuneHelp: "মাটি, সেচ এবং আপনার কাছে কোনটি বেশি গুরুত্বপূর্ণ। প্রথম দেখার জন্য ডিফল্টই যথেষ্ট।",
    priorityWords: ["গুরুত্ব নেই", "সাধারণ", "গুরুত্বপূর্ণ", "অত্যন্ত গুরুত্বপূর্ণ"],
    options: {
      salinity: { none: "নেই বা খুব কম", slight: "সামান্য", moderate: "মাঝারি", high: "বেশি" },
      drainage: { good: "পানি ভালো নামে", moderate: "মোটামুটি নামে", poor: "বৃষ্টির পর পানি জমে থাকে" },
      irrigation: { none: "নেই (শুধু বৃষ্টি)", limited: "কিছু (পাম্প বা খাল, সবসময় নয়)", reliable: "নির্ভরযোগ্য" },
    },
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
  const lang = language === "bn" ? "bn" : "en";
  const t = translations[lang];
  const selection = useSelection();

  const [crops, setCrops] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [meta, setMeta] = useState({});
  // { cropSlug: [slugs that can share a year with it] }, computed by the backend rotation rules.
  const [compat, setCompat] = useState({});
  const [maxCrops, setMaxCrops] = useState(3);
  // The "removed because it cannot share a year" notice is kept as the dropped crop slugs and written at render time,
  // so it changes language with the page.
  const [droppedSlugs, setDroppedSlugs] = useState([]);
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
  // Kept as data ({ err, fallback } or { key }) and turned into text at render, so it follows the language switch.
  const [errorState, setErrorState] = useState(null);
  const setError = (value) => setErrorState(value || null);
  const error = !errorState
    ? ""
    : errorState.key
      ? t[errorState.key]
      : friendlyError(errorState.err, lang, t[errorState.fallback]);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoading(true);
      setError(null);

      try {
        const [
          cropsResponse,
          districtsResponse,
          metaResponse,
          compatResponse,
        ] = await Promise.all([
          axios.get("/crops"),
          axios.get("/districts"),
          axios.get("/meta"),
          axios.get("/crops/compatibility"),
        ]);

        if (!active) return;

        const cropList = cropsResponse.data.crops ?? [];
        const districtList = districtsResponse.data.districts ?? [];

        setCrops(cropList);
        setDistricts(districtList);
        setMeta(metaResponse.data ?? {});
        setCompat(compatResponse.data?.compatible ?? {});
        setMaxCrops(compatResponse.data?.maxCrops ?? 3);

        // Remembered choice first, then Rajshahi (the demo district), then the first in the list.
        const remembered = districtList.find((d) => getDistrictSlug(d) === selection.district);
        const fallback = districtList.find((d) => getDistrictSlug(d) === "rajshahi") ?? districtList[0];
        if (remembered || fallback) setDistrict(getDistrictSlug(remembered ?? fallback));

        // Start with one crop; the farmer adds a second or third from the compatible ones.
        const startCrop = cropList.find((c) => c.slug === selection.crop) ?? cropList[0];
        setSeasons(startCrop ? [startCrop.slug] : []);
      } catch (err) {
        if (active) {
          setError({ err, fallback: "loadError" });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, [axios]);

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

  const optionLabel = (group, option) => t.options?.[group]?.[option] ?? option;

  const cropLabel = (crop) =>
    language === "bn"
      ? crop.nameBn || crop.nameEn || crop.slug
      : crop.nameEn || crop.slug;

  // Crops that can share a year with every crop in `others`.
  const compatibleWith = (others) =>
    crops.filter(
      (crop) =>
        !others.includes(crop.slug) &&
        others.every((slug) => compat[slug]?.includes(crop.slug)),
    );

  // Options for one slot: its own crop plus anything compatible with the OTHER selected crops.
  const optionsFor = (index) => {
    const others = seasons.filter((_, i) => i !== index);
    const allowed = new Set(compatibleWith(others).map((crop) => crop.slug));
    return crops.filter(
      (crop) => crop.slug === seasons[index] || allowed.has(crop.slug),
    );
  };

  const changeSeason = (index, value) => {
    // Changing a crop can make another selected crop ineligible; drop those instead of keeping an invalid rotation.
    const kept = [];
    const dropped = [];
    seasons.forEach((slug, i) => {
      if (i === index) kept.push(value);
      else if (compat[value]?.includes(slug)) kept.push(slug);
      else dropped.push(slug);
    });
    setSeasons(kept);
    setDroppedSlugs(dropped);
  };

  const addCrop = () => {
    const next = compatibleWith(seasons)[0];
    if (seasons.length < maxCrops && next) {
      setSeasons([...seasons, next.slug]);
      setDroppedSlugs([]);
    }
  };

  const removeCrop = (index) => {
    setSeasons((current) => current.filter((_, i) => i !== index));
    setDroppedSlugs([]);
  };

  const canAdd = seasons.length < maxCrops && compatibleWith(seasons).length > 0;

  const reset = () => {
    setSeasons(crops.slice(0, 1).map((crop) => crop.slug));
    setDroppedSlugs([]);
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
    setError(null);
  };

  const evaluate = async (event) => {
    event.preventDefault();
    setError(null);

    if (
      !district ||
      seasons.length < 1 ||
      seasons.length > maxCrops ||
      seasons.some((slug) => !slug)
    ) {
      setError({ key: "evaluateError" });
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

    try {
      const response = await axios.post("/evaluate", payload);

      const result = response.data?.data ?? response.data;

      selection.update({ district });
      sessionStorage.setItem(
        "rotationEvaluation",
        JSON.stringify({
          result,
          payload,
        }),
      );

      navigate("/comparison", {
        state: {
          result,
          payload,
        },
      });
    } catch (err) {
      setError({ err, fallback: "evaluateError" });
    } finally {
      setSubmitting(false);
    }
  };

  const notice = droppedSlugs.length
    ? `${t.droppedNotice} ${droppedSlugs
        .map((slug) => cropLabel(crops.find((c) => c.slug === slug) ?? { slug }))
        .join(lang === "bn" ? "، " : ", ")}`
    : "";

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
                  onChange={(event) => {
                    setDistrict(event.target.value);
                    selection.update({ district: event.target.value });
                  }}
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
                      {digits(String(index + 1).padStart(2, "0"), lang)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                        {t.season} {fmtNum(index + 1, lang)}
                      </span>
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-2"
                        value={cropSlug}
                        onChange={(event) => {
                          changeSeason(index, event.target.value);
                          if (index === 0) selection.update({ crop: event.target.value });
                        }}
                      >
                        {optionsFor(index).map((crop) => (
                          <option key={crop.slug} value={crop.slug}>
                            {cropLabel(crop)}
                          </option>
                        ))}
                      </select>
                    </span>
                    {seasons.length > 1 && (
                      <button
                        type="button"
                        aria-label={`${t.removeCrop} ${t.season} ${fmtNum(index + 1, lang)}`}
                        title={t.removeCrop}
                        className="shrink-0 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        onClick={() => removeCrop(index)}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </label>
                ))}
              </div>

              {notice && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">
                  {notice}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCrop}
                  disabled={!canAdd}
                >
                  {t.addSeason}
                </Button>

                <Button type="button" variant="ghost" onClick={reset}>
                  <RotateCcw size={15} />
                  {t.reset}
                </Button>
              </div>

              {!canAdd && (
                <p className="mt-2 text-xs text-slate-500">
                  {seasons.length >= maxCrops
                    ? t.maxCropsReached
                    : t.noMoreCompatible}
                </p>
              )}
            </Card>

            <Card className="p-5">
              <details>
              <summary className="cursor-pointer">
                <span className="text-lg font-semibold text-slate-900">{t.fineTune}</span>
                <span className="mt-1 block text-sm text-slate-600">{t.fineTuneHelp}</span>
              </summary>

              <div className="mt-5 mb-5 grid gap-4 sm:grid-cols-2">
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
                        {optionLabel("salinity", option)}
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
                        {optionLabel("drainage", option)}
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
                        {optionLabel("irrigation", option)}
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
                      <span className="text-slate-600">{t.priorityWords[value] ?? value}</span>
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
              </details>

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
