// Fails when a fixed English sentence the backend can send to the UI has no Bangla in src/utils/bnText.js.
// Run from the repo root checkout (it reads ../backend):  node frontend/scripts/check-bn-coverage.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../../backend/src");
const load = (p) => import(pathToFileURL(path.join(backend, p)).href);

const { hasBn } = await import(pathToFileURL(path.resolve(here, "../src/utils/bnText.js")).href);

const rules = await load("science/rules.js");
const pw = await load("science/plantingWindow.js");
const fa = await load("science/farmerAdvisory.js");
const rot = await load("science/rotation.js");
const ev = await load("services/evaluationService.js").catch(() => null);

const strings = new Map(); // text -> where it comes from
const add = (where, list) => list.filter(Boolean).forEach((t) => strings.set(t, where));

add("rules.DISCLAIMER", [rules.DISCLAIMER]);
add("rules.NOT_MODELED", rules.NOT_MODELED.map((n) => n.en));
add("rules.EXPERIMENTAL_CROPS", Object.values(rules.EXPERIMENTAL_CROPS).map((e) => e.en));
add("plantingWindow.PLANTING_LIMITATIONS", pw.PLANTING_LIMITATIONS);
add("farmerAdvisory.MAY_SOURCE_CHECK", [fa.MAY_SOURCE_CHECK.en]);
if (ev?.LIMITATIONS) add("evaluationService.LIMITATIONS", ev.LIMITATIONS);

// Sentences that are written inline in the backend (no export to import): kept here so a reworded one is caught.
const inline = {
  "farmerAdvisory window.note":
    "The revised window is your own usual window moved by the supported shift in the start of usable rain. It is not an agronomically derived transplanting window.",
  "rankingStability.stable":
    "The top-ranked rotation stays first in most of the weight changes tried, so the ranking does not hinge on one weight.",
  "rankingStability.moderate":
    "The top-ranked rotation stays first in about half or more of the weight changes tried; treat the top few options as close.",
  "rankingStability.sensitive":
    "The top-ranked rotation often changes when a weight changes. Treat the top options as roughly equal and decide on practical grounds.",
};
for (const [where, text] of Object.entries(inline)) strings.set(text, where);

// Make sure the inline copies above still match the backend source files.
import { readFileSync } from "node:fs";
const source = (p) => readFileSync(path.join(backend, p), "utf8");
const stale = [];
for (const [where, text] of Object.entries(inline)) {
  const file = where.startsWith("farmerAdvisory") ? "science/farmerAdvisory.js" : "science/rankingStability.js";
  if (!source(file).includes(text)) stale.push(where);
}
if (!ev) {
  // evaluationService needs the database client; read its LIMITATIONS array from the source instead.
  const m = source("services/evaluationService.js").match(/export const LIMITATIONS = \[([\s\S]*?)\n\];/);
  const items = [...m[1].matchAll(/^\s*(['"])([\s\S]*?)\1,\s*$/gm)].map((x) => x[2].replace(/\\'/g, "'"));
  add("evaluationService.LIMITATIONS", items);
}

const missing = [...strings].filter(([text]) => !hasBn(text));
for (const [text, where] of missing) console.error(`MISSING Bangla  [${where}]\n  ${text}\n`);
for (const where of stale) console.error(`STALE inline copy in this script: ${where}`);
console.log(`${strings.size - missing.length} of ${strings.size} backend sentences have Bangla.`);
process.exit(missing.length || stale.length ? 1 : 0);
