import { NextRequest, NextResponse } from "next/server";
import { findLiveForestsInBbox } from "@/lib/data/liveForest";
import { appLogger } from "@/lib/logging/appLogger";

function parseBbox(value: string | null): [number, number, number, number] | null {
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [west, south, east, north] = parts;
  if (west >= east || south >= north) {
    return null;
  }

  const clippedWest = Math.max(20.5, west);
  const clippedSouth = Math.max(56.7, south);
  const clippedEast = Math.min(30, east);
  const clippedNorth = Math.min(60.5, north);

  return clippedWest < clippedEast && clippedSouth < clippedNorth
    ? [clippedWest, clippedSouth, clippedEast, clippedNorth]
    : null;
}

function parseCount(value: string | null): number {
  const count = value ? Number(value) : 650;
  if (!Number.isFinite(count)) {
    return 650;
  }

  return Math.max(120, Math.min(1800, Math.round(count)));
}

function quantizeBbox(
  bbox: [number, number, number, number]
): [number, number, number, number] {
  return bbox.map((coordinate) => Math.round(coordinate * 1000) / 1000) as [
    number,
    number,
    number,
    number
  ];
}

export async function GET(request: NextRequest) {
  const bbox = parseBbox(request.nextUrl.searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json(
      { error: "bbox must be west,south,east,north inside Estonia." },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  const count = parseCount(request.nextUrl.searchParams.get("count"));
  const queryBbox = quantizeBbox(bbox);

  try {
    const forests = await findLiveForestsInBbox(
      ...queryBbox,
      count
    );
    const elapsedMs = Date.now() - startedAt;
    appLogger.info("forests_bbox", {
      requestedCount: count,
      returnedCount: forests.features.length,
      bbox: queryBbox,
      elapsedMs
    });

    return NextResponse.json({
      ...forests,
      metadata: {
        source: "Maa- ja Ruumiamet ETAK puittaimestik WFS",
        note: "Live viewport subset; not a complete Estonia-wide index.",
        requestedCount: count,
        returnedCount: forests.features.length,
        cellCount: forests.metadata?.cellCount,
        cellRequestCount: forests.metadata?.cellRequestCount,
        rawFeatureCount: forests.metadata?.rawFeatureCount,
        uniqueFeatureCount: forests.metadata?.uniqueFeatureCount,
        bbox: queryBbox,
        elapsedMs
      }
    });
  } catch (cause) {
    appLogger.warn("forests_bbox_failed", {
      requestedCount: count,
      bbox: queryBbox,
      elapsedMs: Date.now() - startedAt,
      message: cause instanceof Error ? cause.message : String(cause)
    });
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
