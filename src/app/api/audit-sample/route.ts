import { NextRequest, NextResponse } from "next/server";
import { buildAuditSample } from "@/lib/audit/sampleForests";

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  const perCounty = boundedInt(
    request.nextUrl.searchParams.get("perCounty"),
    1,
    1,
    2
  );
  const maxSamples = boundedInt(
    request.nextUrl.searchParams.get("maxSamples"),
    12,
    3,
    30
  );

  try {
    const sample = await buildAuditSample({ perCounty, maxSamples });
    return NextResponse.json(sample);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Audit sample failed."
      },
      { status: 500 }
    );
  }
}
