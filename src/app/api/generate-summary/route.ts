import { NextResponse } from "next/server";
import { generateAiNarrative } from "@/lib/ai/narrative";
import { summaryForStatus } from "@/lib/analysis/summaryTemplates";
import type {
  AnalysisStatus,
  EvidenceItem,
  PublicAudit
} from "@/lib/types/forestry";

const validStatuses: AnalysisStatus[] = [
  "documented_harvest",
  "unexplained_change",
  "planned_activity",
  "outdated_data",
  "protected_context",
  "no_major_change",
  "insufficient_data"
];

function isPublicAudit(value: unknown): value is PublicAudit {
  return Boolean(
    value &&
      typeof value === "object" &&
      "riskScore" in value &&
      "disclosureRecommendation" in value
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const status = body?.status as AnalysisStatus | undefined;
  const safeStatus =
    status && validStatuses.includes(status) ? status : "insufficient_data";

  if (!isPublicAudit(body?.publicAudit)) {
    return NextResponse.json({
      mode: "template",
      summary: summaryForStatus(safeStatus),
      note:
        "AI endpoint on valmis, kuid vajab publicAudit sisendit. Reeglid, mitte AI, otsustavad järelduse."
    });
  }

  const narrative = await generateAiNarrative({
    status: safeStatus,
    headline: typeof body?.headline === "string" ? body.headline : "",
    summary:
      typeof body?.summary === "string"
        ? body.summary
        : summaryForStatus(safeStatus),
    whatHappened: Array.isArray(body?.whatHappened) ? body.whatHappened : [],
    missingInfo: Array.isArray(body?.missingInfo) ? body.missingInfo : [],
    warnings: Array.isArray(body?.warnings) ? body.warnings : [],
    evidence: Array.isArray(body?.evidence)
      ? (body.evidence as EvidenceItem[])
      : [],
    publicAudit: body.publicAudit
  });

  return NextResponse.json(narrative);
}
