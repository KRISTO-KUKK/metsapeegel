import type { Feature, Geometry } from "geojson";
import {
  datasetsForFilter,
  getAreaQueryFilter
} from "@/lib/data/sourceRegistry";
import { realDataProvider } from "@/lib/data/RealDataProvider";
import {
  findLiveForestsInBbox,
  resolveVisibleForestFeature,
  type VisibleForestProperties
} from "@/lib/data/liveForest";
import type {
  Area,
  EcosystemBenefit,
  AreaQueryFeature,
  AreaQueryFilterId,
  AreaQueryResponse,
  ForestNotice,
  ForestStand,
  ProtectedArea
} from "@/lib/types/forestry";

type RunAreaQueryInput = {
  bbox: [number, number, number, number];
  filterId: AreaQueryFilterId;
  year?: number;
  beforeYear?: number;
  ownershipForm?: string;
  minAreaHa?: number;
  maxAreaHa?: number;
  minStands?: number;
  limit?: number;
};

type CandidateResult = {
  area: Area;
  feature: Feature<Geometry, VisibleForestProperties>;
  protectedAreas?: ProtectedArea[];
  stands?: ForestStand[];
  notices?: ForestNotice[];
  ecosystemBenefits?: EcosystemBenefit[];
};

const maxCandidates = 42;

function uniqueYears(stands: ForestStand[]) {
  return Array.from(
    new Set(
      stands
        .map((stand) => stand.inventoryYear)
        .filter((year): year is number => year !== undefined)
    )
  ).sort((a, b) => b - a);
}

function resultLabel(area: Area) {
  if (area.address) {
    return `${area.address} metsaala`;
  }

  if (area.cadastralId) {
    return `Katastriüksus ${area.cadastralId}`;
  }

  return area.etakId ? `ETAK mets ${area.etakId}` : area.name;
}

function checkedSourcesForFilter(filterId: AreaQueryFilterId) {
  if (filterId === "no_protection_overlap" || filterId === "protection_overlap") {
    return ["ETAK WFS", "EELIS WFS"];
  }

  if (filterId === "ownership_form") {
    return ["ETAK WFS", "Kataster WFS"];
  }

  if (filterId === "has_wood_raw_material" || filterId === "has_carbon_storage") {
    return ["ETAK WFS", "ELME WFS"];
  }

  if (filterId === "area_larger_than" || filterId === "area_smaller_than") {
    return ["ETAK WFS"];
  }

  return ["ETAK WFS", "Kataster WFS", "Metsaregister REST"];
}

function toQueryFeature(
  result: CandidateResult,
  filterId: AreaQueryFilterId,
  matchReason: string,
  extra: Partial<AreaQueryFeature["properties"]> = {}
): AreaQueryFeature {
  return {
    type: "Feature",
    geometry: result.area.geometry,
    properties: {
      areaId: result.area.id,
      label: resultLabel(result.area),
      filterId,
      matchReason,
      areaHa: result.area.areaHa,
      etakId: result.area.etakId,
      etakFeatureId: result.area.etakFeatureId,
      etakType: result.area.etakType,
      cadastralId: result.area.cadastralId,
      ownershipForm: result.area.ownershipForm,
      checkedSources: checkedSourcesForFilter(filterId),
      ...extra
    }
  };
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

async function candidateAreas(
  bbox: [number, number, number, number],
  limit: number
): Promise<CandidateResult[]> {
  const forests = await findLiveForestsInBbox(...bbox, Math.min(limit * 3, 220));
  const features = forests.features.slice(0, Math.min(limit * 2, maxCandidates * 2));
  const resolved = await mapLimited(features, 5, async (feature) => {
    const area = await resolveVisibleForestFeature(feature).catch(() => null);
    return area ? { area, feature } : null;
  });

  return resolved
    .filter((item): item is CandidateResult => Boolean(item))
    .slice(0, limit);
}

async function matchesNoProtection(candidate: CandidateResult) {
  const protectedAreas = await realDataProvider
    .getProtectedAreas(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);

  if (protectedAreas.length > 0) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, protectedAreas },
    "no_protection_overlap",
    "Ühendatud avalikud EELIS kihid ei tagastanud sellele metsaalale kaitse-, Natura-, piirangu-, VEP- ega elupaigakattuvust.",
    {
      protectionOverlapCount: 0
    }
  );
}

async function matchesProtection(candidate: CandidateResult) {
  const protectedAreas = await realDataProvider
    .getProtectedAreas(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);

  if (protectedAreas.length === 0) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, protectedAreas },
    "protection_overlap",
    `EELIS tagastas sellele metsaalale ${protectedAreas.length} kaitse-, Natura-, piirangu-, VEP- või elupaigakattuvust.`,
    {
      protectionOverlapCount: protectedAreas.length
    }
  );
}

async function matchesInventoryYear(candidate: CandidateResult, year: number) {
  if (!candidate.area.cadastralId) {
    return null;
  }

  const stands = await realDataProvider
    .getForestStands(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);
  const years = uniqueYears(stands);

  if (!years.includes(year)) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, stands },
    "inventory_year",
    `Metsaregistri eraldiste inventuuriaastate hulgas on ${year}.`,
    {
      inventoryYears: years
    }
  );
}

async function matchesInventoryBeforeYear(candidate: CandidateResult, beforeYear: number) {
  if (!candidate.area.cadastralId) {
    return null;
  }

  const stands = await realDataProvider
    .getForestStands(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);
  const years = uniqueYears(stands);

  if (!years.some((year) => year < beforeYear)) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, stands },
    "inventory_before_year",
    `Metsaregistri eraldiste inventuuriaastate hulgas on aasta enne ${beforeYear}.`,
    {
      inventoryYears: years,
      registryStandsCount: stands.length
    }
  );
}

function normalizeOwnership(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("et");
}

function matchesOwnership(candidate: CandidateResult, ownershipForm: string) {
  const actual = normalizeOwnership(candidate.area.ownershipForm);
  const expected = normalizeOwnership(ownershipForm);
  if (!actual || !expected || actual !== expected) {
    return null;
  }

  return toQueryFeature(
    candidate,
    "ownership_form",
    `Katastri avalik omandivorm on ${candidate.area.ownershipForm}.`,
    {
      ownershipForm: candidate.area.ownershipForm
    }
  );
}

async function matchesForestNotice(candidate: CandidateResult, shouldHaveNotice: boolean) {
  if (!candidate.area.cadastralId) {
    return null;
  }

  const notices = await realDataProvider
    .getForestNotices(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);
  const matches = shouldHaveNotice ? notices.length > 0 : notices.length === 0;

  if (!matches) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, notices },
    shouldHaveNotice ? "has_forest_notice" : "no_forest_notice",
    shouldHaveNotice
      ? `Metsaregistri päring tagastas ${notices.length} metsateatist.`
      : "Metsaregistri päring ei tagastanud sellele alale metsateatist.",
    {
      forestNoticesCount: notices.length
    }
  );
}

async function matchesEcosystem(
  candidate: CandidateResult,
  filterId: "has_wood_raw_material" | "has_carbon_storage"
) {
  const ecosystemBenefits = await realDataProvider
    .getEcosystemBenefits(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);
  const category =
    filterId === "has_wood_raw_material" ? "wood_raw_material" : "carbon_storage";
  const matches = ecosystemBenefits.filter((item) => item.category === category);

  if (matches.length === 0) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, ecosystemBenefits },
    filterId,
    filterId === "has_wood_raw_material"
      ? `ELME puidutooraine kiht tagastas ${matches.length} kattuvust.`
      : `ELME süsinikuvaru kiht tagastas ${matches.length} kattuvust.`,
    {
      ecosystemOverlapCount: matches.length
    }
  );
}

async function matchesNoRegistryStands(candidate: CandidateResult) {
  if (!candidate.area.cadastralId) {
    return null;
  }

  const stands = await realDataProvider
    .getForestStands(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);

  if (stands.length > 0) {
    return null;
  }

  return toQueryFeature(
    { ...candidate, stands },
    "no_registry_stands",
    "Metsaregistri päring ei tagastanud selle katastri kaudu eraldisi.",
    {
      registryStandsCount: 0
    }
  );
}

function matchesAreaLargerThan(candidate: CandidateResult, minAreaHa: number) {
  if (candidate.area.areaHa < minAreaHa) {
    return null;
  }

  return toQueryFeature(
    candidate,
    "area_larger_than",
    `ETAK metsaala pindala on ${candidate.area.areaHa} ha ehk vähemalt ${minAreaHa} ha.`,
    {
      areaHa: candidate.area.areaHa
    }
  );
}

function matchesAreaSmallerThan(candidate: CandidateResult, maxAreaHa: number) {
  if (candidate.area.areaHa > maxAreaHa) {
    return null;
  }

  return toQueryFeature(
    candidate,
    "area_smaller_than",
    `ETAK metsaala pindala on ${candidate.area.areaHa} ha ehk kuni ${maxAreaHa} ha.`,
    {
      areaHa: candidate.area.areaHa
    }
  );
}

async function matchesManyRegistryStands(
  candidate: CandidateResult,
  minStands: number
) {
  if (!candidate.area.cadastralId) {
    return null;
  }

  const stands = await realDataProvider
    .getForestStands(candidate.area.geometry, candidate.area.id, candidate.area)
    .catch(() => []);

  if (stands.length < minStands) {
    return null;
  }

  const averageStandAreaHa =
    candidate.area.areaHa > 0
      ? Math.round((candidate.area.areaHa / stands.length) * 100) / 100
      : undefined;
  const standsPer100Ha =
    candidate.area.areaHa > 0
      ? Math.round(((stands.length / candidate.area.areaHa) * 100) * 10) / 10
      : undefined;

  return toQueryFeature(
    { ...candidate, stands },
    "many_registry_stands",
    `Metsaregister tagastas ${stands.length} eraldist, mis on vähemalt ${minStands}.`,
    {
      registryStandsCount: stands.length,
      averageStandAreaHa,
      standsPer100Ha
    }
  );
}

export async function runAreaQuery({
  bbox,
  filterId,
  year,
  beforeYear,
  ownershipForm,
  minAreaHa,
  maxAreaHa,
  minStands,
  limit = 32
}: RunAreaQueryInput): Promise<AreaQueryResponse> {
  const filter = getAreaQueryFilter(filterId);
  if (!filter) {
    throw new Error(`Unknown area query filter: ${filterId}`);
  }

  if (filterId === "inventory_year" && !year) {
    throw new Error("inventory_year filter requires year.");
  }
  if (filterId === "inventory_before_year" && !beforeYear) {
    throw new Error("inventory_before_year filter requires beforeYear.");
  }
  if (filterId === "ownership_form" && !ownershipForm) {
    throw new Error("ownership_form filter requires ownershipForm.");
  }
  if (filterId === "area_larger_than" && !minAreaHa) {
    throw new Error("area_larger_than filter requires minAreaHa.");
  }
  if (filterId === "area_smaller_than" && !maxAreaHa) {
    throw new Error("area_smaller_than filter requires maxAreaHa.");
  }
  if (filterId === "many_registry_stands" && !minStands) {
    throw new Error("many_registry_stands filter requires minStands.");
  }

  const safeLimit = Math.max(8, Math.min(maxCandidates, Math.round(limit)));
  const candidates = await candidateAreas(bbox, safeLimit);
  const matched = await mapLimited(candidates, 4, async (candidate) => {
    if (filterId === "no_protection_overlap") {
      return matchesNoProtection(candidate);
    }
    if (filterId === "protection_overlap") {
      return matchesProtection(candidate);
    }
    if (filterId === "inventory_year") {
      return matchesInventoryYear(candidate, year ?? 0);
    }
    if (filterId === "inventory_before_year") {
      return matchesInventoryBeforeYear(candidate, beforeYear ?? 0);
    }
    if (filterId === "ownership_form") {
      return matchesOwnership(candidate, ownershipForm ?? "");
    }
    if (filterId === "has_forest_notice") {
      return matchesForestNotice(candidate, true);
    }
    if (filterId === "no_forest_notice") {
      return matchesForestNotice(candidate, false);
    }
    if (filterId === "has_wood_raw_material" || filterId === "has_carbon_storage") {
      return matchesEcosystem(candidate, filterId);
    }
    if (filterId === "no_registry_stands") {
      return matchesNoRegistryStands(candidate);
    }
    if (filterId === "area_larger_than") {
      return matchesAreaLargerThan(candidate, minAreaHa ?? 0);
    }
    if (filterId === "area_smaller_than") {
      return matchesAreaSmallerThan(candidate, maxAreaHa ?? 0);
    }
    if (filterId === "many_registry_stands") {
      return matchesManyRegistryStands(candidate, minStands ?? 0);
    }

    return null;
  });
  const features = matched.filter(
    (feature): feature is AreaQueryFeature => Boolean(feature)
  );

  return {
    type: "FeatureCollection",
    features,
    query: {
      filterId,
      label: filter.label,
      bbox,
      inspectedCount: candidates.length,
      matchedCount: features.length,
      limit: safeLimit,
      scope: "current_map_view",
      year,
      beforeYear,
      ownershipForm,
      minAreaHa,
      maxAreaHa,
      minStands
    },
    datasets: datasetsForFilter(filterId),
    filter,
    caveats: [
      filter.caveat,
      "Tulemused jäävad kaardile alles, kuni kasutaja need puhastab või käivitab uue kaardifiltri."
    ]
  };
}
