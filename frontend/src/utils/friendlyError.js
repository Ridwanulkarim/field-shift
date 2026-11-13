// Turns an axios error into a sentence a farmer can act on, in the language they have chosen. Call it while rendering
// (not when the error happens) so the message changes together with the language switch.
//
// The raw server message is shown only for validation problems (422), where it names the field the person can fix, and
// in Bangla it is translated first. A server sentence with no Bangla is replaced by the Bangla fallback, so Bangla mode
// never shows English.

import { ERROR_CODES_BN, FIELD_LABELS_BN, trOrNull } from "./bnText";

const TEXT = {
  en: {
    network: "We couldn't reach the server. Check your internet connection and try again.",
    notFound: "This service is not available right now. Please try again later.",
    rateLimited: "Too many requests. Please wait a moment and try again.",
    server: "Something went wrong on our side. Please try again in a minute.",
    unavailable: "The data service is not available right now. Please try again later.",
    generic: "Something went wrong. Please try again.",
  },
  bn: {
    network: "সার্ভারের সাথে যোগাযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
    notFound: "এই সেবাটি এখন পাওয়া যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
    rateLimited: "অনেক বেশি অনুরোধ হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।",
    server: "আমাদের দিকে একটি সমস্যা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।",
    unavailable: "তথ্য সেবা এখন পাওয়া যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
    generic: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
  },
};

export function friendlyError(error, language = "en", fallback) {
  const bn = language === "bn";
  const t = bn ? TEXT.bn : TEXT.en;
  if (error?.code === "ERR_CANCELED") return "";
  if (!error?.response) return t.network;

  const { status, data } = error.response;
  const code = data?.error?.code;
  const message = data?.error?.message;
  // English: the server's sentence. Bangla: its translation, else the error-code sentence, else the fallback.
  const serverText = () =>
    bn ? (trOrNull(message, "bn") ?? ERROR_CODES_BN[code] ?? fallback ?? t.generic) : message;

  if (status === 422 || code === "VALIDATION_ERROR") {
    const details = data?.error?.details;
    if (Array.isArray(details) && details.length) {
      return details
        .map((d) => {
          if (!bn) return `${d.field}: ${d.message}`;
          const label = FIELD_LABELS_BN[d.field] ?? FIELD_LABELS_BN[String(d.field).split(".")[0]] ?? "";
          const text = trOrNull(d.message, "bn") ?? ERROR_CODES_BN.VALIDATION_ERROR;
          return label ? `${label}: ${text}` : text;
        })
        .join(" | ");
    }
    return message ? serverText() : (fallback ?? t.generic);
  }
  if (status === 404 && code === "NOT_FOUND") return t.notFound;
  if (status === 404 && message) return serverText(); // e.g. "No real NASA POWER data for this district"
  if (status === 429) return t.rateLimited;
  if (status === 503) return t.unavailable;
  if (status >= 500) return t.server;
  return fallback || t.generic;
}
