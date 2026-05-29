import { pointOnFeature } from "@turf/turf";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { analyzeResolvedArea } from "@/lib/analysis/analyzeArea";
import { findLiveForestAt } from "@/lib/data/liveForest";
import type { AnalysisResult } from "@/lib/types/forestry";

type WfsFeature = Feature<Geometry | null, Record<string, unknown>>;
type WfsCollection = FeatureCollection<Geometry | null, Record<string, unknown>>;

type AuditRow = {
  id: string;
  name: string;
  county?: string;
  ownershipForm?: string;
  areaHa: number;
  riskLevel: string;
  riskScore: number;
  recommendation: string;
  status: string;
  confidenceScore: number;
  stands: number;
  notices: number;
  changes: number;
  protectedAreas: number;
  topReasons: string[];
};

type AuditFailure = {
  sample: string;
  reason: string;
};

export type AuditSample = {
  sampledAt: string;
  total: number;
  counts: {
    riskLevels: Record<string, number>;
    recommendations: Record<string, number>;
    statuses: Record<string, number>;
  };
  rows: AuditRow[];
  failures: AuditFailure[];
};

const etakWfsUrl = "https://gsavalik.envir.ee/geoserver/etak/wfs";
const etakLayer = "etak:e_305_puittaimestik_a";

const countyBoxes: Array<[string, [number, number, number, number]]> = [
  ["Harju", [23.7, 58.95, 25.8, 59.65]],
  ["Hiiu", [22.0, 58.65, 23.2, 59.15]],
  ["Ida-Viru", [26.6, 58.85, 28.35, 59.55]],
  ["Jõgeva", [25.6, 58.45, 27.0, 59.05]],
  ["Järva", [24.9, 58.55, 26.2, 59.25]],
  ["Lääne", [23.2, 58.55, 24.4, 59.25]],
  ["Lääne-Viru", [25.6, 58.85, 27.2, 59.65]],
  ["Põlva", [26.7, 57.75, 27.65, 58.25]],
  ["Pärnu", [23.5, 57.75, 25.5, 58.75]],
  ["Rapla", [24.2, 58.55, 25.35, 59.2]],
  ["Saare", [21.75, 57.85, 23.6, 58.75]],
  ["Tartu", [26.0, 58.05, 27.45, 58.75]],
  ["Valga", [25.55, 57.55, 26.85, 58.25]],
  ["Viljandi", [24.9, 57.75, 26.25, 58.55]],
  ["Võru", [26.4, 57.5, 27.65, 58.15]]
];

function increment(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function isForestFeature(feature: WfsFeature): boolean {
  return (
    feature.geometry !== null &&
    (feature.properties.tyyp_tekst === "Mets" || feature.properties.tyyp === 10)
  );
}

async function fetchForestFeatures(
  county: string,
  bbox: [number, number, number, number],
  count: number
): Promise<Array<{ county: string; feature: WfsFeature }>> {
  const url = new URL(etakWfsUrl);
  url.search = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: etakLayer,
    COUNT: "80",
    SRSNAME: "EPSG:4326",
    OUTPUTFORMAT: "application/json",
    BBOX: `${bbox.join(",")},EPSG:4326`
  }).toString();

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`ETAK WFS ${response.status}`);
  }

  const collection = (await response.json()) as WfsCollection;
  return collection.features
    .filter(isForestFeature)
    .slice(0, count)
    .map((feature) => ({ county, feature }));
}

function samplePoint(feature: WfsFeature): [number, number] | null {
  if (!feature.geometry) {
    return null;
  }

  try {
    const point = pointOnFeature({
      type: "Feature",
      properties: {},
      geometry: feature.geometry
    });
    const [lng, lat] = point.geometry.coordinates;
    return [lng, lat];
  } catch {
    return null;
  }
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function rowFromAnalysis(analysis: AnalysisResult): AuditRow {
  return {
    id: analysis.area.id,
    name: analysis.area.address ?? analysis.area.name,
    county: analysis.area.county,
    ownershipForm: analysis.area.ownershipForm,
    areaHa: analysis.area.areaHa,
    riskLevel: analysis.publicAudit.riskLevel,
    riskScore: analysis.publicAudit.riskScore,
    recommendation: analysis.publicAudit.disclosureRecommendation.level,
    status: analysis.status,
    confidenceScore: analysis.confidenceScore,
    stands: arrayCount(analysis.rawFacts.stands),
    notices: arrayCount(analysis.rawFacts.notices),
    changes: arrayCount(analysis.rawFacts.changes),
    protectedAreas: arrayCount(analysis.rawFacts.protectedAreas),
    topReasons: analysis.publicAudit.riskFactors.slice(0, 3)
  };
}

export async function buildAuditSample({
  perCounty = 1,
  maxSamples = 12
}: {
  perCounty?: number;
  maxSamples?: number;
} = {}): Promise<AuditSample> {
  const rows: AuditRow[] = [];
  const failures: AuditFailure[] = [];
  const samples: Array<{ county: string; feature: WfsFeature }> = [];

  for (const [county, bbox] of countyBoxes) {
    if (samples.length >= maxSamples) {
      break;
    }

    try {
      const found = await fetchForestFeatures(county, bbox, perCounty);
      samples.push(...found);
    } catch (cause) {
      failures.push({
        sample: county,
        reason: cause instanceof Error ? cause.message : "ETAK WFS failed"
      });
    }
  }

  for (const sample of samples.slice(0, maxSamples)) {
    const coordinates = samplePoint(sample.feature);
    if (!coordinates) {
      failures.push({ sample: sample.county, reason: "Sample geometry failed" });
      continue;
    }

    try {
      const area = await findLiveForestAt(coordinates[0], coordinates[1]);
      if (!area) {
        failures.push({ sample: sample.county, reason: "Click lookup found no forest" });
        continue;
      }

      rows.push(rowFromAnalysis(await analyzeResolvedArea(area)));
    } catch (cause) {
      failures.push({
        sample: sample.county,
        reason: cause instanceof Error ? cause.message : "Analysis failed"
      });
    }
  }

  const riskLevels: Record<string, number> = {};
  const recommendations: Record<string, number> = {};
  const statuses: Record<string, number> = {};

  for (const row of rows) {
    increment(riskLevels, row.riskLevel);
    increment(recommendations, row.recommendation);
    increment(statuses, row.status);
  }

  return {
    sampledAt: new Date().toISOString(),
    total: rows.length,
    counts: {
      riskLevels,
      recommendations,
      statuses
    },
    rows,
    failures
  };
}
