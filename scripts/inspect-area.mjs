import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.METSATARK_BASE_URL ?? "http://localhost:3000";
const areaId = process.env.AREA_ID ?? "cadastre-83604:001:0663";
const questions = [
  "Mida tähendab minu jaoks, et need kaitsealad või Natura/VEP kattuvused hõlmavad minu metsaala?",
  "Kas puude vanuse ja Metsaregistri andmete järgi oleks siin raie üldse mõeldav?",
  "Võta kokku, mis siin tõenäoliselt toimunud on",
  "Mis andmed on otsuse jaoks puudu?"
];

async function requestJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return response.json();
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function rows(values) {
  return values.filter(Boolean).map((value) => `- ${value}`).join("\n");
}

const analysis = await requestJson(`/api/analyze/${encodeURIComponent(areaId)}`);
const normalized = analysis.normalizedEvidence;

printSection("Ala");
console.log(`${normalized.area.title}`);
console.log(normalized.area.subtitle);

printSection("Süsteemi koondpilt");
console.log(
  rows([
    `Eraldised: ${normalized.registrySummary.standsCount}`,
    `Teatised: ${normalized.registrySummary.activeNoticesCount} aktiivset, ${normalized.registrySummary.archivedNoticesCount} arhiveeritud`,
    `Inventuur: ${normalized.registrySummary.inventorySummary}`,
    `EELIS grupid: ${normalized.protectionSummary.length}`,
    `ELME: ${normalized.ecosystemContext.woodRawMaterialCount} puidutooraine, ${normalized.ecosystemContext.carbonStorageCount} süsiniku, ${normalized.ecosystemContext.otherCount} muud`,
    `Andmepaki seis: ${normalized.dataCompleteness.score}/100`
  ])
);

if (normalized.interpretation) {
  printSection("Tõlgendussignaalid");
  console.log(normalized.interpretation.primaryTakeaway);
  console.log(
    rows([
      normalized.interpretation.activity.summary,
      normalized.interpretation.standStructure.summary,
      normalized.interpretation.nature.summary,
      normalized.interpretation.dataGaps.summary
    ])
  );
}

const answers = [];
for (const question of questions) {
  const payload = await requestJson("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, question, history: [] })
  });
  answers.push(payload.answer);
  printSection(`AI: ${question}`);
  console.log(payload.answer.shortAnswer);
  if (payload.answer.explanation) {
    console.log(payload.answer.explanation);
  }
  console.log(`Tõendid: ${payload.answer.evidenceIds.join(", ") || "puudub"}`);
}

await mkdir("tmp", { recursive: true });
const outputPath = join("tmp", "area-inspection.json");
await writeFile(
  outputPath,
  JSON.stringify({ areaId, analysis, answers }, null, 2),
  "utf8"
);

printSection("Salvestatud");
console.log(outputPath);
