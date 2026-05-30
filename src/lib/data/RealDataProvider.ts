import {
  area as turfArea,
  bbox as turfBbox,
  booleanIntersects,
  intersect
} from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon
} from "geojson";
import type { DataProvider, SatelliteSignal } from "@/lib/data/DataProvider";
import { traceSource } from "@/lib/data/sourceDiagnostics";
import { getGeometryCenter } from "@/lib/geo/centroid";
import { geometriesOverlap } from "@/lib/geo/overlap";
import type {
  Area,
  EcosystemBenefit,
  EcosystemBenefitCategory,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea,
  SearchResult
} from "@/lib/types/forestry";

type JsonObject = Record<string, unknown>;
type WfsFeature = Feature<Geometry | null, JsonObject>;
type WfsCollection = FeatureCollection<Geometry | null, JsonObject>;
type ClassifierMap = Map<string, Map<string, string>>;

type EelisLayerConfig = {
  layer: string;
  label: string;
  type: ProtectedArea["type"];
};

type ElmeLayerConfig = {
  layer: string;
  sourceId: string;
  title: string;
  category: EcosystemBenefitCategory;
  valueFields: string[];
  dataYear: number;
};

const metsaregisterWfsUrl =
  "https://gsavalik.envir.ee/geoserver/metsaregister/wfs";
const cadastreWfsUrl = "https://gsavalik.envir.ee/geoserver/kataster/wfs";
const eelisWfsUrl = "https://gsavalik.envir.ee/geoserver/eelis/ows";
const elmeWfsUrl = "https://elmegs.envir.ee/geoserver/elme/ows";
const cadastreLayer = "kataster:ky_kehtiv";
const requestTimeoutMs = 5500;
const responseCacheTtlMs = 5 * 60 * 1000;
const cadastralIdPattern = /^\d{5}:\d{3}:\d{4}$/;

const eelisLayers: EelisLayerConfig[] = [
  {
    layer: "eelis:kr_kaitseala",
    label: "Kaitseala",
    type: "protected_area"
  },
  {
    layer: "eelis:kr_hoiuala",
    label: "Hoiuala",
    type: "protected_area"
  },
  {
    layer: "eelis:kr_linnuala",
    label: "Natura linnuala",
    type: "natura"
  },
  {
    layer: "eelis:kr_loodusala",
    label: "Natura loodusala",
    type: "natura"
  },
  {
    layer: "eelis:kr_piirang",
    label: "Piiranguala",
    type: "restriction"
  },
  {
    layer: "eelis:kr_vep",
    label: "Vääriselupaik",
    type: "habitat"
  },
  {
    layer: "eelis:natura_elupaik",
    label: "Natura elupaik",
    type: "habitat"
  }
];

const elmeLayers: ElmeLayerConfig[] = [
  {
    layer: "elme:puidu_sortimendid_kogus_hind_2022",
    sourceId: "elme",
    title: "Puidutooraine hüve koguhind",
    category: "wood_raw_material",
    valueFields: ["keskm_sum_5a", "keskm_abs_hind_5a", "pindala_ha"],
    dataYear: 2022
  },
  {
    layer: "elme:metsapuiducvaru_2020",
    sourceId: "elme",
    title: "Metsa puitsesse biomassi seotud süsiniku varu",
    category: "carbon_storage",
    valueFields: ["puit_c_tha"],
    dataYear: 2020
  },
  {
    layer: "elme:puitsoost_2020",
    sourceId: "elme",
    title: "Soodelt saadava puidutooraine potentsiaal",
    category: "wood_context",
    valueFields: ["puit_tm_ha"],
    dataYear: 2020
  },
  {
    layer: "elme:puitparandniidult_2020",
    sourceId: "elme",
    title: "Pärandniitudelt saadava puidutooraine kogupotentsiaal",
    category: "wood_context",
    valueFields: ["puidutooraine_klass", "puit_tm_ha"],
    dataYear: 2020
  }
];

const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inflightRequests = new Map<string, Promise<unknown>>();

class UpstreamRequestError extends Error {
  constructor(
    message: string,
    readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = "UpstreamRequestError";
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function codeValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function roundHa(squareMeters: number): number {
  return Math.round((squareMeters / 10000) * 100) / 100;
}

function overlapPercentOfArea(overlapHa: number | undefined, areaHa?: number) {
  if (overlapHa === undefined || !areaHa || areaHa <= 0) {
    return undefined;
  }

  return Math.round((overlapHa / areaHa) * 1000) / 10;
}

function yearFromDateLike(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? year : undefined;
}

function cqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function fetchJson<T>(url: URL): Promise<T> {
  const cacheKey = url.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  const request = (async () => {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new UpstreamRequestError(
        `Request failed with ${response.status}`,
        response.status
      );
    }

    const payload = (await response.json()) as T;
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

async function fetchWfs({
  baseUrl,
  typeNames,
  bbox,
  cqlFilter,
  count = 100
}: {
  baseUrl: string;
  typeNames: string;
  bbox?: string;
  cqlFilter?: string;
  count?: number;
}): Promise<WfsCollection> {
  const url = new URL(baseUrl);
  const params = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: typeNames,
    COUNT: String(count),
    SRSNAME: "EPSG:4326",
    OUTPUTFORMAT: "application/json"
  });

  if (bbox) {
    params.set("BBOX", bbox);
  }

  if (cqlFilter) {
    params.set("CQL_FILTER", cqlFilter);
  }

  url.search = params.toString();
  return fetchJson<WfsCollection>(url);
}

function bboxForGeometry(geometry: Geometry, padding = 0.0005): string {
  const [minLng, minLat, maxLng, maxLat] = turfBbox({
    type: "Feature",
    properties: {},
    geometry
  });

  return [
    minLng - padding,
    minLat - padding,
    maxLng + padding,
    maxLat + padding,
    "EPSG:4326"
  ].join(",");
}

function cadastralIdFromAreaId(areaId?: string): string | undefined {
  if (!areaId?.startsWith("cadastre-")) {
    return undefined;
  }

  const candidate = areaId.slice("cadastre-".length);
  return cadastralIdPattern.test(candidate) ? candidate : undefined;
}

async function fetchCadastreById(cadastralId: string): Promise<WfsFeature | null> {
  const collection = await fetchWfs({
    baseUrl: cadastreWfsUrl,
    typeNames: cadastreLayer,
    cqlFilter: `tunnus='${cqlLiteral(cadastralId)}'`,
    count: 1
  });

  return collection.features.find((feature) => feature.geometry) ?? null;
}

function areaFromCadastreFeature(feature: WfsFeature): Area | null {
  if (!feature.geometry) {
    return null;
  }

  const cadastralId = stringValue(feature.properties.tunnus);
  if (!cadastralId) {
    return null;
  }

  const parcelHa =
    numberValue(feature.properties.pindala) !== undefined
      ? roundHa(numberValue(feature.properties.pindala) ?? 0)
      : roundHa(
          turfArea({
            type: "Feature",
            properties: {},
            geometry: feature.geometry
          })
        );
  const forestHa = numberValue(feature.properties.mets);
  const address = stringValue(feature.properties.l_aadress);

  return {
    id: `cadastre-${cadastralId}`,
    name: address ? `${address} (${cadastralId})` : cadastralId,
    type: "parcel",
    cadastralId,
    county: stringValue(feature.properties.mk_nimi),
    municipality: stringValue(feature.properties.ov_nimi),
    address,
    landUse: stringValue(feature.properties.siht1),
    ownershipForm: stringValue(feature.properties.omvorm),
    forestHa: forestHa === undefined ? undefined : roundHa(forestHa),
    areaHa: parcelHa,
    geometry: feature.geometry
  };
}

function classifierLabel(
  classifiers: ClassifierMap,
  kind: string,
  code: unknown
): string | undefined {
  const normalizedCode = codeValue(code);
  if (!normalizedCode) {
    return undefined;
  }

  return classifiers.get(kind)?.get(normalizedCode) ?? normalizedCode;
}

function fetchMetsaregisterStandsWfs(
  cadastralId: string
): Promise<WfsCollection> {
  return fetchWfs({
    baseUrl: metsaregisterWfsUrl,
    typeNames: "metsaregister:eraldis",
    cqlFilter: `katastri_nr='${cqlLiteral(cadastralId)}'`,
    count: 500
  });
}

function metsaregisterWfsLayerUrl(typeNames: string) {
  const url = new URL(metsaregisterWfsUrl);
  url.searchParams.set("SERVICE", "WFS");
  url.searchParams.set("REQUEST", "GetFeature");
  url.searchParams.set("TYPENAMES", typeNames);
  url.searchParams.set("OUTPUTFORMAT", "application/json");
  return url.toString();
}

function fetchMetsaregisterNoticesWfs(
  cadastralId: string,
  typeNames: "metsaregister:teatis" | "metsaregister:teatis_arhiiv"
): Promise<WfsCollection> {
  return fetchWfs({
    baseUrl: metsaregisterWfsUrl,
    typeNames,
    cqlFilter: `katastri_nr='${cqlLiteral(cadastralId)}'`,
    count: 500
  });
}

function standFromMetsaregisterWfsFeature(
  feature: WfsFeature,
  classifiers: ClassifierMap,
  areaId: string
): ForestStand | null {
  if (!feature.geometry) {
    return null;
  }

  const properties = feature.properties;
  const standNumber =
    numberValue(properties.eraldise_nr) ?? stringValue(properties.eraldise_nr);
  const cadastralId = stringValue(properties.katastri_nr) ?? areaId;
  const id =
    numberValue(properties.id) !== undefined
      ? `metsaregister-stand-${numberValue(properties.id)}`
      : `metsaregister-stand-${cadastralId}-${standNumber ?? "unknown"}`;

  return {
    id,
    areaId,
    standNumber,
    mainSpecies: classifierLabel(
      classifiers,
      "PUULIIK",
      properties.peapuuliik_kood
    ),
    developmentClass: classifierLabel(
      classifiers,
      "ARENGUKLASS",
      properties.arengukl_kood
    ),
    siteType: classifierLabel(
      classifiers,
      "KASVUKOHT",
      properties.kasvukoht_kood
    ),
    inventoryYear: yearFromDateLike(properties.invent_kp),
    averageAge: numberValue(properties.keskm_vanus),
    averageHarvestAge: numberValue(properties.keskm_raievanus),
    heightM: numberValue(properties.korgus),
    bonitetClass: codeValue(properties.boniteedi_kood),
    areaHa:
      numberValue(properties.pindala) ??
      roundHa(
        turfArea({
          type: "Feature",
          properties: {},
          geometry: feature.geometry
        })
      ),
    geometry: feature.geometry
  };
}

function noticeTypeFromCode(code: unknown): ForestNotice["type"] {
  switch (codeValue(code)) {
    case "LR":
      return "clearcut";
    case "HR":
    case "VA":
    case "VR":
      return "thinning";
    case "SR":
      return "sanitary";
    default:
      return "unknown";
  }
}

function noticeFromMetsaregisterWfsFeature(
  feature: WfsFeature,
  classifiers: ClassifierMap,
  areaId: string,
  status: ForestNotice["status"]
): ForestNotice {
  const properties = feature.properties;
  const registryNumber = stringValue(properties.teatise_nr);
  const workTypeLabel =
    classifierLabel(classifiers, "TOOLIIK_TEATIS", properties.too_kood) ??
    classifierLabel(classifiers, "TOOLIIK", properties.too_kood);
  const statusLabel = stringValue(properties.otsus);

  return {
    id:
      registryNumber ??
      `metsaregister-notice-${stringValue(feature.id) ?? crypto.randomUUID()}`,
    areaId,
    type: noticeTypeFromCode(properties.too_kood),
    status,
    registryNumber,
    workTypeLabel,
    statusLabel,
    standNumber:
      numberValue(properties.eraldise_nr) ??
      stringValue(properties.eraldise_nr),
    validUntilYear: yearFromDateLike(properties.kehtiv_kuni),
    areaHa: numberValue(properties.pindala),
    geometry: feature.geometry ?? undefined
  };
}

function isPolygonGeometry(
  geometry: Geometry
): geometry is Polygon | MultiPolygon {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

function asPolygonFeature(
  geometry: Polygon | MultiPolygon
): Feature<Polygon | MultiPolygon> {
  return {
    type: "Feature",
    properties: {},
    geometry
  };
}

function bboxesOverlap(a: Geometry, b: Geometry): boolean {
  try {
    const [aWest, aSouth, aEast, aNorth] = turfBbox({
      type: "Feature",
      properties: {},
      geometry: a
    });
    const [bWest, bSouth, bEast, bNorth] = turfBbox({
      type: "Feature",
      properties: {},
      geometry: b
    });

    return aWest <= bEast && aEast >= bWest && aSouth <= bNorth && aNorth >= bSouth;
  } catch {
    return false;
  }
}

function protectedOverlapHa(
  areaGeometry: Geometry,
  protectedGeometry: Geometry,
  selectedAreaHa?: number,
  approximate = false
): number {
  if (!isPolygonGeometry(areaGeometry) || !isPolygonGeometry(protectedGeometry)) {
    return 0;
  }

  const areaFeature = asPolygonFeature(areaGeometry);
  const protectedFeature = asPolygonFeature(protectedGeometry);

  if (approximate) {
    return bboxesOverlap(areaGeometry, protectedGeometry)
      ? Math.min(
          roundHa(turfArea(protectedFeature)),
          selectedAreaHa ?? roundHa(turfArea(areaFeature))
        )
      : 0;
  }

  try {
    const intersection = intersect({
      type: "FeatureCollection",
      features: [areaFeature, protectedFeature]
    });

    if (intersection) {
      return roundHa(turfArea(intersection));
    }
  } catch {
    // Some public geometries contain topology that Turf cannot intersect.
  }

  try {
    if (booleanIntersects(areaFeature, protectedFeature)) {
      return Math.min(roundHa(turfArea(protectedFeature)), selectedAreaHa ?? roundHa(turfArea(areaFeature)));
    }
  } catch {
    return 0;
  }

  return 0;
}

function protectedAreaFromFeature(
  feature: WfsFeature,
  layerConfig: EelisLayerConfig,
  areaGeometry: Geometry,
  selectedAreaHa?: number,
  approximateOverlap = false
): ProtectedArea | null {
  const overlaps = feature.geometry
    ? approximateOverlap
      ? bboxesOverlap(areaGeometry, feature.geometry)
      : geometriesOverlap(areaGeometry, feature.geometry)
    : false;

  if (!feature.geometry || !overlaps) {
    return null;
  }

  const properties = feature.properties;
  const code =
    stringValue(properties.kr_kood) ??
    stringValue(properties.kood) ??
    codeValue(properties.id) ??
    stringValue(feature.id) ??
    layerConfig.layer;
  const name =
    stringValue(properties.nimi) ??
    stringValue(properties.pohityyp) ??
    stringValue(properties.tyyp) ??
    stringValue(properties.tyybid) ??
    layerConfig.label;

  return {
    id: `${layerConfig.layer}-${code}`,
    name,
    type: layerConfig.type,
    publicDetailLevel: "full",
    overlapHa: protectedOverlapHa(
      areaGeometry,
      feature.geometry,
      selectedAreaHa,
      approximateOverlap
    ),
    registryCode: code,
    sourceLayer: layerConfig.layer,
    geometry: feature.geometry
  };
}

function numericLikeValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function primitiveValue(value: unknown) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function compactLayerProperties(
  properties: JsonObject,
  preferredFields: string[]
): JsonObject {
  const result: JsonObject = {};
  const preferred = [
    "kataster",
    "katastritunnus",
    "id",
    "fid",
    ...preferredFields
  ];

  for (const key of preferred) {
    if (key in properties && primitiveValue(properties[key])) {
      result[key] = properties[key];
    }
  }

  for (const [key, value] of Object.entries(properties)) {
    if (Object.keys(result).length >= 14) {
      break;
    }

    if (!(key in result) && primitiveValue(value)) {
      result[key] = value;
    }
  }

  return result;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function valueLabelFromElme(
  properties: JsonObject,
  layerConfig: ElmeLayerConfig
): string | undefined {
  if (layerConfig.layer === "elme:puidu_sortimendid_kogus_hind_2022") {
    const eurPerHa = numericLikeValue(properties.keskm_sum_5a);
    const total = numericLikeValue(properties.keskm_abs_hind_5a);

    if (eurPerHa !== undefined && total !== undefined) {
      return `${formatNumber(eurPerHa)} eur/ha, kokku ${formatNumber(total)} eur`;
    }

    if (eurPerHa !== undefined) {
      return `${formatNumber(eurPerHa)} eur/ha`;
    }
  }

  if (layerConfig.layer === "elme:metsapuiducvaru_2020") {
    const carbon = numericLikeValue(properties.puit_c_tha);
    return carbon !== undefined ? `${formatNumber(carbon)} t C/ha` : undefined;
  }

  if ("puit_tm_ha" in properties) {
    const timber = properties.puit_tm_ha;
    if (typeof timber === "string" && timber.trim()) {
      return timber;
    }

    const numericTimber = numericLikeValue(timber);
    return numericTimber !== undefined
      ? `${formatNumber(numericTimber)} tm/ha`
      : undefined;
  }

  return undefined;
}

function ecosystemBenefitFromFeature(
  feature: WfsFeature,
  layerConfig: ElmeLayerConfig,
  areaGeometry: Geometry,
  selectedAreaHa?: number,
  approximateOverlap = false
): EcosystemBenefit | null {
  const overlaps = feature.geometry
    ? approximateOverlap
      ? bboxesOverlap(areaGeometry, feature.geometry)
      : geometriesOverlap(areaGeometry, feature.geometry)
    : false;

  if (!feature.geometry || !overlaps) {
    return null;
  }

  const properties = feature.properties;
  const compactProperties = compactLayerProperties(
    properties,
    layerConfig.valueFields
  );
  const code =
    stringValue(properties.kataster) ??
    stringValue(feature.id) ??
    codeValue(properties.id) ??
    codeValue(properties.fid) ??
    crypto.randomUUID();
  const overlapHa = protectedOverlapHa(
    areaGeometry,
    feature.geometry,
    selectedAreaHa,
    approximateOverlap
  );

  return {
    id: `${layerConfig.layer}-${code}`,
    sourceId: layerConfig.sourceId,
    layerName: layerConfig.layer,
    category: layerConfig.category,
    title: layerConfig.title,
    valueLabel: valueLabelFromElme(properties, layerConfig),
    dataYear: layerConfig.dataYear,
    overlapAreaHa: overlapHa > 0 ? overlapHa : undefined,
    overlapPercentOfSelectedArea: overlapPercentOfArea(overlapHa, selectedAreaHa),
    properties: compactProperties
  };
}

export class RealDataProvider implements DataProvider {
  async searchAreas(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim();
    if (!cadastralIdPattern.test(normalizedQuery)) {
      return [];
    }

    try {
      const feature = await fetchCadastreById(normalizedQuery);
      const area = feature ? areaFromCadastreFeature(feature) : null;
      if (!area) {
        return [];
      }

      return [
        {
          id: area.id,
          label: area.name,
          type: "parcel",
          subtitle: [
            "Maa- ja Ruumiameti kataster",
            area.ownershipForm,
            area.forestHa !== undefined ? `metsamaad ${area.forestHa} ha` : null
          ]
            .filter(Boolean)
            .join(" · "),
          center: getGeometryCenter(area.geometry)
        }
      ];
    } catch {
      return [];
    }
  }

  async getAreaById(areaId: string): Promise<Area | null> {
    const cadastralId = cadastralIdFromAreaId(areaId);
    if (!cadastralId) {
      return null;
    }

    try {
      const feature = await fetchCadastreById(cadastralId);
      return feature ? areaFromCadastreFeature(feature) : null;
    } catch {
      return null;
    }
  }

  async getAreaGeometry(areaId: string): Promise<Feature<Geometry> | null> {
    const area = await this.getAreaById(areaId);
    if (!area) {
      return null;
    }

    return {
      type: "Feature",
      properties: {},
      geometry: area.geometry
    };
  }

  async getForestStands(
    areaGeometry: Geometry,
    areaId?: string,
    area?: Area
  ): Promise<ForestStand[]> {
    const cadastralId = area?.cadastralId ?? cadastralIdFromAreaId(areaId);
    if (!cadastralId) {
      return [];
    }

    const classifiers = new Map<string, Map<string, string>>();
    const resolvedAreaId = area?.id ?? areaId ?? cadastralId;

    try {
      const collection = await traceSource({
        sourceId: "metsaregister",
        sourceName: "Metsaregister",
        operation: "eraldis-wfs",
        url: metsaregisterWfsLayerUrl("metsaregister:eraldis"),
        cadastralId,
        run: () => fetchMetsaregisterStandsWfs(cadastralId),
        summarize: (value) => ({
          status: value.features.length > 0 ? "loaded" : "empty",
          returnedCount: value.features.length
        })
      });
      const stands = collection.features
        .map((feature) =>
          standFromMetsaregisterWfsFeature(
            feature,
            classifiers,
            resolvedAreaId
          )
        )
        .filter((stand): stand is ForestStand => Boolean(stand));
      const overlappingStands = stands.filter((stand) =>
        geometriesOverlap(areaGeometry, stand.geometry)
      );
      await traceSource({
        sourceId: "metsaregister",
        sourceName: "Metsaregister",
        operation: "eraldis-wfs-parse",
        cadastralId,
        run: async () => overlappingStands.length > 0 ? overlappingStands : stands,
        summarize: (value) => ({
          status: value.length > 0 ? "loaded" : "empty",
          requestedCount: collection.features.length,
          parsedCount: stands.length,
          filteredCount: overlappingStands.length,
          returnedCount: value.length,
          message:
            collection.features.length > stands.length
              ? `${collection.features.length - stands.length} WFS stand rows had no usable geometry.`
              : undefined
        })
      }).catch(() => undefined);

      return overlappingStands.length > 0 ? overlappingStands : stands;
    } catch {
      return [];
    }
  }

  async getForestNotices(
    areaGeometry: Geometry,
    areaId?: string,
    area?: Area
  ): Promise<ForestNotice[]> {
    const cadastralId = area?.cadastralId ?? cadastralIdFromAreaId(areaId);
    if (!cadastralId) {
      return [];
    }

    const classifiers = new Map<string, Map<string, string>>();
    const resolvedAreaId = area?.id ?? areaId ?? cadastralId;

    try {
      const [activeCollection, archivedCollection] = await Promise.all([
        traceSource({
          sourceId: "metsaregister",
          sourceName: "Metsaregister",
          operation: "teatis-wfs",
          url: metsaregisterWfsLayerUrl("metsaregister:teatis"),
          cadastralId,
          run: () =>
            fetchMetsaregisterNoticesWfs(cadastralId, "metsaregister:teatis"),
          summarize: (value) => ({
            status: value.features.length > 0 ? "loaded" : "empty",
            returnedCount: value.features.length
          })
        }),
        traceSource({
          sourceId: "metsaregister",
          sourceName: "Metsaregister",
          operation: "teatis-arhiiv-wfs",
          url: metsaregisterWfsLayerUrl("metsaregister:teatis_arhiiv"),
          cadastralId,
          run: () =>
            fetchMetsaregisterNoticesWfs(
              cadastralId,
              "metsaregister:teatis_arhiiv"
            ),
          summarize: (value) => ({
            status: value.features.length > 0 ? "loaded" : "empty",
            returnedCount: value.features.length
          })
        })
      ]);

      const notices = [
        ...activeCollection.features.map((feature) =>
          noticeFromMetsaregisterWfsFeature(
            feature,
            classifiers,
            resolvedAreaId,
            "active"
          )
        ),
        ...archivedCollection.features.map((feature) =>
          noticeFromMetsaregisterWfsFeature(
            feature,
            classifiers,
            resolvedAreaId,
            "archived"
          )
        )
      ];
      const overlappingNotices = notices.filter(
        (notice) =>
          !notice.geometry || geometriesOverlap(areaGeometry, notice.geometry)
      );
      await traceSource({
        sourceId: "metsaregister",
        sourceName: "Metsaregister",
        operation: "teatis-wfs-parse",
        cadastralId,
        run: async () =>
          overlappingNotices.length > 0 ? overlappingNotices : notices,
        summarize: (value) => ({
          status: value.length > 0 ? "loaded" : "empty",
          requestedCount:
            activeCollection.features.length + archivedCollection.features.length,
          parsedCount: notices.length,
          filteredCount: overlappingNotices.length,
          returnedCount: value.length
        })
      }).catch(() => undefined);

      return overlappingNotices.length > 0 ? overlappingNotices : notices;
    } catch {
      return [];
    }
  }

  async getForestChanges(
    _areaGeometry: Geometry,
    _areaId?: string,
    _area?: Area
  ): Promise<ForestChange[]> {
    return [];
  }

  async getProtectedAreas(
    areaGeometry: Geometry,
    _areaId?: string,
    area?: Area
  ): Promise<ProtectedArea[]> {
    const bbox = bboxForGeometry(areaGeometry);
    const approximateOverlap = (area?.areaHa ?? 0) >= 750;
    const layerResults = await Promise.all(
      eelisLayers.map(async (layerConfig) => {
        try {
          const collection = await fetchWfs({
            baseUrl: eelisWfsUrl,
            typeNames: layerConfig.layer,
            bbox,
            count: 80
          });

          return collection.features
            .map((feature) =>
              protectedAreaFromFeature(
                feature,
                layerConfig,
                areaGeometry,
                area?.areaHa,
                approximateOverlap
              )
            )
            .filter((item): item is ProtectedArea => Boolean(item));
        } catch {
          return [];
        }
      })
    );
    const byId = new Map<string, ProtectedArea>();

    for (const item of layerResults.flat()) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values()).slice(0, 40);
  }

  async getEcosystemBenefits(
    areaGeometry: Geometry,
    _areaId?: string,
    area?: Area
  ): Promise<EcosystemBenefit[]> {
    const bbox = bboxForGeometry(areaGeometry);
    const approximateOverlap = (area?.areaHa ?? 0) >= 750;
    const layerResults = await Promise.all(
      elmeLayers.map(async (layerConfig) => {
        try {
          const collection = await fetchWfs({
            baseUrl: elmeWfsUrl,
            typeNames: layerConfig.layer,
            bbox,
            count: 80
          });

          return collection.features
            .map((feature) =>
              ecosystemBenefitFromFeature(
                feature,
                layerConfig,
                areaGeometry,
                area?.areaHa,
                approximateOverlap
              )
            )
            .filter((item): item is EcosystemBenefit => Boolean(item));
        } catch {
          return [];
        }
      })
    );
    const byId = new Map<string, EcosystemBenefit>();

    for (const item of layerResults.flat()) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values()).slice(0, 80);
  }

  async getSatelliteSignal(_areaId: string): Promise<SatelliteSignal | null> {
    return null;
  }
}

export const realDataProvider = new RealDataProvider();
