import type {
  AiNarrative,
  AnalysisResult,
  AnalysisStatus,
  Area,
  DataSourceRef,
  EvidenceItem,
  ForestAreaEvidencePackage,
  NormalizedSelectedAreaEvidence,
  TimelineEvent
} from "@/lib/types/forestry";

export const CADASTRE_SUMMARY_FORMAT = "metsapeegel-cadastre-summary" as const;
export const CADASTRE_SUMMARY_VERSION = "1" as const;

export type CadastreSummaryExport = {
  format: typeof CADASTRE_SUMMARY_FORMAT;
  version: typeof CADASTRE_SUMMARY_VERSION;
  exportedAt: string;
  cadastralId: string;
  area: Area;
  status: AnalysisStatus;
  confidenceScore: number;
  headline: string;
  summary: string;
  whatHappened: string[];
  warnings: string[];
  missingInfo: string[];
  aiNarrative: AiNarrative;
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  evidencePackage: ForestAreaEvidencePackage;
  normalizedEvidence: NormalizedSelectedAreaEvidence;
  sources: DataSourceRef[];
  rawFacts: Record<string, unknown>;
};

function cadastralIdForExport(analysis: AnalysisResult): string {
  return (
    analysis.area.cadastralId ??
    analysis.evidencePackage.cadastre.cadastralIds[0] ??
    analysis.normalizedEvidence.area.cadastralId ??
    analysis.area.id.replace(/^cadastre-/, "")
  );
}

function summaryFilename(cadastralId: string, exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  const safeId = cadastralId.replace(/:/g, "_");
  return `kataster-${safeId}-${date}.json`;
}

export function buildCadastreSummary(
  analysis: AnalysisResult,
  exportedAt: string = new Date().toISOString()
): CadastreSummaryExport {
  const cadastralId = cadastralIdForExport(analysis);

  return {
    format: CADASTRE_SUMMARY_FORMAT,
    version: CADASTRE_SUMMARY_VERSION,
    exportedAt,
    cadastralId,
    area: analysis.area,
    status: analysis.status,
    confidenceScore: analysis.confidenceScore,
    headline: analysis.headline,
    summary: analysis.summary,
    whatHappened: analysis.whatHappened,
    warnings: analysis.warnings,
    missingInfo: analysis.missingInfo,
    aiNarrative: analysis.aiNarrative,
    timeline: analysis.timeline,
    evidence: analysis.evidence,
    evidencePackage: analysis.evidencePackage,
    normalizedEvidence: analysis.normalizedEvidence,
    sources: analysis.sources,
    rawFacts: analysis.rawFacts
  };
}

export function downloadCadastreSummary(analysis: AnalysisResult): void {
  const exportedAt = new Date().toISOString();
  const summary = buildCadastreSummary(analysis, exportedAt);
  const json = JSON.stringify(summary, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = summaryFilename(summary.cadastralId, exportedAt);
  link.click();
  URL.revokeObjectURL(url);
}
