import { NextRequest, NextResponse } from "next/server";
import { analyzeResolvedArea } from "@/lib/analysis/analyzeArea";
import { findLiveForestAt } from "@/lib/data/liveForest";

function parseCoordinate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export async function GET(request: NextRequest) {
  const lng = parseCoordinate(request.nextUrl.searchParams.get("lng"));
  const lat = parseCoordinate(request.nextUrl.searchParams.get("lat"));

  if (
    lng === null ||
    lat === null ||
    lng < 21 ||
    lng > 29.5 ||
    lat < 57 ||
    lat > 60.2
  ) {
    return NextResponse.json(
      { error: "Coordinates must be inside Estonia." },
      { status: 400 }
    );
  }

  try {
    const area = await findLiveForestAt(lng, lat);
    if (!area) {
      return NextResponse.json({ forest: null }, { status: 404 });
    }

    const analysis = await analyzeResolvedArea(area);
    return NextResponse.json({ analysis });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Live forest lookup failed."
      },
      { status: 502 }
    );
  }
}
