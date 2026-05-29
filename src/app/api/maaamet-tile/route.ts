import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const allowedLayers = new Set(["pohi_mvr2", "HYBRID", "mets_1", "BK_METS"]);

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEtAK5c2r+JwAAAABJRU5ErkJggg==",
  "base64"
);

function isValidBbox(value: string | null) {
  if (!value) return false;
  const parts = value.split(",").map((part) => Number(part));
  return parts.length === 4 && parts.every((part) => Number.isFinite(part));
}

function fallbackTile() {
  return new Response(transparentPng, {
    headers: {
      "Cache-Control": "public, max-age=120",
      "Content-Type": "image/png"
    }
  });
}

export async function GET(request: NextRequest) {
  const layer = request.nextUrl.searchParams.get("layer") ?? "";
  const bbox = request.nextUrl.searchParams.get("bbox");
  const transparent =
    request.nextUrl.searchParams.get("transparent") === "true";

  if (!allowedLayers.has(layer) || !isValidBbox(bbox)) {
    return fallbackTile();
  }

  const upstream = new URL("https://kaart.maaamet.ee/wms/alus-geo");
  upstream.searchParams.set("SERVICE", "WMS");
  upstream.searchParams.set("VERSION", "1.1.1");
  upstream.searchParams.set("REQUEST", "GetMap");
  upstream.searchParams.set("LAYERS", layer);
  upstream.searchParams.set("STYLES", "");
  upstream.searchParams.set("FORMAT", "image/png");
  if (transparent) {
    upstream.searchParams.set("TRANSPARENT", "TRUE");
  }
  upstream.searchParams.set("SRS", "EPSG:3857");
  upstream.searchParams.set("WIDTH", "256");
  upstream.searchParams.set("HEIGHT", "256");
  upstream.searchParams.set("BBOX", bbox ?? "");

  try {
    const response = await fetch(upstream, {
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      return fallbackTile();
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": response.headers.get("Content-Type") ?? "image/png"
      }
    });
  } catch {
    return fallbackTile();
  }
}
