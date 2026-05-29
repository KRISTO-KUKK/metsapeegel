import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.METSATARK_BASE_URL ?? "http://localhost:3000";
const areaId = process.env.AREA_ID ?? "cadastre-83604:001:0663";
const bbox = process.env.BBOX ?? "24.3,58.3,25.1,58.8";

const questions = [
  "Mis kataster üldse on?",
  "Võta kokku, mis siin tõenäoliselt toimunud on",
  "Palju on puidutooraine kattuvusi?",
  "Naita riigiomandis alasid",
  "Naita ule 100 ha alasid",
  "Naita vahemalt 10 eraldisega alasid"
];

async function requestJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${path} failed with ${response.status}: ${text.slice(0, 240)}`);
  }

  return response.json();
}

function params(values) {
  const search = new URLSearchParams(values);
  return search.toString();
}

function print(title, rows = []) {
  console.log(`\n=== ${title} ===`);
  for (const row of rows) {
    console.log(row);
  }
}

const analysis = await requestJson(`/api/analyze/${encodeURIComponent(areaId)}`);
const answers = [];

print("Selected area", [
  analysis.normalizedEvidence.area.title,
  analysis.normalizedEvidence.area.subtitle,
  `Registry stands: ${analysis.normalizedEvidence.registrySummary.standsCount}`,
  `EELIS groups: ${analysis.normalizedEvidence.protectionSummary.length}`,
  `ELME wood/carbon/other: ${analysis.normalizedEvidence.ecosystemContext.woodRawMaterialCount}/${analysis.normalizedEvidence.ecosystemContext.carbonStorageCount}/${analysis.normalizedEvidence.ecosystemContext.otherCount}`
]);

for (const question of questions) {
  const payload = await requestJson("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, question, history: [] })
  });
  answers.push({ question, answer: payload.answer });
  print(`AI question: ${question}`, [
    payload.answer.shortAnswer,
    payload.answer.explanation,
    `Evidence: ${payload.answer.evidenceIds.join(", ") || "none"}`,
    `Map action: ${payload.answer.mapAction?.filterId ?? "none"}`
  ].filter(Boolean));
}

const toolChecks = [
  { label: "state ownership", filter: "ownership_form", ownershipForm: "Riigiomand" },
  { label: "large areas", filter: "area_larger_than", minAreaHa: "100" },
  { label: "many stands", filter: "many_registry_stands", minStands: "10" }
];
const queryResults = [];

for (const check of toolChecks) {
  const { label, ...query } = check;
  const result = await requestJson(
    `/api/area-query?${params({ bbox, limit: "18", ...query })}`
  );
  queryResults.push({ label, query: result.query, samples: result.features.slice(0, 5) });
  print(`Map tool: ${label}`, [
    `${result.query.matchedCount}/${result.query.inspectedCount} matched in bbox ${bbox}`,
    ...result.features.slice(0, 3).map((feature) => `- ${feature.properties.label}: ${feature.properties.matchReason}`)
  ]);
}

await mkdir("tmp", { recursive: true });
const outputPath = join("tmp", "ai-tool-inspection.json");
await writeFile(
  outputPath,
  JSON.stringify({ areaId, bbox, analysis, answers, queryResults }, null, 2),
  "utf8"
);

print("Saved", [outputPath]);
