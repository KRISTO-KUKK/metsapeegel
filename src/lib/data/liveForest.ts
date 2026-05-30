import {
  area as turfArea,
  bbox as turfBbox,
  booleanPointInPolygon,
  point
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Point,
  Polygon
} from "geojson";
import type { Area } from "@/lib/types/forestry";

type WfsFeature = Feature<Geometry | null, Record<string, unknown>>;
type WfsCollection = FeatureCollection<Geometry | null, Record<string, unknown>>;
export type VisibleForestProperties = {
  etakId?: number;
  etakFeatureId?: string;
  etakType?: string;
  areaHa?: number;
};
export type VisibleForestCollection = FeatureCollection<
  Geometry,
  VisibleForestProperties
> & {
  metadata?: {
    cellCount: number;
    cellRequestCount: number;
    rawFeatureCount: number;
    uniqueFeatureCount: number;
  };
};

type CadastreContext = {
  cadastralId?: string;
  county?: string;
  municipality?: string;
  address?: string;
  landUse?: string;
  ownershipForm?: string;
};

const etakWfsUrl = "https://gsavalik.envir.ee/geoserver/etak/wfs";
const cadastreWfsUrl = "https://gsavalik.envir.ee/geoserver/kataster/wfs";
const etakLayer = "etak:e_305_puittaimestik_a";
const cadastreLayer = "kataster:ky_kehtiv";
const requestTimeoutMs = 6500;
const responseCacheTtlMs = 5 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; value: WfsCollection }>();
const inflightRequests = new Map<string, Promise<WfsCollection>>();

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function roundHa(squareMeters: number): number {
  return Math.round((squareMeters / 10000) * 100) / 100;
}

function bboxAround(lng: number, lat: number, delta = 0.0007): string {
  return [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
    "EPSG:4326"
  ].join(",");
}

function bboxString(
  west: number,
  south: number,
  east: number,
  north: number
): string {
  return [west, south, east, north, "EPSG:4326"].join(",");
}

function splitBbox(
  west: number,
  south: number,
  east: number,
  north: number
) {
  const width = east - west;
  const height = north - south;
  const targetCellWidth = width > 4 ? 0.9 : width > 2 ? 0.65 : 0.45;
  const targetCellHeight = height > 1.6 ? 0.55 : height > 0.8 ? 0.45 : 0.35;
  let columns = Math.max(1, Math.min(8, Math.ceil(width / targetCellWidth)));
  let rows = Math.max(1, Math.min(5, Math.ceil(height / targetCellHeight)));

  while (columns * rows > 24) {
    if (columns >= rows && columns > 1) {
      columns -= 1;
    } else if (rows > 1) {
      rows -= 1;
    } else {
      break;
    }
  }

  const cells: Array<[number, number, number, number]> = [];

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cellWest = west + (width * column) / columns;
      const cellEast = west + (width * (column + 1)) / columns;
      const cellSouth = south + (height * row) / rows;
      const cellNorth = south + (height * (row + 1)) / rows;
      cells.push([cellWest, cellSouth, cellEast, cellNorth]);
    }
  }

  return cells;
}

async function fetchWfs(
  baseUrl: string,
  layer: string,
  bbox: string,
  count: number
): Promise<WfsCollection> {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: layer,
    COUNT: String(count),
    SRSNAME: "EPSG:4326",
    OUTPUTFORMAT: "application/json",
    BBOX: bbox
  }).toString();

  const cacheKey = url.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  const request = (async () => {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`WFS request failed with ${response.status}`);
    }

    const payload = (await response.json()) as WfsCollection;
    responseCache.set(cacheKey, {
      expiresAt: Date.now() + responseCacheTtlMs,
      value: payload
    });
    return payload;
  })();

  inflightRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    clearTimeout(timeout);
    inflightRequests.delete(cacheKey);
  }
}

function isForestFeature(feature: WfsFeature): boolean {
  return (
    feature.geometry !== null &&
    (feature.properties.tyyp_tekst === "Mets" || feature.properties.tyyp === 10)
  );
}

function containsPoint(feature: WfsFeature, pointFeature: Feature<Point>): boolean {
  if (
    feature.geometry?.type !== "Polygon" &&
    feature.geometry?.type !== "MultiPolygon"
  ) {
    return false;
  }

  try {
    return booleanPointInPolygon(
      pointFeature,
      feature as Feature<Polygon | MultiPolygon, Record<string, unknown>>
    );
  } catch {
    return false;
  }
}

function areaFromEtakFeature(
  feature: WfsFeature,
  cadastre: CadastreContext | null
): Area | null {
  if (!feature.geometry) {
    return null;
  }

  const etakId = numberValue(feature.properties.etak_id);
  const fid = numberValue(feature.properties.fid);
  const etakFeatureId = stringValue(feature.id);
  const areaHa = roundHa(
    turfArea({
      type: "Feature",
      properties: {},
      geometry: feature.geometry
    })
  );
  const address = cadastre?.address;

  return {
    id: `live-etak-${etakId ?? fid ?? etakFeatureId ?? Date.now()}`,
    name: address ? `${address} metsaala` : `ETAK mets ${etakId ?? fid ?? ""}`,
    type: "forest",
    cadastralId: cadastre?.cadastralId,
    county: cadastre?.county,
    municipality: cadastre?.municipality,
    address,
    landUse: cadastre?.landUse,
    ownershipForm: cadastre?.ownershipForm,
    forestHa: areaHa,
    etakId,
    etakFeatureId,
    etakType: stringValue(feature.properties.tyyp_tekst),
    etakModifiedAt: stringValue(feature.properties.muutmisaeg),
    etakGeometryModifiedAt: stringValue(feature.properties.geom_muutmisaeg),
    dataSource:
      "Live Maa- ja Ruumiamet ETAK puittaimestik WFS click lookup; cadastre WFS adds public parcel context.",
    areaHa,
    geometry: feature.geometry
  };
}

function visibleFeatureFromEtak(
  feature: WfsFeature
): Feature<Geometry, VisibleForestProperties> | null {
  if (!isForestFeature(feature) || !feature.geometry) {
    return null;
  }

  const etakId = numberValue(feature.properties.etak_id);
  const fid = numberValue(feature.properties.fid);
  const etakFeatureId = stringValue(feature.id);

  return {
    type: "Feature",
    id: etakId ?? fid ?? etakFeatureId,
    properties: {
      etakId,
      etakFeatureId,
      etakType: stringValue(feature.properties.tyyp_tekst),
      areaHa: roundHa(
        turfArea({
          type: "Feature",
          properties: {},
          geometry: feature.geometry
        })
      )
    },
    geometry: feature.geometry
  };
}

function cadastreFromFeature(feature: WfsFeature): CadastreContext {
  return {
    cadastralId: stringValue(feature.properties.tunnus),
    county: stringValue(feature.properties.mk_nimi),
    municipality: stringValue(feature.properties.ov_nimi),
    address: stringValue(feature.properties.l_aadress),
    landUse: stringValue(feature.properties.siht1),
    ownershipForm: stringValue(feature.properties.omvorm)
  };
}

async function findCadastreAt(lng: number, lat: number): Promise<CadastreContext | null> {
  const collection = await fetchWfs(
    cadastreWfsUrl,
    cadastreLayer,
    bboxAround(lng, lat, 0.00045),
    8
  );
  const pointFeature = point([lng, lat]);
  const containingFeature =
    collection.features.find((feature) => containsPoint(feature, pointFeature)) ??
    null;

  return containingFeature ? cadastreFromFeature(containingFeature) : null;
}

function visibleAreaFromFeature(
  feature: Feature<Geometry, VisibleForestProperties>,
  cadastre: CadastreContext | null
): Area | null {
  if (!feature.geometry) {
    return null;
  }

  const etakId = numberValue(feature.properties.etakId);
  const etakFeatureId = stringValue(feature.properties.etakFeatureId);
  const areaHa =
    numberValue(feature.properties.areaHa) ??
    roundHa(
      turfArea({
        type: "Feature",
        properties: {},
        geometry: feature.geometry
      })
    );
  const address = cadastre?.address;

  return {
    id: `query-etak-${etakId ?? etakFeatureId ?? JSON.stringify(feature.geometry).slice(0, 30)}`,
    name: address ? `${address} metsaala` : `ETAK mets ${etakId ?? etakFeatureId ?? ""}`,
    type: "forest",
    cadastralId: cadastre?.cadastralId,
    county: cadastre?.county,
    municipality: cadastre?.municipality,
    address,
    landUse: cadastre?.landUse,
    ownershipForm: cadastre?.ownershipForm,
    forestHa: areaHa,
    etakId,
    etakFeatureId,
    etakType: stringValue(feature.properties.etakType),
    dataSource:
      "Maa- ja Ruumiameti ETAK WFS kaardivaate päring; katastri kontekst leitakse geomeetria keskpunkti järgi.",
    areaHa,
    geometry: feature.geometry
  };
}

export async function resolveVisibleForestFeature(
  feature: Feature<Geometry, VisibleForestProperties>
): Promise<Area | null> {
  if (!feature.geometry) {
    return null;
  }

  const [west, south, east, north] = turfBbox({
    type: "Feature",
    properties: {},
    geometry: feature.geometry
  });
  const cadastre = await findCadastreAt(
    (west + east) / 2,
    (south + north) / 2
  ).catch(() => null);

  return visibleAreaFromFeature(feature, cadastre);
}

export async function findLiveForestAt(
  lng: number,
  lat: number
): Promise<Area | null> {
  const collection = await fetchWfs(
    etakWfsUrl,
    etakLayer,
    bboxAround(lng, lat),
    24
  );
  const pointFeature = point([lng, lat]);
  const forestFeature =
    collection.features
      .filter(isForestFeature)
      .find((feature) => containsPoint(feature, pointFeature)) ?? null;

  if (!forestFeature) {
    return null;
  }

  const cadastre = await findCadastreAt(lng, lat);
  return areaFromEtakFeature(forestFeature, cadastre);
}

export async function findLiveForestsInBbox(
  west: number,
  south: number,
  east: number,
  north: number,
  count = 450
): Promise<VisibleForestCollection> {
  const cells = splitBbox(west, south, east, north);
  const cellCount = Math.max(90, Math.min(520, Math.ceil((count / cells.length) * 1.35)));
  const collections = await Promise.allSettled(
    cells.map((cell) =>
      fetchWfs(
        etakWfsUrl,
        etakLayer,
        bboxString(...cell),
        cellCount
      )
    )
  );
  const features = collections
    .flatMap((result) =>
      result.status === "fulfilled" ? result.value.features : []
    )
    .map(visibleFeatureFromEtak)
    .filter(
      (feature): feature is Feature<Geometry, VisibleForestProperties> =>
        feature !== null
    );
  const uniqueFeatures = new Map<string, Feature<Geometry, VisibleForestProperties>>();

  for (const feature of features) {
    const key =
      feature.properties.etakId?.toString() ??
      feature.properties.etakFeatureId ??
      JSON.stringify(feature.geometry).slice(0, 120);
    if (!uniqueFeatures.has(key)) {
      uniqueFeatures.set(key, feature);
    }
  }

  return {
    type: "FeatureCollection",
    features: Array.from(uniqueFeatures.values()).slice(0, count),
    metadata: {
      cellCount: cells.length,
      cellRequestCount: cellCount,
      rawFeatureCount: features.length,
      uniqueFeatureCount: uniqueFeatures.size
    }
  };
}
