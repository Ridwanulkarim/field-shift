// Shared language helpers, so every page formats numbers, dates, names and status words the same way in English and
// Bangla. Fixed page text lives in each page's own `translations` object; text that comes from the API goes through
// tr() in bnText.js; everything else a page shows (digits, dates, soil types, status codes) goes through this file.

import { STATUS_WORDS, bnDigits, tr, trOrNull } from "./bnText";

export const normalizeLang = (language) => (language === "bn" ? "bn" : "en");
export const localeOf = (language) => (normalizeLang(language) === "bn" ? "bn-BD" : "en-GB");

// Number in the language's own digits. Missing or non-numeric values show a dash.
export function fmtNum(value, language, options) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(localeOf(language), options);
}

// Digits inside text that is not a plain number (a year, "2001–2025", "03-15", an id).
export const digits = (value, language) =>
  normalizeLang(language) === "bn" ? bnDigits(value ?? "") : String(value ?? "");

// A date (ISO string or Date) in the language's own month names and digits. Unparseable input is returned as text.
export function fmtDate(value, language, options = { dateStyle: "medium" }) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return digits(value, language);
  return new Intl.DateTimeFormat(localeOf(language), { ...options, timeZone: "UTC" }).format(date);
}

// "5 days" style counts: Bangla has no plural suffix, English adds "s".
export const plural = (n, one, many) => (Number(n) === 1 ? one : many);

// Words the API returns as codes (data mode, upstream status, service name).
export function statusWord(value, language) {
  const lang = normalizeLang(language);
  if (value === null || value === undefined || value === "") return "—";
  return STATUS_WORDS[lang][value] ?? STATUS_WORDS.en[value] ?? String(value);
}

// Field profile values are free text, so only the common English ones have a Bangla form; anything else the
// person typed themselves is shown exactly as they typed it.
const SOIL_BN = {
  loamy: "দোআঁশ",
  loam: "দোআঁশ",
  "silty loam": "পলিমাটি দোআঁশ",
  silt: "পলি",
  silty: "পলিমাটি",
  clay: "এঁটেল",
  "clay loam": "এঁটেল দোআঁশ",
  sandy: "বেলে",
  "sandy loam": "বেলে দোআঁশ",
  peat: "পিট মাটি",
};

const IRRIGATION_BN = {
  none: "নেই",
  "rain only": "শুধু বৃষ্টি",
  rainfed: "বৃষ্টিনির্ভর",
  "rain-fed": "বৃষ্টিনির্ভর",
  canal: "খাল",
  river: "নদী",
  pond: "পুকুর",
  well: "কূপ",
  "tube well": "নলকূপ",
  tubewell: "নলকূপ",
  "deep tube well": "গভীর নলকূপ",
  "shallow tube well": "অগভীর নলকূপ",
  pump: "পাম্প",
  "pump or canal": "পাম্প বা খাল",
  groundwater: "ভূগর্ভস্থ পানি",
  limited: "সীমিত",
  reliable: "নির্ভরযোগ্য",
  available: "উপলব্ধ",
};

const lookup = (table, value, language) => {
  if (!value) return "—";
  if (normalizeLang(language) !== "bn") return value;
  return table[String(value).trim().toLowerCase()] ?? value;
};

export const soilLabel = (value, language) => lookup(SOIL_BN, value, language);
export const irrigationLabel = (value, language) => lookup(IRRIGATION_BN, value, language);

// Translate a message that came from the server; keeps the English text only when the language is English.
export const apiText = (text, language) => (normalizeLang(language) === "bn" ? tr(text, "bn") : text);

// Like apiText, but never leaves English behind in Bangla mode: the Bangla fallback is shown when the sentence is new.
export const apiTextOr = (text, language, bnFallback) =>
  normalizeLang(language) === "bn" ? (trOrNull(text, "bn") ?? bnFallback ?? text) : text;
