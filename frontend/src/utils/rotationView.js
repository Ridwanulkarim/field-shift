// Small helpers shared by the planner results pages. They only pick and format fields the evaluation API already
// returns (POST /api/evaluate); no scoring or science happens here.

export const existingOf = (result) =>
  (result?.strategies ?? []).find((s) => s.kind === "existing") ?? null;

export const alternativesOf = (result) =>
  (result?.strategies ?? [])
    .filter((s) => s.kind === "alternative")
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

export const cropNames = (strategy, language) =>
  (strategy?.crops ?? []).map((c) =>
    language === "bn" ? (c.nameBn ?? c.nameEn ?? c.slug) : (c.nameEn ?? c.slug),
  );

export const strategyLabel = (strategy, language) =>
  (language === "bn" ? strategy?.labelBn : strategy?.label) ?? strategy?.label ?? "";

export const findStrategy = (result, id) =>
  (result?.strategies ?? []).find((s) => s.id === id) ?? null;

// The first crop of a rotation that the planting advisory has a rule for (Aman or Aus), or null.
export const advisoryCropOf = (strategy) =>
  (strategy?.crops ?? []).map((c) => c.slug).find((slug) => slug === "aman" || slug === "aus") ?? null;

export const readSavedEvaluation = () => {
  try {
    return JSON.parse(sessionStorage.getItem("rotationEvaluation") || "null");
  } catch {
    return null;
  }
};

export const signed = (n, locale) => {
  const v = Number(n);
  const text = Math.abs(v).toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${text}`;
};
