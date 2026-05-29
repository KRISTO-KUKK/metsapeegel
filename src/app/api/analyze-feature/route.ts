import { NextRequest, NextResponse } from "next/server";
import type { Feature, Geometry } from "geojson";
import { analyzeResolvedArea } from "@/lib/analysis/analyzeArea";
import {
  resolveVisibleForestFeature,
  type VisibleForestProperties
} from "@/lib/data/liveForest";

type FeaturePayload = Feature<Geometry, VisibleForestProperties>;

function isFeaturePayload(value: unknown): value is FeaturePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<FeaturePayload>;
  return (
    candidate.type === "Feature" &&
    Boolean(candidate.geometry) &&
    typeof candidate.geometry === "object"
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be a GeoJSON feature." },
      { status: 400 }
    );
  }

  const featureCandidate =
    payload && typeof payload === "object" && "feature" in payload
      ? (payload as { feature?: unknown }).feature
      : payload;

  if (!isFeaturePayload(featureCandidate)) {
    return NextResponse.json(
      { error: "Request body must include a valid GeoJSON feature." },
      { status: 400 }
    );
  }

  try {
    const area = await resolveVisibleForestFeature(featureCandidate);
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
            : "Visible forest analysis failed."
      },
      { status: 502 }
    );
  }
}
