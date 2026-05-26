import { NextResponse } from "next/server";
import type { AnalysisStatus } from "@/lib/types/forestry";
import { summaryForStatus } from "@/lib/analysis/summaryTemplates";

const validStatuses: AnalysisStatus[] = [
  "documented_harvest",
  "unexplained_change",
  "planned_activity",
  "outdated_data",
  "protected_context",
  "no_major_change",
  "insufficient_data"
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const status = body?.status as AnalysisStatus | undefined;
  const safeStatus =
    status && validStatuses.includes(status) ? status : "insufficient_data";

  return NextResponse.json({
    mode: "template",
    summary: summaryForStatus(safeStatus),
    note: "OPENAI_API_KEY puudumisel kasutab MVP mallteksti. Reeglid, mitte AI, otsustavad järelduse."
  });
}
