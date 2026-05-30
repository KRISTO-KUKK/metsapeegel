import { NextRequest, NextResponse } from "next/server";
import type { Geometry } from "geojson";
import { findSentinelComparisonImages } from "@/lib/data/sentinelComparison";

export const dynamic = "force-dynamic";

function isGeometry(value: unknown): value is Geometry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof (value as { type?: unknown }).type === "string"
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must include selected area geometry." },
      { status: 400 }
    );
  }

  const geometry =
    payload && typeof payload === "object" && "geometry" in payload
      ? (payload as { geometry?: unknown }).geometry
      : undefined;

  if (!isGeometry(geometry)) {
    return NextResponse.json(
      { error: "Request body must include valid GeoJSON geometry." },
      { status: 400 }
    );
  }

  try {
    const result = await findSentinelComparisonImages(geometry);
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Sentinel võrdluspiltide otsing ebaõnnestus."
      },
      { status: 502 }
    );
  }
}