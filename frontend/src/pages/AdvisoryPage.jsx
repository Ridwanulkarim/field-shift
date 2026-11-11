import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Copy,
  Info,
  LoaderCircle,
} from "lucide-react";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
import useAxios from "../hooks/useAxios";

const translations = {
  en: {
    eyebrow: "SEASONAL CONTEXT",
    title: "Planting window advisory",
    description:
      "Review district-level planting guidance, evidence, uncertainty, and data provenance.",
    selectTitle: "Select your location and crop",
    selectDescription: "Choose a district and crop to request an advisory.",
    district: "District",
    crop: "Crop",
    selectDistrict: "Select a district",
    selectCrop: "Select a crop",
    getAdvisory: "Get advisory",
    loadingOptions: "Loading districts and crops…",
    loadingAdvisory: "Loading advisory…",
    resultTitle: "Advisory",
    resultDescription:
      "The advisory and supporting information returned by the backend.",
    evidence: "Evidence",
    uncertainty: "Uncertainty",
    limitations: "Limitations",
    provenance: "Data provenance",
    disclaimer: "Disclaimer",
    copy: "Copy advisory",
    copied: "Copied",
    empty: "Select a district and crop to request an advisory.",
    noAdvisory: "The endpoint did not return an advisory sentence.",
    noDetails: "No additional details were returned.",
    optionsError: "Could not load districts or crops.",
    advisoryError: "Could not load the advisory.",
    retry: "Retry",
    usualFrom: "Usual planting window starts",
    usualTo: "Usual planting window ends",
    infoTitle: "Use as evidence-based guidance",
    info: "Advisory results depend on available real climate data and the backend method. They are not a guarantee of weather conditions or crop outcomes.",
  },
  bn: {
    eyebrow: "মৌসুমি প্রেক্ষাপট",
    title: "রোপণের সময়সূচি পরামর্শ",
    description:
      "জেলাভিত্তিক রোপণ পরামর্শ, প্রমাণ, অনিশ্চয়তা এবং ডেটার উৎস পর্যালোচনা করুন।",
    selectTitle: "আপনার অবস্থান ও ফসল নির্বাচন করুন",
    selectDescription: "পরামর্শ পেতে একটি জেলা ও ফসল নির্বাচন করুন।",
    district: "জেলা",
    crop: "ফসল",
    selectDistrict: "জেলা নির্বাচন করুন",
    selectCrop: "ফসল নির্বাচন করুন",
    getAdvisory: "পরামর্শ দেখুন",
    loadingOptions: "জেলা ও ফসল লোড হচ্ছে…",
    loadingAdvisory: "পরামর্শ লোড হচ্ছে…",
    resultTitle: "পরামর্শ",
    resultDescription: "ব্যাকএন্ড থেকে পাওয়া পরামর্শ ও সহায়ক তথ্য।",
    evidence: "প্রমাণ",
    uncertainty: "অনিশ্চয়তা",
    limitations: "সীমাবদ্ধতা",
    provenance: "ডেটার উৎস",
    disclaimer: "দায়মুক্তি",
    copy: "পরামর্শ কপি করুন",
    copied: "কপি হয়েছে",
    empty: "পরামর্শ পেতে একটি জেলা ও ফসল নির্বাচন করুন।",
    noAdvisory: "এন্ডপয়েন্ট থেকে কোনো পরামর্শ বাক্য পাওয়া যায়নি।",
    noDetails: "অতিরিক্ত কোনো বিবরণ পাওয়া যায়নি।",
    optionsError: "জেলা বা ফসল লোড করা যায়নি।",
    advisoryError: "পরামর্শ লোড করা যায়নি।",
    retry: "আবার চেষ্টা করুন",
    usualFrom: "সাধারণত রোপণ শুরু",
    usualTo: "সাধারণত রোপণ শেষ",
    infoTitle: "প্রমাণভিত্তিক নির্দেশনা হিসেবে ব্যবহার করুন",
    info: "পরামর্শের ফলাফল উপলভ্য বাস্তব জলবায়ু তথ্য ও ব্যাকএন্ডের পদ্ধতির ওপর নির্ভর করে। এটি আবহাওয়া বা ফসলের ফলনের নিশ্চয়তা নয়।",
  },
};

const getList = (response, key) => {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
};

const getLocalizedName = (item, language) =>
  language === "bn"
    ? (item.nameBn ?? item.nameEn ?? item.name ?? item.slug ?? "")
    : (item.nameEn ?? item.name ?? item.slug ?? "");

const toDisplayText = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean).join("; ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = toDisplayText(item);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return "";
};

const getAdvisoryText = (advisory, language) => {
  const value =
    advisory?.advisory ??
    advisory?.sentence ??
    advisory?.message ??
    advisory?.summary;

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return value[language] ?? value.text ?? value.en ?? value.bn ?? "";
  }

  return "";
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error?.message ??
  error?.response?.data?.message ??
  error?.message ??
  fallback;

const DetailSection = ({ title, value, emptyText }) => (
  <section className="border-t border-gray-200 pt-4 first:border-0 first:pt-0">
    <h3 className="font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
      {toDisplayText(value) || emptyText}
    </p>
  </section>
);

const AdvisoryPage = () => {
  const { language } = useLanguage();
  const t = translations[language] ?? translations.en;
  const api = useAxios();

  const [districts, setDistricts] = useState([]);
  const [crops, setCrops] = useState([]);
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [usualFrom, setUsualFrom] = useState("");
  const [usualTo, setUsualTo] = useState("");
  const [advisory, setAdvisory] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [advisoryError, setAdvisoryError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedDistrict = useMemo(
    () => districts.find((item) => item.slug === district),
    [districts, district],
  );

  const selectedCrop = useMemo(
    () => crops.find((item) => item.slug === crop),
    [crops, crop],
  );

  const loadOptions = async () => {
    setOptionsLoading(true);
    setOptionsError("");

    try {
      const [districtResponse, cropResponse] = await Promise.all([
        api.get("/districts"),
        api.get("/crops"),
      ]);

      const districtItems = getList(districtResponse, "districts");
      const cropItems = getList(cropResponse, "crops");

      setDistricts(districtItems);
      setCrops(cropItems);
      setDistrict((current) =>
        districtItems.some((item) => item.slug === current)
          ? current
          : (districtItems[0]?.slug ?? ""),
      );
      setCrop((current) =>
        cropItems.some((item) => item.slug === current)
          ? current
          : (cropItems[0]?.slug ?? ""),
      );
    } catch (error) {
      setOptionsError(getErrorMessage(error, t.optionsError));
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
    // Load options when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAdvisory = async () => {
    if (!district || !crop) return;

    setAdvisoryLoading(true);
    setAdvisoryError("");
    setAdvisory(null);

    try {
      const params = new URLSearchParams({
        crop,
        lang: language === "bn" ? "bn" : "en",
      });

      if (usualFrom && usualTo) {
        params.set("usualFrom", usualFrom.slice(5)); // YYYY-MM-DD → MM-DD
        params.set("usualTo", usualTo.slice(5));
      }

      const response = await api.get(
        `/districts/${encodeURIComponent(district)}/advisory?${params.toString()}`,
      );

      setAdvisory(response?.data ?? response);
    } catch (error) {
      setAdvisoryError(getErrorMessage(error, t.advisoryError));
    } finally {
      setAdvisoryLoading(false);
    }
  };

  const advisorySentence = getAdvisoryText(
    advisory,
    language === "bn" ? "bn" : "en",
  );

  const copyAdvisory = async () => {
    const text = toDisplayText(advisorySentence);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const clearResult = () => {
    setAdvisory(null);
    setAdvisoryError("");
    setCopied(false);
  };

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title={t.selectTitle}
            description={t.selectDescription}
          />

          {optionsLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <LoaderCircle className="animate-spin" size={17} />
              {t.loadingOptions}
            </p>
          ) : (
            <>
              {optionsError ? (
                <div
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={17} />
                    <span>{optionsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadOptions}
                    className="mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
                  >
                    {t.retry}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t.district}
                      <select
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                        value={district}
                        onChange={(event) => {
                          setDistrict(event.target.value);
                          clearResult();
                        }}
                        disabled={districts.length === 0}
                      >
                        <option value="">{t.selectDistrict}</option>
                        {districts.map((item) => (
                          <option key={item.slug} value={item.slug}>
                            {getLocalizedName(item, language)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      {t.crop}
                      <select
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                        value={crop}
                        onChange={(event) => {
                          setCrop(event.target.value);
                          clearResult();
                        }}
                        disabled={crops.length === 0}
                      >
                        <option value="">{t.selectCrop}</option>
                        {crops.map((item) => (
                          <option key={item.slug} value={item.slug}>
                            {getLocalizedName(item, language)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t.usualFrom}
                      <input
                        type="date"
                        value={usualFrom}
                        onChange={(event) => {
                          setUsualFrom(event.target.value);
                          clearResult();
                        }}
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                      />
                    </label>
                    <label className="block text-sm font-medium text-gray-700">
                      {t.usualTo}
                      <input
                        type="date"
                        value={usualTo}
                        onChange={(event) => {
                          setUsualTo(event.target.value);
                          clearResult();
                        }}
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                      />
                    </label>
                  </div>

                  {usualFrom && usualTo && usualFrom > usualTo && (
                    <p className="mt-2 text-sm text-red-700" role="alert">
                      The start date must be before the end date.
                    </p>
                  )}

                  <div className="mt-5">
                    <Button
                      onClick={requestAdvisory}
                      disabled={
                        !district ||
                        !crop ||
                        advisoryLoading ||
                        (usualFrom && usualTo && usualFrom > usualTo)
                      }
                    >
                      {advisoryLoading ? t.loadingAdvisory : t.getAdvisory}
                    </Button>
                  </div>

                  {selectedDistrict && selectedCrop && (
                    <div className="mt-5 flex items-start gap-3 rounded-xl bg-green-50 p-4">
                      <CalendarDays
                        className="mt-0.5 shrink-0 text-green-700"
                        size={20}
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {getLocalizedName(selectedCrop, language)} ·{" "}
                          {getLocalizedName(selectedDistrict, language)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {t.resultDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Card>

        <Card>
          <SectionHeading
            title={t.resultTitle}
            description={t.resultDescription}
          />

          {advisoryLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <LoaderCircle className="animate-spin" size={17} />
              {t.loadingAdvisory}
            </p>
          ) : advisoryError ? (
            <div
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} />
                <span>{advisoryError}</span>
              </div>
              <button
                type="button"
                onClick={requestAdvisory}
                className="mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
              >
                {t.retry}
              </button>
            </div>
          ) : advisory ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
                    {toDisplayText(advisorySentence) || t.noAdvisory}
                  </p>
                  {advisorySentence && (
                    <button
                      type="button"
                      onClick={copyAdvisory}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Copy size={14} />
                      {copied ? t.copied : t.copy}
                    </button>
                  )}
                </div>
              </div>

              <DetailSection
                title={t.evidence}
                value={advisory.evidence}
                emptyText={t.noDetails}
              />
              <DetailSection
                title={t.uncertainty}
                value={advisory.uncertainty}
                emptyText={t.noDetails}
              />
              <DetailSection
                title={t.limitations}
                value={advisory.limitations}
                emptyText={t.noDetails}
              />
              <DetailSection
                title={t.provenance}
                value={advisory.provenance}
                emptyText={t.noDetails}
              />
              <DetailSection
                title={t.disclaimer}
                value={advisory.disclaimer}
                emptyText={t.noDetails}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">{t.empty}</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <Info className="mt-0.5 shrink-0" size={19} />
          <div>
            <h3 className="font-semibold">{t.infoTitle}</h3>
            <p className="mt-1 text-sm leading-6">{t.info}</p>
          </div>
        </div>
      </Card>
    </>
  );
};

export default AdvisoryPage;
