import { NextRequest, NextResponse } from "next/server";
import { findLiveForestsInBbox } from "@/lib/data/liveForest";

function parseBbox(value: string | null): [number, number, number, number] | null {
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [west, south, east, north] = parts;
  const insideEstoniaEnvelope =
    west >= 20.5 &&
    east <= 30 &&
    south >= 56.7 &&
    north <= 60.5 &&
    west < east &&
    south < north;

  return insideEstoniaEnvelope ? [west, south, east, north] : null;
}

function parseCount(value: string | null): number {
  const count = value ? Number(value) : 650;
  if (!Number.isFinite(count)) {
    return 650;
  }

  return Math.max(150, Math.min(1800, Math.round(count)));
}

export async function GET(request: NextRequest) {
  const bbox = parseBbox(request.nextUrl.searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json(
      { error: "bbox must be west,south,east,north inside Estonia." },
      { status: 400 }
    );
  }

  try {
    const forests = await findLiveForestsInBbox(
      ...bbox,
      parseCount(request.nextUrl.searchParams.get("count"))
    );
    return NextResponse.json({
      ...forests,
      metadata: {
        source: "Maa- ja Ruumiamet ETAK puittaimestik WFS",
        note: "Live viewport subset; not a complete Estonia-wide index."
      }
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Visible forest lookup failed."
      },
      { status: 502 }
    );
  }
}
