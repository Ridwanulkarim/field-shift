import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Copy,
  Info,
  LoaderCircle,
  Printer,
} from "lucide-react";
import { PageHeading, Card, SectionHeading } from "../components/UI";
import OnsetChart from "../components/OnsetChart";
import { useLanguage } from "../layouts/context/LanguageContext";
import useAxios from "../hooks/useAxios";

const MAX_WINDOW_DAYS = 120; // same limit as the backend (MAX_USUAL_WINDOW_DAYS)
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // the analysis uses a 365-day year

const translations = {
  en: {
    eyebrow: "SEASONAL CONTEXT",
    title: "Planting window advisory",
    description:
      "See whether the start of usable rain has moved over the last 25 years, and what that means for your planting dates.",
    selectTitle: "Your location and crop",
    selectDescription: "The advisory updates as soon as you change a choice.",
    district: "District",
    crop: "Crop",
    experimental: "experimental",
    usualTitle: "Your usual transplanting window (optional)",
    usualHelp: "Add your usual dates to see them moved by the supported shift.",
    from: "From",
    to: "To",
    month: "Month",
    day: "Day",
    clear: "Clear dates",
    orderError: "The start date must not be after the end date.",
    longError: `The window can be at most ${MAX_WINDOW_DAYS} days long.`,
    loadingOptions: "Loading districts and crops…",
    loadingAdvisory: "Updating advisory…",
    optionsError: "Could not load districts or crops.",
    advisoryError: "Could not load the advisory.",
    retry: "Retry",
    empty: "Choose a district and crop.",
    resultTitle: "Advice for you",
    decision: {
      no_change: "Keep your usual planting time",
      weak: "No reliable change found: keep your usual time",
      saturated: "Cannot tell: keep your usual time",
      insufficient_data: "Not enough data to advise",
      not_applicable: "No advice for this crop",
      delay: (n) => `Move planting about ${n} days later`,
      advance: (n) => `Move planting about ${n} days earlier`,
    },
    confidence: {
      supported: "Clear change",
      weak: "Not reliable",
      none: "No clear change",
      not_applicable: "Not applicable",
    },
    windowTitle: "Your planting window",
    usualLabel: "Your usual",
    suggestedLabel: "Suggested",
    unchanged: "unchanged",
    windowHint: "Enter your usual dates to see them moved.",
    copySentence: "Copy advice",
    copySms: "Copy SMS text",
    copied: "Copied",
    print: "Print",
    smsInfo: (len, seg) => `SMS text: ${len} characters, ${seg} message${seg > 1 ? "s" : ""}`,
    bnDraft:
      "The Bangla text is a draft that a native speaker has not yet reviewed.",
    experimentalTitle: "Experimental result",
    chartTitle: "When usable rain started, year by year",
    chartIntro:
      "Each dot is one year. The shaded band covers the middle half of the years; the dashed line is the median.",
    early: (p) => `${p.from}–${p.to} · ${p.years} years`,
    late: (p) => `${p.from}–${p.to} · ${p.years} years`,
    median: "median",
    censoredNote: (n) =>
      `${n} year${n > 1 ? "s" : ""} had no usable rain by the end of the search season and ${n > 1 ? "are" : "is"} not plotted.`,
    numbersTitle: "Show the numbers",
    colPeriod: "Period",
    colYears: "Years",
    colFound: "Start found",
    colNone: "No usable rain by season end",
    colUnknown: "Not enough data",
    colRange: "Middle half of years",
    colMedian: "Median start",
    certaintyTitle: "How sure is this?",
    estimate: (est, lo, hi) =>
      `Best estimate of the shift: ${est} days. The data cannot rule out anything from ${lo} to ${hi} days (minus = earlier, plus = later).`,
    meaning: {
      supported: "A shift was found and most alternative definitions of “usable rain” agree.",
      weak: "Something was seen, but it depends on how “usable rain” is defined, so no change in planting time is advised.",
      none: "No change could be told apart from normal year-to-year variation. This does not mean nothing changed.",
      not_applicable: "No rain-start rule is defined for this crop.",
    },
    agreement: (a, b) =>
      `${a} of ${b} alternative definitions of “usable rain” give the same answer.`,
    limitsTitle: "Limits to keep in mind",
    englishOnly: "(shown in English)",
    provenanceTitle: "Where the data comes from",
    source: "Source",
    retrieved: "Retrieved",
    dataThrough: "Data through",
    latestObs: (d, ago) => `Latest observation ${d}${ago != null ? ` (${ago} days ago)` : ""}`,
    storedNote: "Stored NASA POWER data, not a live query.",
    syntheticNote: "SYNTHETIC test data, not real observations.",
    offlineNote: "Served from a committed offline file.",
    gridNote: "Values describe a grid cell of roughly 0.5 degrees, not one farm.",
    infoTitle: "Use as evidence-based guidance",
    info: "This is decision support, not a forecast. It compares when usable rain started in earlier and later years and does not guarantee weather or crop outcomes. Please check with your local agricultural extension officer.",
  },
  bn: {
    eyebrow: "মৌসুমি প্রেক্ষাপট",
    title: "রোপণের সময়সূচি পরামর্শ",
    description:
      "গত ২৫ বছরে কার্যকর বৃষ্টি শুরুর সময় সরেছে কি না এবং তাতে আপনার রোপণের তারিখে কী প্রভাব পড়ে তা দেখুন।",
    selectTitle: "আপনার অবস্থান ও ফসল",
    selectDescription: "কিছু বদলালেই পরামর্শ নিজে থেকে হালনাগাদ হবে।",
    district: "জেলা",
    crop: "ফসল",
    experimental: "পরীক্ষামূলক",
    usualTitle: "আপনার চিরাচরিত রোপণের সময় (ঐচ্ছিক)",
    usualHelp: "আপনার সাধারণ তারিখ দিলে তা সমর্থিত পরিবর্তন অনুযায়ী সরিয়ে দেখানো হবে।",
    from: "শুরু",
    to: "শেষ",
    month: "মাস",
    day: "দিন",
    clear: "তারিখ মুছুন",
    orderError: "শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না।",
    longError: `সময়কাল সর্বোচ্চ ${MAX_WINDOW_DAYS} দিনের হতে পারবে।`,
    loadingOptions: "জেলা ও ফসল লোড হচ্ছে…",
    loadingAdvisory: "পরামর্শ হালনাগাদ হচ্ছে…",
    optionsError: "জেলা বা ফসল লোড করা যায়নি।",
    advisoryError: "পরামর্শ লোড করা যায়নি।",
    retry: "আবার চেষ্টা করুন",
    empty: "একটি জেলা ও ফসল নির্বাচন করুন।",
    resultTitle: "আপনার জন্য পরামর্শ",
    decision: {
      no_change: "চিরাচরিত রোপণের সময়ই রাখুন",
      weak: "নির্ভরযোগ্য পরিবর্তন পাওয়া যায়নি: চিরাচরিত সময়ই রাখুন",
      saturated: "নিশ্চিত করে বলা যাচ্ছে না: চিরাচরিত সময়ই রাখুন",
      insufficient_data: "পরামর্শ দেওয়ার মতো তথ্য নেই",
      not_applicable: "এই ফসলের জন্য কোনো পরামর্শ নেই",
      delay: (n) => `রোপণ প্রায় ${n} দিন পিছিয়ে নিন`,
      advance: (n) => `রোপণ প্রায় ${n} দিন এগিয়ে আনুন`,
    },
    confidence: {
      supported: "স্পষ্ট পরিবর্তন",
      weak: "নির্ভরযোগ্য নয়",
      none: "স্পষ্ট পরিবর্তন নেই",
      not_applicable: "প্রযোজ্য নয়",
    },
    windowTitle: "আপনার রোপণের সময়",
    usualLabel: "আপনার চিরাচরিত",
    suggestedLabel: "প্রস্তাবিত",
    unchanged: "অপরিবর্তিত",
    windowHint: "আপনার চিরাচরিত তারিখ দিলে তা সরিয়ে দেখানো হবে।",
    copySentence: "পরামর্শ কপি করুন",
    copySms: "SMS লেখা কপি করুন",
    copied: "কপি হয়েছে",
    print: "প্রিন্ট",
    smsInfo: (len, seg) => `SMS লেখা: ${len} অক্ষর, ${seg}টি বার্তা`,
    bnDraft: "বাংলা লেখাটি একটি খসড়া, যা এখনও কোনো মাতৃভাষী যাচাই করেননি।",
    experimentalTitle: "পরীক্ষামূলক ফলাফল",
    chartTitle: "কোন বছর কবে কার্যকর বৃষ্টি শুরু হয়েছে",
    chartIntro:
      "প্রতিটি বিন্দু এক বছর। ছায়াযুক্ত অংশে মাঝের অর্ধেক বছর পড়ে; ড্যাশ দেওয়া রেখাটি মধ্যমান।",
    early: (p) => `${p.from}–${p.to} · ${p.years} বছর`,
    late: (p) => `${p.from}–${p.to} · ${p.years} বছর`,
    median: "মধ্যমান",
    censoredNote: (n) =>
      `${n}টি বছরে অনুসন্ধানের মৌসুম শেষ পর্যন্ত কার্যকর বৃষ্টি হয়নি, তাই সেগুলো দেখানো হয়নি।`,
    numbersTitle: "সংখ্যাগুলো দেখুন",
    colPeriod: "সময়কাল",
    colYears: "বছর",
    colFound: "শুরু পাওয়া গেছে",
    colNone: "মৌসুম শেষ পর্যন্ত কার্যকর বৃষ্টি নেই",
    colUnknown: "তথ্য অপর্যাপ্ত",
    colRange: "মাঝের অর্ধেক বছর",
    colMedian: "মধ্যমান শুরু",
    certaintyTitle: "কতটা নিশ্চিত?",
    estimate: (est, lo, hi) =>
      `পরিবর্তনের সেরা অনুমান: ${est} দিন। তথ্য থেকে ${lo} থেকে ${hi} দিন পর্যন্ত বাদ দেওয়া যায় না (বিয়োগ = আগে, যোগ = পরে)।`,
    meaning: {
      supported: "একটি পরিবর্তন পাওয়া গেছে এবং “কার্যকর বৃষ্টি”র বেশিরভাগ বিকল্প সংজ্ঞা একমত।",
      weak: "কিছু একটা চোখে পড়েছে, তবে তা “কার্যকর বৃষ্টি”র সংজ্ঞার ওপর নির্ভর করে, তাই রোপণের সময় বদলানোর পরামর্শ দেওয়া হচ্ছে না।",
      none: "বছর থেকে বছরের স্বাভাবিক ওঠানামা থেকে আলাদা করার মতো কোনো পরিবর্তন পাওয়া যায়নি। এর মানে এই নয় যে কিছুই বদলায়নি।",
      not_applicable: "এই ফসলের জন্য বৃষ্টি শুরুর কোনো নিয়ম নির্ধারিত নেই।",
    },
    agreement: (a, b) =>
      `“কার্যকর বৃষ্টি”র ${b}টি বিকল্প সংজ্ঞার মধ্যে ${a}টি একই উত্তর দেয়।`,
    limitsTitle: "যা মনে রাখতে হবে",
    englishOnly: "(ইংরেজিতে দেখানো হয়েছে)",
    provenanceTitle: "তথ্যের উৎস",
    source: "উৎস",
    retrieved: "সংগ্রহের তারিখ",
    dataThrough: "তথ্য পর্যন্ত",
    latestObs: (d, ago) => `সর্বশেষ পর্যবেক্ষণ ${d}${ago != null ? ` (${ago} দিন আগে)` : ""}`,
    storedNote: "সংরক্ষিত NASA POWER তথ্য, সরাসরি অনুসন্ধান নয়।",
    syntheticNote: "কৃত্রিম পরীক্ষামূলক তথ্য, প্রকৃত পর্যবেক্ষণ নয়।",
    offlineNote: "সংরক্ষিত অফলাইন ফাইল থেকে দেওয়া হয়েছে।",
    gridNote: "মানগুলো প্রায় ০.৫ ডিগ্রির একটি গ্রিড সেলের, একটি জমির নয়।",
    infoTitle: "প্রমাণভিত্তিক নির্দেশনা হিসেবে ব্যবহার করুন",
    info: "এটি সিদ্ধান্ত-সহায়তা, পূর্বাভাস নয়। আগের ও পরের বছরগুলোতে কার্যকর বৃষ্টি কবে শুরু হয়েছে তা তুলনা করা হয়েছে; আবহাওয়া বা ফলনের নিশ্চয়তা নয়। স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শ নিন।",
  },
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error?.message ?? error?.message ?? fallback;

const localeOf = (language) => (language === "bn" ? "bn-BD" : "en-GB");

const mdToDate = (md, locale) => {
  const [m, d] = md.split("-").map(Number);
  return new Date(Date.UTC(2001, m - 1, d)).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

const mdToDay = (md) => {
  const [m, d] = md.split("-").map(Number);
  return (Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5 + 1;
};

const pad = (n) => String(n).padStart(2, "0");

const monthNames = (locale) =>
  Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(2001, i, 1)).toLocaleDateString(locale, {
      month: "long",
      timeZone: "UTC",
    }),
  );

const localName = (item, language) =>
  language === "bn"
    ? (item.nameBn ?? item.nameEn ?? item.slug)
    : (item.nameEn ?? item.slug);

// Month + day selects, so the farmer never sees a year. value = { m: "07", d: "15" } (strings, "" = not set).
function MonthDayPicker({ label, value, onChange, months, t, numberLocale }) {
  const days = value.m ? DAYS_IN_MONTH[Number(value.m) - 1] : 31;
  const cls =
    "block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20";
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium text-gray-700">{label}</legend>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <select
          aria-label={`${label}: ${t.month}`}
          className={cls}
          value={value.m}
          onChange={(e) => {
            const m = e.target.value;
            const max = m ? DAYS_IN_MONTH[Number(m) - 1] : 31;
            onChange({ m, d: value.d && Number(value.d) > max ? pad(max) : value.d });
          }}
        >
          <option value="">{t.month}</option>
          {months.map((name, i) => (
            <option key={i} value={pad(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: ${t.day}`}
          className={cls}
          value={value.d}
          onChange={(e) => onChange({ ...value, d: e.target.value })}
        >
          <option value="">{t.day}</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i} value={pad(i + 1)}>
              {(i + 1).toLocaleString(numberLocale)}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

// Usual window vs suggested window on one timeline.
function WindowStrip({ window: w, locale, t }) {
  const a = mdToDay(w.usual.from);
  const b = mdToDay(w.usual.to);
  const c = mdToDay(w.revised.from);
  const d = mdToDay(w.revised.to);
  const lo = Math.min(a, c) - 10;
  const hi = Math.max(b, d) + 10;
  const pct = (day) => `${((day - lo) / (hi - lo)) * 100}%`;
  const bar = (from, to, color) => ({
    left: pct(from),
    width: `max(6px, calc(${pct(to)} - ${pct(from)}))`,
    background: color,
  });
  const rows = [
    { label: t.usualLabel, from: a, to: b, text: `${mdToDate(w.usual.from, locale)} – ${mdToDate(w.usual.to, locale)}`, color: "#94a3b8" },
    {
      label: t.suggestedLabel,
      from: c,
      to: d,
      text: w.changed ? `${mdToDate(w.revised.from, locale)} – ${mdToDate(w.revised.to, locale)}` : t.unchanged,
      color: "#15803d",
    },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-sm">
            <span className="font-medium text-gray-800">{r.label}</span>
            <span className="tabular-nums text-gray-700">{r.text}</span>
          </div>
          <div className="relative h-4 rounded-full bg-gray-100">
            <div className="absolute top-0 h-4 rounded-full" style={bar(r.from, r.to, r.color)} />
          </div>
        </div>
      ))}
    </div>
  );
}

const TONE = {
  delay: "border-amber-300 bg-amber-50",
  advance: "border-amber-300 bg-amber-50",
  no_change: "border-green-300 bg-green-50",
  weak: "border-slate-300 bg-slate-50",
  saturated: "border-slate-300 bg-slate-50",
  insufficient_data: "border-slate-300 bg-slate-50",
  not_applicable: "border-slate-300 bg-slate-50",
};

export default function AdvisoryPage() {
  const { language } = useLanguage();
  const lang = language === "bn" ? "bn" : "en";
  const t = translations[lang];
  const locale = localeOf(lang);
  const api = useAxios();
  const months = useMemo(() => monthNames(locale), [locale]);
  const nf = (n) => Number(n).toLocaleString(locale);

  const [districts, setDistricts] = useState([]);
  const [crops, setCrops] = useState([]);
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [from, setFrom] = useState({ m: "", d: "" });
  const [to, setTo] = useState({ m: "", d: "" });
  const [advisory, setAdvisory] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryError, setAdvisoryError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [copied, setCopied] = useState("");

  const loadOptions = async () => {
    setOptionsLoading(true);
    setOptionsError("");
    try {
      const [d, c] = await Promise.all([
        api.get("/districts"),
        api.get("/crops/advisory-supported"),
      ]);
      const districtItems = d.data?.districts ?? [];
      const cropItems = c.data?.crops ?? [];
      setDistricts(districtItems);
      setCrops(cropItems);
      // Default to the project's demo case when it is available.
      setDistrict((cur) =>
        districtItems.some((x) => x.slug === cur)
          ? cur
          : (districtItems.find((x) => x.slug === "rajshahi") ?? districtItems[0])?.slug ?? "",
      );
      setCrop((cur) =>
        cropItems.some((x) => x.slug === cur)
          ? cur
          : (cropItems.find((x) => x.slug === "aman") ?? cropItems[0])?.slug ?? "",
      );
    } catch (error) {
      setOptionsError(getErrorMessage(error, t.optionsError));
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The usual window is sent only when all four parts are set and the window is valid; otherwise an inline message explains.
  const usual = useMemo(() => {
    if (!from.m || !from.d || !to.m || !to.d) return { value: null, error: "" };
    const a = `${from.m}-${from.d}`;
    const b = `${to.m}-${to.d}`;
    const span = mdToDay(b) - mdToDay(a);
    if (span < 0) return { value: null, error: t.orderError };
    if (span > MAX_WINDOW_DAYS) return { value: null, error: t.longError };
    return { value: { from: a, to: b }, error: "" };
  }, [from, to, t.orderError, t.longError]);

  const usualKey = usual.value ? `${usual.value.from}|${usual.value.to}` : "";

  // Fetch automatically whenever the choices change. The response holds BOTH languages, so language is not a dependency.
  useEffect(() => {
    if (!district || !crop) return undefined;
    const controller = new AbortController();
    setAdvisoryLoading(true);
    setAdvisoryError("");
    const params = new URLSearchParams({ crop });
    if (usual.value) {
      params.set("usualFrom", usual.value.from);
      params.set("usualTo", usual.value.to);
    }
    api
      .get(`/districts/${encodeURIComponent(district)}/advisory?${params}`, { signal: controller.signal })
      .then((res) => {
        setAdvisory(res.data);
        setAdvisoryLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
        setAdvisory(null);
        setAdvisoryError(getErrorMessage(error, t.advisoryError));
        setAdvisoryLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district, crop, usualKey, reloadTick]);

  const copy = async (kind, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  const decision = advisory?.decision;
  const kind = decision?.kind;
  const headline = (() => {
    if (!kind) return "";
    const h = t.decision[kind];
    if (typeof h === "function") return h(nf(decision.shiftDays));
    return h ?? "";
  })();
  const sentence = advisory?.sentence?.[lang] ?? advisory?.sentence?.text ?? "";
  const sms = advisory?.sentence?.sms;
  const smsText = sms?.[lang] ?? "";
  const smsMeta = sms?.meta?.[lang];
  const dist = advisory?.evidence?.distributions;
  const periods = advisory?.evidence?.periods;
  const strength = advisory?.evidence?.strength;
  const est = strength?.shiftEstimate;
  const prov = advisory?.provenance;
  const noUsualHint = advisory && !advisory.window;

  const th = "px-2 py-2 text-left text-xs font-semibold text-gray-600";
  const td = "px-2 py-2 text-sm tabular-nums text-gray-800";

  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="print:hidden">
          <SectionHeading title={t.selectTitle} description={t.selectDescription} />

          {optionsLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <LoaderCircle className="animate-spin" size={17} />
              {t.loadingOptions}
            </p>
          ) : optionsError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} />
                <span>{optionsError}</span>
              </div>
              <button type="button" onClick={loadOptions} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100">
                {t.retry}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <label className="block text-sm font-medium text-gray-700">
                  {t.district}
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    {districts.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {localName(item, lang)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-gray-700">
                  {t.crop}
                  <select
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                  >
                    {crops.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {localName(item, lang)}
                        {item.experimental ? ` (${t.experimental})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-5">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <CalendarDays size={18} className="text-green-700" />
                  {t.usualTitle}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{t.usualHelp}</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <MonthDayPicker label={t.from} value={from} onChange={setFrom} months={months} t={t} numberLocale={locale} />
                  <MonthDayPicker label={t.to} value={to} onChange={setTo} months={months} t={t} numberLocale={locale} />
                </div>
                {usual.error && (
                  <p className="mt-2 text-sm text-red-700" role="alert">
                    {usual.error}
                  </p>
                )}
                {(from.m || from.d || to.m || to.d) && (
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-green-800 underline"
                    onClick={() => {
                      setFrom({ m: "", d: "" });
                      setTo({ m: "", d: "" });
                    }}
                  >
                    {t.clear}
                  </button>
                )}
              </div>
            </>
          )}
        </Card>

        <Card>
          <SectionHeading title={t.resultTitle} />

          {advisoryError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} />
                <span>{advisoryError}</span>
              </div>
              <button type="button" onClick={() => setReloadTick((n) => n + 1)} className="mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100">
                {t.retry}
              </button>
            </div>
          ) : !advisory ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              {advisoryLoading && <LoaderCircle className="animate-spin" size={17} />}
              {advisoryLoading ? t.loadingAdvisory : t.empty}
            </p>
          ) : (
            <div className={`mt-4 min-w-0 space-y-6 transition-opacity ${advisoryLoading ? "opacity-60" : ""}`} aria-busy={advisoryLoading}>
              {advisoryLoading && (
                <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
                  <LoaderCircle className="animate-spin" size={16} />
                  {t.loadingAdvisory}
                </p>
              )}

              {/* 1. The decision, then the sentence */}
              <div className={`rounded-xl border p-4 sm:p-5 ${TONE[kind] ?? TONE.weak}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300">
                    {t.confidence[decision.confidence] ?? decision.confidence}
                  </span>
                  {decision.experimental && (
                    <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      {t.experimentalTitle}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">{headline}</p>
                <p className="mt-3 text-sm leading-6 text-gray-800 sm:text-base sm:leading-7">{sentence}</p>

                {lang === "bn" && advisory.sentence?.reviewStatus === "BANGLA_DRAFT_NOT_NATIVE_REVIEWED" && (
                  <p className="mt-3 text-xs text-gray-600">{t.bnDraft}</p>
                )}
                {advisory.warnings?.map((w) => (
                  <p key={w.code} className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-950">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{lang === "bn" ? (w.messageBn ?? w.message) : w.message}</span>
                  </p>
                ))}

                <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
                  <button type="button" onClick={() => copy("sentence", sentence)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Copy size={14} />
                    {copied === "sentence" ? t.copied : t.copySentence}
                  </button>
                  {smsText && (
                    <button type="button" onClick={() => copy("sms", smsText)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Copy size={14} />
                      {copied === "sms" ? t.copied : t.copySms}
                    </button>
                  )}
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Printer size={14} />
                    {t.print}
                  </button>
                </div>
                {smsMeta && <p className="mt-2 text-xs text-gray-600">{t.smsInfo(nf(smsMeta.length), nf(smsMeta.segments))}</p>}
              </div>

              {/* 2. The farmer's window */}
              <section>
                <h3 className="mb-2 font-semibold text-gray-900">{t.windowTitle}</h3>
                {advisory.window ? <WindowStrip window={advisory.window} locale={locale} t={t} /> : noUsualHint && <p className="text-sm text-gray-600">{t.windowHint}</p>}
              </section>

              {/* 3. The evidence, as a picture first */}
              {dist && periods && (
                <section className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{t.chartTitle}</h3>
                  <p className="mb-2 mt-1 text-sm text-gray-600">{t.chartIntro}</p>
                  <OnsetChart
                    distributions={dist}
                    locale={locale}
                    numberLocale={locale}
                    labels={{
                      early: t.early({ from: periods.early.from, to: periods.early.to, years: nf(dist.early.years) }),
                      late: t.late({ from: periods.late.from, to: periods.late.to, years: nf(dist.late.years) }),
                      median: t.median,
                      chartTitle: t.chartTitle,
                    }}
                  />
                  {(() => {
                    const n = (dist.early.censoredYears ?? 0) + (dist.late.censoredYears ?? 0);
                    return n > 0 ? <p className="mt-2 text-xs text-gray-600">{t.censoredNote(nf(n))}</p> : null;
                  })()}

                  <details className="mt-3 rounded-lg border border-gray-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-800">{t.numbersTitle}</summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className={th}>{t.colPeriod}</th>
                            <th className={th}>{t.colYears}</th>
                            <th className={th}>{t.colFound}</th>
                            <th className={th}>{t.colNone}</th>
                            <th className={th}>{t.colUnknown}</th>
                            <th className={th}>{t.colRange}</th>
                            <th className={th}>{t.colMedian}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {["early", "late"].map((k) => {
                            const d = dist[k];
                            const s = d.summary ?? {};
                            return (
                              <tr key={k} className="border-b border-gray-100">
                                <td className={td}>{`${periods[k].from}–${periods[k].to}`}</td>
                                <td className={td}>{nf(d.years)}</td>
                                <td className={td}>{nf(d.confirmedYears)}</td>
                                <td className={td}>{nf(d.censoredYears)}</td>
                                <td className={td}>{nf(d.unknownYears)}</td>
                                <td className={td}>{s.q1Date && s.q3Date ? `${mdToDate(s.q1Date, locale)} – ${mdToDate(s.q3Date, locale)}` : "—"}</td>
                                <td className={td}>{s.medianDate ? mdToDate(s.medianDate, locale) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </section>
              )}

              {/* 4. How sure */}
              {(est || strength?.definitionsUsable || decision) && (
                <section className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900">{t.certaintyTitle}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700">
                    {est && (
                      <li>
                        {t.estimate(
                          nf(est.estimateDays),
                          nf(Math.floor(est.interval95Days[0])),
                          nf(Math.ceil(est.interval95Days[1])),
                        )}
                      </li>
                    )}
                    {strength?.definitionsUsable != null && <li>{t.agreement(nf(strength.definitionsAgreeing), nf(strength.definitionsUsable))}</li>}
                    {t.meaning[decision.confidence] && <li>{t.meaning[decision.confidence]}</li>}
                  </ul>
                </section>
              )}

              {/* 5. Limits */}
              {advisory.limitations?.length > 0 && (
                <details className="border-t border-gray-200 pt-4">
                  <summary className="cursor-pointer font-semibold text-gray-900">
                    {t.limitsTitle}
                    {lang === "bn" ? ` ${t.englishOnly}` : ""}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700">
                    {advisory.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* 6. Provenance */}
              {prov && (
                <details className="border-t border-gray-200 pt-4">
                  <summary className="cursor-pointer font-semibold text-gray-900">{t.provenanceTitle}</summary>
                  <dl className="mt-2 space-y-1 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="font-medium">{t.source}:</dt>
                      <dd>{prov.source}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="font-medium">{t.retrieved}:</dt>
                      <dd>{prov.retrievedAt?.slice(0, 10)}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="font-medium">{t.dataThrough}:</dt>
                      <dd>{prov.endDate}</dd>
                    </div>
                  </dl>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                    <li>{prov.isSynthetic ? t.syntheticNote : t.storedNote}</li>
                    {prov.servedFrom === "offline-file" && <li>{t.offlineNote}</li>}
                    <li>{t.gridNote}</li>
                    {advisory.latestObservationDate && <li>{t.latestObs(advisory.latestObservationDate, advisory.daysSinceLatest)}</li>}
                  </ul>
                </details>
              )}
            </div>
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
}
