import type { SatelliteSignal } from "@/lib/data/DataProvider";
import type { DataProvider } from "@/lib/data/DataProvider";
import { bbox as turfBbox } from "@turf/turf";
import { realDataProvider } from "@/lib/data/RealDataProvider";
import {
  calculateConfidence,
  isInventoryOutdated,
  REFERENCE_YEAR
} from "@/lib/analysis/confidence";
import {
  determineStatus,
  getMissingInfo,
  getWarnings
} from "@/lib/analysis/rules";
import {
  headlineForStatus,
  summaryForStatus
} from "@/lib/analysis/summaryTemplates";
import { buildPublicAudit } from "@/lib/analysis/publicAudit";
import { generateAiNarrative } from "@/lib/ai/narrative";
import { normalizeSelectedAreaEvidence } from "@/lib/analysis/normalizeSelectedAreaEvidence";
import {
  currentSourceDiagnostics,
  recordSourceDiagnostic,
  withSourceDiagnostics
} from "@/lib/data/sourceDiagnostics";
import type {
  Area,
  AnalysisResult,
  DataCatalogEntry,
  DataSourceRef,
  EvidenceSource,
  EvidenceItem,
  EcosystemBenefit,
  ForestAreaEvidencePackage,
  ForestChange,
  ForestNotice,
  ForestStand,
  MissingEvidence,
  PriorityBlock,
  PrioritizedInsight,
  ProtectedArea,
  SourceDiagnostic,
  SpatialOverlap,
  TimelineEvent
} from "@/lib/types/forestry";

const noticeLabels: Record<ForestNotice["type"], string> = {
  clearcut: "lageraie",
  thinning: "harvendusraie",
  sanitary: "sanitaarraie",
  damage: "metsakahjustus",
  unknown: "täpsustamata teatis"
};

const changeLabels: Record<ForestChange["changeType"], string> = {
  height_decrease: "metsakõrguse vähenemine",
  vegetation_loss: "taimkatte vähenemine",
  possible_damage: "võimalik kahjustus",
  unknown: "täpsustamata muutus"
};

const analysisCacheTtlMs = 5 * 60 * 1000;
const analysisCache = new Map<
  string,
  { expiresAt: number; value: AnalysisResult }
>();

const maaametMapUrl = "https://xgis.maaamet.ee/xgis2/page/app/maainfo";
const metsaregisterUrl = "https://register.metsad.ee";
const keskkonnaRegisterUrl = "https://register.keskkonnaportaal.ee/register";
const looduseHuvedUrl = "https://keskkonnaportaal.ee/et/teemad/loodushuved";

function cadastreSourceUrl(cadastralId?: string) {
  return cadastralId
    ? `https://ky.kataster.ee/ky/${encodeURIComponent(cadastralId)}`
    : "https://ky.kataster.ee/";
}

function areaCenter(area: Area) {
  const [west, south, east, north] = turfBbox({
    type: "Feature",
    properties: {},
    geometry: area.geometry
  });

  return {
    lon: (west + east) / 2,
    lat: (south + north) / 2,
    west,
    south,
    east,
    north
  };
}

function areaScale(area: Area) {
  const center = areaCenter(area);
  const latRadians = (center.lat * Math.PI) / 180;
  const lonMeters = Math.abs(center.east - center.west) * 111_320 * Math.cos(latRadians);
  const latMeters = Math.abs(center.north - center.south) * 110_540;
  const spanMeters = Math.max(lonMeters, latMeters, 500);

  return Math.round(Math.min(100_000, Math.max(2_000, spanMeters * 4)));
}

function maaametSourceUrl(area: Area, tooltip: string) {
  const center = areaCenter(area);
  const url = new URL(maaametMapUrl);
  url.searchParams.set("lat", center.lat.toFixed(6));
  url.searchParams.set("lon", center.lon.toFixed(6));
  url.searchParams.set("moot", String(areaScale(area)));
  url.searchParams.set("tooltip", tooltip);
  return url.toString();
}

function etakSourceUrl(area: Area) {
  if (area.type === "parcel") {
    return cadastreSourceUrl(area.cadastralId);
  }

  return maaametSourceUrl(
    area,
    area.etakId ? `ETAK metsaala ${area.etakId}` : "Valitud metsaala"
  );
}

function numericIdFromSourceId(id: string, prefix: string) {
  return id.match(new RegExp(`^${prefix}-(\\d+)`))?.[1];
}

function metsaregisterSourceUrl(
  cadastralId?: string,
  stands: ForestStand[] = [],
  notices: ForestNotice[] = []
) {
  const standId = stands
    .map((stand) => numericIdFromSourceId(stand.id, "metsaregister-stand"))
    .find((id): id is string => Boolean(id));
  if (standId) {
    return `${metsaregisterUrl}/eraldis/${encodeURIComponent(standId)}`;
  }

  const noticeId = notices
    .map((notice) => numericIdFromSourceId(notice.id, "metsaregister-notice"))
    .find((id): id is string => Boolean(id));
  if (noticeId) {
    return `${metsaregisterUrl}/teatis/${encodeURIComponent(noticeId)}`;
  }

  if (!cadastralId) {
    return `${metsaregisterUrl}/otsiEraldis`;
  }

  const url = new URL(`${metsaregisterUrl}/otsiEraldis`);
  url.searchParams.set("katastriNr", cadastralId);
  return url.toString();
}

function eelisRegisterCode(protectedAreas: ProtectedArea[]) {
  const codePattern = /\b[A-ZÕÄÖÜ]{2,8}\d{3,}\b/i;
  return protectedAreas
    .map((item) => item.registryCode ?? item.id.match(codePattern)?.[0])
    .find((code): code is string => Boolean(code && codePattern.test(code)));
}

function eelisSourceUrl(protectedAreas: ProtectedArea[]) {
  const code = eelisRegisterCode(protectedAreas);
  if (!code) {
    return keskkonnaRegisterUrl;
  }

  const url = new URL(keskkonnaRegisterUrl);
  url.searchParams.set("kkr_kood", code);
  url.searchParams.set("mount", "view");
  return url.toString();
}

function elmeSourceUrl() {
  return looduseHuvedUrl;
}
const partialAnalysisResults = new WeakSet<AnalysisResult>();

function analysisCacheKeys(area: Area) {
  return [
    area.cadastralId ? `cadastre:${area.cadastralId}` : null,
    area.etakId ? `etak:${area.etakId}` : null,
    area.etakFeatureId ? `etak-feature:${area.etakFeatureId}` : null,
    `area:${area.id}`
  ]
    .filter((key): key is string => Boolean(key));
}

function cachedAnalysis(area: Area): AnalysisResult | null {
  for (const key of analysisCacheKeys(area)) {
    const cached = analysisCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  return null;
}

function rememberAnalysis(area: Area, value: AnalysisResult) {
  const cached = {
    expiresAt: Date.now() + analysisCacheTtlMs,
    value
  };

  for (const key of analysisCacheKeys(area)) {
    analysisCache.set(key, cached);
  }
}

async function withAnalysisTimeout<T>({
  label,
  promise,
  fallback,
  timeoutMs,
  timedOutSources,
  sourceId,
  sourceName
}: {
  label: string;
  promise: Promise<T>;
  fallback: T;
  timeoutMs: number;
  timedOutSources: string[];
  sourceId?: string;
  sourceName?: string;
}): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const guardedPromise = promise.catch(() => fallback);
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      timedOutSources.push(label);
      recordSourceDiagnostic({
        sourceId: sourceId ?? label,
        sourceName: sourceName ?? label,
        operation: label,
        status: "timeout",
        startedAt: new Date(Date.now() - timeoutMs).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: timeoutMs,
        message: `Analysis fallback used after ${timeoutMs} ms timeout.`
      });
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([guardedPromise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function buildEvidence({
  stands,
  notices,
  changes,
  protectedAreas,
  ecosystemBenefits,
  satelliteSignal
}: {
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  ecosystemBenefits: EcosystemBenefit[];
  satelliteSignal: SatelliteSignal | null;
}): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  for (const stand of stands) {
    evidence.push({
      id: stand.id,
      kind: "registry",
      tone: isInventoryOutdated(stand) ? "warning" : "success",
      title: stand.standNumber
        ? `Metsaregistri eraldis ${stand.standNumber}`
        : "Metsaregistri eraldis",
      description: [
        stand.mainSpecies ? `Peamine puuliik: ${stand.mainSpecies}.` : null,
        stand.developmentClass ? `Arenguklass: ${stand.developmentClass}.` : null,
        stand.siteType ? `Kasvukohatüüp: ${stand.siteType}.` : null,
        stand.averageAge !== undefined
          ? `Puistu keskmine vanus: ${stand.averageAge} a.`
          : null,
        stand.averageHarvestAge !== undefined
          ? `Keskmine raievanus: ${stand.averageHarvestAge} a.`
          : null,
        stand.inventoryYear
          ? `Inventuuriaasta: ${stand.inventoryYear}.`
          : "Inventuuriaasta puudub."
      ]
        .filter(Boolean)
        .join(" "),
      year: stand.inventoryYear
    });
  }

  for (const notice of notices) {
    const noticeLabel = notice.workTypeLabel ?? noticeLabels[notice.type];
    const statusLabel = notice.statusLabel ? ` Staatus: ${notice.statusLabel}.` : "";
    const numberLabel = notice.registryNumber
      ? ` Teatise nr ${notice.registryNumber}.`
      : "";

    evidence.push({
      id: notice.id,
      kind: "registry",
      tone: "success",
      title: "Metsateatis",
      description: `Metsateatis tähendab, et selle katastriüksuse kohta on riigile ametlikult teatatud kavandatavast raiest, raadamisest või metsakahjustusest. Töö liik: ${noticeLabel}.${statusLabel}${numberLabel}`,
      year: notice.submittedYear ?? notice.validUntilYear
    });
  }

  for (const change of changes) {
    evidence.push({
      id: change.id,
      kind: "remote_sensing",
      tone: notices.length > 0 ? "success" : "warning",
      title: "Kaugseire muutus",
      description: `Kaugseire tähendab, et metsa muutust hinnatakse ülevalt kogutud piltide või kõrgusandmete põhjal. Ühendatud pärisandmetes on nähtav ${changeLabels[change.changeType]}.`,
      confidence: change.confidence,
      year: change.detectedToYear
    });
  }

  for (const protectedArea of protectedAreas) {
    const hidden = protectedArea.publicDetailLevel === "hidden";
    evidence.push({
      id: protectedArea.id,
      kind: "protection",
      tone: "info",
      title: hidden ? "Looduskaitseline tundlikkus" : protectedArea.name,
      description: hidden
        ? "Alal võib olla looduskaitseline tundlikkus. Detailset geomeetriat ega täpset sisu avalikus vaates ei kuvata."
        : protectedArea.overlapHa > 0
          ? `Ala kattub kaitse- või piirangualaga ligikaudu ${protectedArea.overlapHa} ha ulatuses.`
          : "Ala kattub kaitse- või piirangualaga."
    });
  }

  for (const benefit of ecosystemBenefits) {
    evidence.push({
      id: benefit.id,
      kind: "ecosystem",
      tone: "info",
      title: benefit.title,
      description: [
        benefit.valueLabel
          ? `Looduse hüvede kiht annab väärtuse: ${benefit.valueLabel}.`
          : "Looduse hüvede kiht kattub valitud alaga.",
        benefit.overlapAreaHa !== undefined
          ? `Kattuvus ligikaudu ${benefit.overlapAreaHa} ha.`
          : null,
        benefit.dataYear ? `Andmeaasta: ${benefit.dataYear}.` : null
      ]
        .filter(Boolean)
        .join(" "),
      year: benefit.dataYear
    });
  }

  if (satelliteSignal) {
    evidence.push({
      id: "satellite-signal",
      kind: "satellite",
      tone: satelliteSignal.supportsChange ? "success" : "info",
      title: "Satelliidisignaal",
      description: satelliteSignal.signal,
      year: satelliteSignal.year
    });
  }

  return evidence;
}

function buildWhatHappened(
  status: AnalysisResult["status"],
  notices: ForestNotice[],
  changes: ForestChange[],
  protectedAreas: ProtectedArea[],
  ecosystemBenefits: EcosystemBenefit[]
): string[] {
  const rows: string[] = [];

  if (changes.length > 0) {
    rows.push(`Kaugseire kihis on ${changes.length} metsamuutuse signaal.`);
  }

  if (notices.length > 0) {
    rows.push(`Metsaregistri avalikus päringus on ${notices.length} metsateatis.`);
  }

  if (protectedAreas.length > 0) {
    rows.push("Ala kattub EELISe kaitse- või piiranguandmetega.");
  }

  if (ecosystemBenefits.length > 0) {
    const wood = ecosystemBenefits.filter(
      (item) => item.category === "wood_raw_material"
    ).length;
    const carbon = ecosystemBenefits.filter(
      (item) => item.category === "carbon_storage"
    ).length;

    rows.push(
      `Looduse hüvede/ELME kihtidest leiti ${ecosystemBenefits.length} kattuvust` +
        `${wood > 0 ? `, sh ${wood} puidutooraine hinnangut` : ""}` +
        `${carbon > 0 ? ` ja ${carbon} süsinikuvaru hinnangut` : ""}.`
    );
  }

  if (status === "no_major_change") {
    rows.push("Ühendatud päristeenused ei näita valitud alal suurt hiljutist muutust.");
  }

  if (rows.length === 0) {
    rows.push("Avalikest päristeenustest ei leitud selle ala kohta piisavat sündmusinfot.");
  }

  return rows;
}

function buildTimeline({
  stands,
  notices,
  changes,
  protectedAreas
}: {
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const stand of stands) {
    events.push({
      id: `${stand.id}-inventory`,
      year: stand.inventoryYear,
      label: "Metsainventuur",
      detail: stand.inventoryYear
        ? `Metsaeraldis kirjeldati aastal ${stand.inventoryYear}.`
        : "Inventuuriaasta puudub.",
      tone: isInventoryOutdated(stand) ? "warning" : "success"
    });
  }

  for (const notice of notices) {
    events.push({
      id: `${notice.id}-submitted`,
      year: notice.submittedYear ?? notice.validUntilYear,
      label: "Metsateatis",
      detail: `Registris on ${notice.workTypeLabel ?? noticeLabels[notice.type]} tüüpi teatis.`,
      tone: "success"
    });
  }

  for (const change of changes) {
    events.push({
      id: `${change.id}-detected`,
      year: change.detectedToYear,
      label: "Kaugseire signaal",
      detail: `${changeLabels[change.changeType]} tuvastati perioodil ${change.detectedFromYear ?? "?"}-${change.detectedToYear ?? "?"}.`,
      tone: notices.length > 0 ? "success" : "warning"
    });
  }

  if (protectedAreas.length > 0) {
    events.push({
      id: "protected-context",
      label: "Kaitsekontekst",
      detail: "Kaitse- või piiranguandmed kattuvad valitud alaga.",
      tone: "info"
    });
  }

  return events.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

function buildSources(): DataSourceRef[] {
  return [
    {
      id: "maaamet-etak-forest",
      name: "Maa- ja Ruumiameti ETAK metsapolügoonid",
      type: "official_wfs",
      detail: "ETAK e_305_puittaimestik_a WFS; tyyp_tekst = Mets"
    },
    {
      id: "maaamet-cadastre",
      name: "Maa- ja Ruumiameti katastri taust",
      type: "official_wfs",
      detail: "Avalik kataster WFS; kuvatakse katastritunnus ja omandivorm, mitte eraomaniku nime"
    },
    {
      id: "metsaregister",
      name: "Metsaregistri avalik päring",
      type: "official_wfs",
      detail: "gsavalik.envir.ee/geoserver/metsaregister/wfs kihid eraldis ja teatis"
    },
    {
      id: "eelis",
      name: "EELIS avalik WFS",
      type: "official_wfs",
      detail: "Keskkonnaagentuuri EELIS WFS kaitse-, Natura- ja vääriselupaiga kihid"
    },
    {
      id: "elme",
      name: "Looduse hüvede / ELME WFS",
      type: "official_wfs",
      detail: "Puidutooraine ja metsa puitsesse biomassi seotud süsiniku kaardikihid"
    },
    {
      id: "kaia",
      name: "KAIA avaandmete failiteenus",
      type: "future_api",
      detail: "Keskkonnaportaali avaandmete failide allalaadimise API; vajab eraldi andmefailide indekseerimist"
    },
    {
      id: "smi-kese",
      name: "SMI ja KESE metsaseire",
      type: "future_api",
      detail: "Üleriigilised seire- ja valikuuringuandmed; sobivad taustatrendiks, mitte üksiku kliki fakti tõendiks"
    },
    {
      id: "maaamet-map",
      name: "Maa- ja Ruumiameti aluskaart ja metsakiht",
      type: "official_wms",
      detail: "kaart.maaamet.ee/wms/alus-geo"
    }
  ];
}

function overlapPercent(overlapHa: number | undefined, areaHa: number) {
  if (overlapHa === undefined || areaHa <= 0) {
    return undefined;
  }

  return Math.round((overlapHa / areaHa) * 1000) / 10;
}

function standOverlap(stand: ForestStand, area: Area): SpatialOverlap {
  return {
    id: stand.id,
    sourceId: "metsaregister",
    layerName: "Metsaregistri eraldised",
    overlapAreaHa: stand.areaHa,
    overlapPercentOfSelectedArea: overlapPercent(stand.areaHa, area.areaHa),
    properties: {
      standNumber: stand.standNumber,
      mainSpecies: stand.mainSpecies,
      developmentClass: stand.developmentClass,
      siteType: stand.siteType,
      inventoryYear: stand.inventoryYear,
      averageAge: stand.averageAge,
      averageHarvestAge: stand.averageHarvestAge,
      heightM: stand.heightM,
      bonitetClass: stand.bonitetClass,
      registryStage: stand.registryStage,
      areaHa: stand.areaHa
    }
  };
}

function noticeOverlap(notice: ForestNotice, area: Area): SpatialOverlap {
  return {
    id: notice.id,
    sourceId: "metsaregister",
    layerName:
      notice.status === "archived"
        ? "Arhiveeritud metsateatised"
        : "Metsateatised",
    overlapAreaHa: notice.areaHa,
    overlapPercentOfSelectedArea: overlapPercent(notice.areaHa, area.areaHa),
    properties: {
      type: notice.type,
      status: notice.status,
      registryNumber: notice.registryNumber,
      workTypeLabel: notice.workTypeLabel,
      statusLabel: notice.statusLabel,
      standNumber: notice.standNumber,
      submittedYear: notice.submittedYear,
      validUntilYear: notice.validUntilYear,
      areaHa: notice.areaHa
    }
  };
}

function protectedOverlap(area: ProtectedArea, selectedArea: Area): SpatialOverlap {
  return {
    id: area.id,
    sourceId: "eelis",
    layerName:
      area.type === "natura"
        ? "Natura"
        : area.type === "restriction"
          ? "Piiranguala"
          : area.type === "habitat"
            ? "Elupaik / VEP"
            : "Kaitseala",
    overlapAreaHa: area.overlapHa,
    overlapPercentOfSelectedArea: overlapPercent(
      area.overlapHa,
      selectedArea.areaHa
    ),
    properties: {
      name: area.publicDetailLevel === "hidden" ? "Tundlik info" : area.name,
      type: area.type,
      publicDetailLevel: area.publicDetailLevel,
      overlapHa: area.overlapHa
    }
  };
}

function changeOverlap(change: ForestChange, area: Area): SpatialOverlap {
  return {
    id: change.id,
    sourceId: "forest-changes",
    layerName: "Metsamuutused / kaugseire",
    overlapAreaHa: change.areaHa,
    overlapPercentOfSelectedArea: overlapPercent(change.areaHa, area.areaHa),
    properties: {
      source: change.source,
      changeType: change.changeType,
      detectedFromYear: change.detectedFromYear,
      detectedToYear: change.detectedToYear,
      confidence: change.confidence,
      areaHa: change.areaHa
    }
  };
}

function buildEvidenceSources({
  area,
  stands,
  notices,
  changes,
  protectedAreas,
  ecosystemBenefits
}: {
  area: Area;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  ecosystemBenefits: EcosystemBenefit[];
}): EvidenceSource[] {
  const retrievedAt = new Date().toISOString();

  return [
    {
      id: "maaamet-etak-forest",
      name:
        area.type === "parcel"
          ? "Valitud katastriüksuse geomeetria"
          : "ETAK metsaala",
      provider: "Maa- ja Ruumiamet",
      url: etakSourceUrl(area),
      retrievedAt,
      status: "loaded",
      warning:
        area.type === "parcel"
          ? "Otsingu tulemus on katastriüksus; see ei tähenda, et kogu kinnistu on mets."
          : undefined
    },
    {
      id: "maaamet-cadastre",
      name: "Katastriüksuse kontekst",
      provider: "Maa- ja Ruumiamet",
      url: cadastreSourceUrl(area.cadastralId),
      retrievedAt,
      status: area.cadastralId ? "loaded" : "missing",
      warning: area.cadastralId
        ? "Eraomaniku nime ei kuvata; kasutatakse ainult avalikku omandivormi."
        : "Klikitud metsaala ei õnnestunud katastriüksusega siduda."
    },
    {
      id: "metsaregister",
      name: "Metsaregister",
      provider: "Kliimaministeerium / Metsaregister",
      url: metsaregisterSourceUrl(area.cadastralId, stands, notices),
      retrievedAt,
      status: stands.length > 0 || notices.length > 0 ? "loaded" : "missing",
      warning:
        stands.length === 0 && notices.length === 0
          ? "Avalik päring ei tagastanud eraldisi ega metsateatisi."
          : undefined
    },
    {
      id: "eelis",
      name: "EELIS kaitse- ja piiranguandmed",
      provider: "Keskkonnaagentuur",
      url: eelisSourceUrl(protectedAreas),
      retrievedAt,
      status: protectedAreas.length > 0 ? "loaded" : "missing",
      warning:
        protectedAreas.length === 0
          ? "Ühendatud avalikud EELIS kihid ei tagastanud kattuvusi."
          : "Tundlikke liigiandmeid ei kuvata detailse asukohana."
    },
    {
      id: "elme",
      name: "Looduse hüvede / ELME kihid",
      provider: "Keskkonnaagentuur / Keskkonnaportaal",
      url: elmeSourceUrl(),
      retrievedAt,
      status: ecosystemBenefits.length > 0 ? "loaded" : "missing",
      warning:
        ecosystemBenefits.length === 0
          ? "ELME puidutooraine ja süsiniku kihid ei tagastanud valitud alale kattuvusi."
          : "ELME kihid annavad majandusliku ja ökosüsteemse konteksti; need ei ole raie lubatavuse otsus."
    },
    {
      id: "forest-changes",
      name: "Metsamuutuste / LiDAR muutusetõend",
      provider: "Maa- ja Ruumiamet",
      url: "https://geoportaal.maaamet.ee/index.php?fatlayerid=metsamuutus_teemakaart&lang_id=1&page_id=966&plugin_act=getfatlayerid",
      retrievedAt,
      status: changes.length > 0 ? "loaded" : "not_connected",
      warning:
        changes.length === 0
          ? "Metsamuutuste teemakaardi kirjeldus on leitud, kuid avalik WFS URL puudub; WMS piltkihti ei kasutata valitud ala tõendina."
          : undefined
    },
    {
      id: "maaamet-map",
      name: "Aluskaart ja metsakiht",
      provider: "Maa- ja Ruumiamet",
      url: "https://geoportaal.maaamet.ee/est/teenused/wms-wfs-wcs-teenused-p65.html",
      retrievedAt,
      status: "loaded"
    },
    {
      id: "kaia",
      name: "KAIA avaandmete API",
      provider: "Keskkonnaportaal",
      url: "https://avaandmed.keskkonnaportaal.ee/swagger/v1/swagger.json",
      retrievedAt,
      status: "not_connected",
      warning:
        "API on tuvastatud failide allalaadimise teenusena, kuid selle faile ei indekseerita selles prototüübis veel valitud ala faktideks."
    },
    {
      id: "smi-kese",
      name: "SMI ja KESE metsaseire",
      provider: "Keskkonnaagentuur",
      url: "https://keskkonnaportaal.ee/et/teemad/mets",
      retrievedAt,
      status: "not_connected",
      warning:
        "SMI ja seireandmed on sobivamad üleriigilise tausta jaoks; neid ei kasutata siin üksiku metsaala tõendina."
    }
  ];
}

function buildMissingEvidence({
  stands,
  notices,
  changes,
  protectedAreas
}: {
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
}): MissingEvidence[] {
  const rows: MissingEvidence[] = [];

  if (changes.length === 0) {
    rows.push({
      id: "missing-forest-changes",
      label: "Kaugseire muutusetõend puudub selles andmepakis",
      whyItMatters:
        "Ilma kaugseire, ortofoto või kontrolli tõendita ei saa metsateatise põhjal väita, et raie tegelikult toimus."
    });
  }

  if (notices.length === 0) {
    rows.push({
      id: "missing-notices",
      label: "Metsateatist ei leitud",
      whyItMatters:
        "Kui küsitakse kavandatud raiet või ametlikku teadet, ei toeta see andmepakk seda väidet."
    });
  }

  if (stands.length === 0) {
    rows.push({
      id: "missing-stands",
      label: "Metsaregistri eraldisi ei leitud",
      whyItMatters:
        "Puuliigi, arenguklassi ja inventuuriaasta kohta ei saa siis detailset järeldust teha."
    });
  }

  if (protectedAreas.length === 0) {
    rows.push({
      id: "missing-protection-overlap",
      label: "Kaitse- või piirangukattuvust ei leitud",
      whyItMatters:
        "See tähendab ainult, et ühendatud avalikud EELIS kihid ei näidanud kattuvust; see ei ole õiguslik lõppotsus."
    });
  }

  return rows;
}

function buildDataCatalog({
  area,
  stands,
  notices,
  changes,
  protectedAreas,
  ecosystemBenefits
}: {
  area: Area;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  ecosystemBenefits: EcosystemBenefit[];
}): DataCatalogEntry[] {
  return [
    {
      id: "maaamet-etak-forest",
      name:
        area.type === "parcel"
          ? "Valitud katastriüksuse geomeetria"
          : "ETAK metsaala",
      provider: "Maa- ja Ruumiamet",
      scope: "selected_area",
      priority: "critical",
      status: "loaded",
      url: etakSourceUrl(area),
      description:
        area.type === "parcel"
          ? "Valitud katastriüksuse geomeetria ja pindala."
          : "Valitud metsaobjekti geomeetria ja pindala.",
      aiUse: "Määrab, millise konkreetse alaga kõik muud andmed seotakse.",
      userVisibility: "always",
      limitation:
        area.type === "parcel"
          ? "Katastriüksus ei tähenda, et kogu kinnistu on metsamaa."
          : "Topograafiline metsaobjekt ei tõenda raiet, omandit ega tegevuse lubatavust."
    },
    {
      id: "maaamet-cadastre",
      name: "Katastriüksuse kontekst",
      provider: "Maa- ja Ruumiamet",
      scope: "selected_area",
      priority: "high",
      status: area.cadastralId ? "loaded" : "missing",
      url: cadastreSourceUrl(area.cadastralId),
      description: "Katastritunnus, avalik omandivorm, sihtotstarve ja kinnistu kontekst.",
      aiUse: "Vastab omandi vormi ja katastri tausta küsimustele ilma isikuandmeid avaldamata.",
      userVisibility: "always",
      limitation: "Eraomaniku nime ja isikuandmeid selles vaates ei kasutata."
    },
    {
      id: "metsaregister",
      name: "Metsaregistri eraldised ja metsateatised",
      provider: "Kliimaministeerium / Metsaregister",
      scope: "selected_area",
      priority: "critical",
      status: stands.length > 0 || notices.length > 0 ? "loaded" : "missing",
      url: metsaregisterSourceUrl(area.cadastralId, stands, notices),
      description: "Metsainventeerimise eraldised, puistu omadused ja avalikud metsateatised.",
      aiUse: "Põhiallikas puuliigi, inventuuriaasta, arenguklassi ja teatise küsimustes.",
      userVisibility: "always",
      limitation:
        "Metsateatis kirjeldab ametlikku teadet või menetlust; see ei tõenda üksinda, et töö toimus."
    },
    {
      id: "metsaregister-expertises",
      name: "Metsakaitse- ja metsauuenduse ekspertiisid",
      provider: "Metsaregister",
      scope: "selected_area",
      priority: "high",
      status: "not_connected",
      description:
        "Metsakaitseekspertiisid, metsauuenduse info ja välitööde detailid, kui need on avalikust teenusest kättesaadavad.",
      aiUse: "Tõstaks esile kahjustuse, uuenduse või ametliku kontrolli faktid.",
      userVisibility: "when_relevant",
      limitation: "Ei ole veel prototüübi valitud ala andmepakki ühendatud."
    },
    {
      id: "eelis",
      name: "EELIS kaitse-, Natura-, piirangu- ja VEP kihid",
      provider: "Keskkonnaagentuur",
      scope: "spatial_context",
      priority: "high",
      status: protectedAreas.length > 0 ? "loaded" : "missing",
      url: eelisSourceUrl(protectedAreas),
      description: "Kaitsealade, piirangute, Natura alade ja vääriselupaikade avalikud kattuvused.",
      aiUse: "Selgitab, kas ala puhul peab kasutajale näitama looduskaitselist konteksti.",
      userVisibility: protectedAreas.length > 0 ? "always" : "when_relevant",
      limitation: "Kattuvus ei ole lõplik õiguslik otsus tegevuse lubatavuse kohta."
    },
    {
      id: "forest-changes",
      name: "Metsamuutuste / LiDAR muutusetõend",
      provider: "Maa- ja Ruumiamet",
      scope: "selected_area",
      priority: "critical",
      status: changes.length > 0 ? "loaded" : "not_connected",
      url: "https://geoportaal.maaamet.ee/index.php?fatlayerid=metsamuutus_teemakaart&lang_id=1&page_id=966&plugin_act=getfatlayerid",
      description: "Metsa kõrguse või taimkatte muutust toetavad kaugseireandmed.",
      aiUse: "Eristab kavandatud või menetletud tegevust tegeliku nähtava muutuse tõendist.",
      userVisibility: "always",
      limitation:
        "Ametliku kirjelduse järgi avalik WFS URL puudub; prototüüp ei kasuta WMS piltkihti valitud ala tõendina."
    },
    {
      id: "elme",
      name: "Looduse hüvede / ELME puidutooraine ja süsiniku kihid",
      provider: "Keskkonnaagentuur / Keskkonnaportaal",
      scope: "spatial_context",
      priority: "medium",
      status: ecosystemBenefits.length > 0 ? "loaded" : "missing",
      url: elmeSourceUrl(),
      description: "Puidutooraine potentsiaali, väärtuse ja metsa biomassi süsiniku kaardikihid.",
      aiUse: "Annab kasutajale majandusliku ja ökosüsteemse taustakonteksti pärast põhifaktide näitamist.",
      userVisibility: ecosystemBenefits.length > 0 ? "when_relevant" : "advanced",
      limitation: "Sobib kontekstiks; ei tõenda raiet ega anna üksinda majanduslikku soovitust."
    },
    {
      id: "smi",
      name: "Statistiline metsainventuur (SMI)",
      provider: "Keskkonnaagentuur",
      scope: "national_context",
      priority: "context",
      status: "not_connected",
      url: "https://keskkonnaportaal.ee/et/teemad/mets",
      description: "Üleriigiline valikuuring Eesti metsade seisundi ja dünaamika hindamiseks.",
      aiUse: "Sobib võrdluseks ja trendideks, kui ehitame üle-Eestilise analüsaatori.",
      userVisibility: "advanced",
      limitation: "Ei ole üksiku klikitud metsaala tõend."
    },
    {
      id: "kese",
      name: "KESE metsaseire",
      provider: "Keskkonnaagentuur",
      scope: "national_context",
      priority: "context",
      status: "not_connected",
      url: "https://kese.envir.ee/",
      description: "Metsa ja metsamuldade seire, kahjustused, võra- ja mullavee ning keemilised näitajad.",
      aiUse: "Sobib taustariski ja seiretrendi selgitamiseks, kui seirepunktid on alaga seotavad.",
      userVisibility: "advanced",
      limitation: "Ei ole praegu valitud ala ruumilise tõendina ühendatud."
    },
    {
      id: "kaia",
      name: "KAIA avaandmete failiteenus",
      provider: "Keskkonnaportaal",
      scope: "api_catalog",
      priority: "background",
      status: "not_connected",
      url: "https://avaandmed.keskkonnaportaal.ee/swagger/v1/swagger.json",
      description: "Keskkonnaportaali avaandmete failide allalaadimise API.",
      aiUse: "Annab järgmise andmeimportide tee, kuid ei ole veel jooksva ala fakti allikas.",
      userVisibility: "advanced",
      limitation: "API kirjeldus on teada; failide valik ja ruumiline indekseerimine on järgmine töö."
    }
  ];
}

function buildPrioritizedInsights({
  area,
  stands,
  notices,
  changes,
  protectedAreas,
  ecosystemBenefits
}: {
  area: Area;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  ecosystemBenefits: EcosystemBenefit[];
}): PrioritizedInsight[] {
  const activeNotices = notices.filter((notice) => notice.status !== "archived");
  const insights: PrioritizedInsight[] = [
    {
      id: "selected-area-anchor",
      priority: "critical",
      title: "Valitud ala alusfakt",
      summary: area.etakId
        ? `ETAK metsaala ${area.etakId}, pindala ${area.areaHa} ha.`
        : area.type === "parcel"
          ? `Valitud katastriüksuse pindala ${area.areaHa} ha.`
          : `Valitud ala pindala ${area.areaHa} ha.`,
      sourceIds: ["maaamet-etak-forest"],
      visibleByDefault: true,
      reason: "Kõik ülejäänud päringud ja AI vastused peavad olema seotud sama geomeetriaga.",
      caveat:
        area.type === "parcel"
          ? "See ei tähenda, et kogu kinnistu on mets või et seal toimus tegevus."
          : "See ei tõenda raiet, kahjustust ega tegevuse lubatavust."
    }
  ];

  if (area.cadastralId || area.ownershipForm) {
    insights.push({
      id: "cadastre-context",
      priority: "high",
      title: "Katastri kontekst",
      summary: [
        area.cadastralId ? `Katastritunnus ${area.cadastralId}` : null,
        area.ownershipForm ? `omandivorm ${area.ownershipForm}` : null,
        area.landUse ? `sihtotstarve ${area.landUse}` : null
      ]
        .filter(Boolean)
        .join(", "),
      sourceIds: ["maaamet-cadastre"],
      visibleByDefault: true,
      reason: "Omandivorm ja kinnistu kontekst on kasutaja jaoks tihti esimene tõlgenduskiht.",
      caveat: "Eraomaniku nime ei kuvata ega kasutata AI vastustes."
    });
  }

  if (activeNotices.length > 0) {
    insights.push({
      id: "active-forest-notice",
      priority: "critical",
      title: "Metsateatis vajab eraldi tähelepanu",
      summary: `Metsaregistrist leiti ${activeNotices.length} aktiivset või mittearhiveeritud metsateatist.`,
      sourceIds: ["metsaregister"],
      visibleByDefault: true,
      reason: "Teatis on kasutaja jaoks oluline ametlik sündmusfakt ja võib muuta ala tõlgendust.",
      caveat: "Teatis ei tõenda üksinda, et raie on tegelikult toimunud."
    });
  }

  if (changes.length > 0) {
    insights.push({
      id: "forest-change-evidence",
      priority: "critical",
      title: "Muutusetõend on olemas",
      summary: `Ühendatud muutuseandmed näitavad ${changes.length} kaugseire signaali.`,
      sourceIds: ["forest-changes"],
      visibleByDefault: true,
      reason: "See on kõige olulisem kiht, kui kasutaja küsib, kas midagi päriselt muutus.",
      caveat: "Muutusesignaal vajab registri- ja kontekstikontrolli enne järeldust rikkumise kohta."
    });
  } else {
    insights.push({
      id: "forest-change-not-connected",
      priority: activeNotices.length > 0 ? "critical" : "high",
      title: "Tegelikku muutust kinnitav kiht puudub",
      summary:
        "Metsamuutuste/LiDAR kiht ei ole selles prototüübis veel valitud ala tõendina ühendatud.",
      sourceIds: ["forest-changes"],
      visibleByDefault: true,
      reason: "Ilma selleta peab AI olema ettevaatlik kõigi küsimustega, mis küsivad tehtud raiet.",
      caveat: "See on andmelünk, mitte tõend, et muutust ei olnud."
    });
  }

  if (protectedAreas.length > 0) {
    insights.push({
      id: "protection-context",
      priority: "high",
      title: "Looduskaitseline kontekst",
      summary: `EELISest leiti ${protectedAreas.length} kaitse-, Natura-, piirangu- või elupaigakattuvust.`,
      sourceIds: ["eelis"],
      visibleByDefault: true,
      reason: "Kaitse- ja piiranguinfo peab olema kasutajale nähtav enne lihtsat kokkuvõtet.",
      caveat: "Kattuvus ei ole lõplik õiguslik hinnang tegevuse lubatavusele."
    });
  }

  if (stands.length > 0) {
    const outdated = stands.filter(isInventoryOutdated);
    insights.push({
      id: "forest-stands",
      priority: outdated.length > 0 ? "high" : "medium",
      title: "Metsaregistri puistukirjeldus",
      summary:
        outdated.length > 0
          ? `${stands.length} eraldist, neist ${outdated.length} vajab inventuuriaasta tõttu ettevaatlikku tõlgendust.`
          : `${stands.length} eraldist; olemas on puuliigi, arenguklassi ja inventuuriaasta info.`,
      sourceIds: ["metsaregister"],
      visibleByDefault: true,
      reason: "Need faktid aitavad kasutajal aru saada, mis metsaga on tegemist.",
      caveat: "Inventuur võib olla ajas vananenud ja ei kirjelda tingimata tänast seisu."
    });
  }

  const woodBenefits = ecosystemBenefits.filter(
    (item) => item.category === "wood_raw_material"
  );
  const carbonBenefits = ecosystemBenefits.filter(
    (item) => item.category === "carbon_storage"
  );
  if (woodBenefits.length > 0 || carbonBenefits.length > 0) {
    const examples = [...woodBenefits, ...carbonBenefits]
      .map((item) => item.valueLabel ?? item.title)
      .filter(Boolean)
      .slice(0, 3);

    insights.push({
      id: "ecosystem-benefits",
      priority: "medium",
      title: "Puidutooraine ja süsiniku kontekst",
      summary:
        examples.length > 0
          ? examples.join("; ")
          : `ELME kihtidest leiti ${ecosystemBenefits.length} kattuvust.`,
      sourceIds: ["elme"],
      visibleByDefault: false,
      reason: "See annab häkatoni jaoks väärtusliku lisakihi, aga ei tohi varjutada õigus- ja sündmusfakte.",
      caveat: "Sobib kontekstiks, mitte raie või lubatavuse tõendiks."
    });
  }

  insights.push({
    id: "expertise-gap",
    priority: "high",
    title: "Metsakaitse ja uuenduse detailid on järgmine andmelünk",
    summary:
      "Metsakaitseekspertiiside, metsauuenduse ja välitööde andmed ei ole veel valitud ala paketis.",
    sourceIds: ["metsaregister-expertises"],
    visibleByDefault: activeNotices.length > 0 || protectedAreas.length > 0,
    reason: "Need andmed aitaksid eristada kahjustust, uuendust, kontrolli ja tavapärast majandamist.",
    caveat: "AI ei tohi nende kohta järeldusi teha enne, kui allikas on ühendatud."
  });

  const rank: Record<PrioritizedInsight["priority"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    context: 3,
    background: 4
  };

  return insights.sort((a, b) => {
    const byPriority = rank[a.priority] - rank[b.priority];
    if (byPriority !== 0) {
      return byPriority;
    }

    return Number(b.visibleByDefault) - Number(a.visibleByDefault);
  });
}

function groupedNoticeTypes(notices: ForestNotice[]) {
  const counts = new Map<string, number>();

  for (const notice of notices) {
    const label = notice.workTypeLabel ?? noticeLabels[notice.type];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} (${count})`);
}

function topEcosystemValues(items: EcosystemBenefit[], max = 3) {
  return items
    .map((item) => item.valueLabel ?? item.title)
    .filter(Boolean)
    .slice(0, max);
}

function buildPriorityBlocks({
  area,
  stands,
  notices,
  changes,
  protectedAreas,
  ecosystemBenefits
}: {
  area: Area;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  ecosystemBenefits: EcosystemBenefit[];
}): PriorityBlock[] {
  const activeNotices = notices.filter((notice) => notice.status !== "archived");
  const noticeTypes = groupedNoticeTypes(notices);
  const protectedNames = protectedAreas
    .filter((item) => item.publicDetailLevel === "full")
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 4);
  const woodValues = topEcosystemValues(
    ecosystemBenefits.filter((item) => item.category === "wood_raw_material")
  );
  const carbonValues = topEcosystemValues(
    ecosystemBenefits.filter((item) => item.category === "carbon_storage")
  );
  const notConnected = [
    changes.length === 0
      ? "Metsamuutuste/LiDAR kiht ei ole valitud ala tõendina ühendatud."
      : null,
    "Metsakaitseekspertiisid, metsauuenduse info ja välitööde detailid vajavad järgmist ühendust.",
    "SMI, KESE ja KAIA on tausta- või impordiallikad, mitte praegu üksiku ala faktiline tõend."
  ].filter((item): item is string => Boolean(item));

  return [
    {
      id: "base-info",
      title: "Põhiinfo",
      subtitle: "Mis ala see on ja mille külge kõik muu seotakse",
      tone: "base",
      rank: 1,
      sourceIds: ["maaamet-etak-forest", "maaamet-cadastre"],
      items: [
        area.etakId
          ? `ETAK metsaala ${area.etakId}, pindala ${area.areaHa} ha.`
          : area.type === "parcel"
            ? `Katastriüksus ${area.cadastralId ?? area.id}, pindala ${area.areaHa} ha.`
            : `Valitud ala pindala ${area.areaHa} ha.`,
        area.address ? `Aadress: ${area.address}.` : null,
        area.ownershipForm ? `Omandivorm: ${area.ownershipForm}.` : null,
        area.landUse ? `Sihtotstarve: ${area.landUse}.` : null
      ].filter((item): item is string => Boolean(item)),
      caveat:
        area.type === "parcel"
          ? "Katastriüksus ei tähenda, et kogu kinnistu on mets."
          : "ETAK metsaobjekt ei tõenda raiet, kahjustust ega tegevuse lubatavust."
    },
    {
      id: "needs-attention",
      title: "Tähelepanu vajab",
      subtitle: "Faktid ja lüngad, mis muudavad tõlgendust kõige rohkem",
      tone: "attention",
      rank: 2,
      sourceIds: ["metsaregister", "eelis", "forest-changes"],
      items: [
        activeNotices.length > 0
          ? `Metsaregistris on ${activeNotices.length} aktiivset või mittearhiveeritud metsateatist.`
          : "Aktiivset metsateatist ei leitud.",
        protectedAreas.length > 0
          ? `EELIS näitab ${protectedAreas.length} kaitse-, Natura-, piirangu- või elupaigakattuvust.`
          : "Ühendatud EELISe kihtidest kaitse- või piirangukattuvust ei leitud.",
        changes.length > 0
          ? `Kaugseire muutusetõendeid on ${changes.length}.`
          : "Tegelikku muutust kinnitav kaugseire/LiDAR tõend puudub selles paketis."
      ],
      caveat:
        "See plokk ei tee õiguslikku otsust; see ütleb, mida peab enne lihtsat järeldust kontrollima."
    },
    {
      id: "registry-content",
      title: "Metsaregistri sisu",
      subtitle: "Puistu kirjeldus ja ametlikud teatised",
      tone: "registry",
      rank: 3,
      sourceIds: ["metsaregister"],
      items: [
        stands.length > 0
          ? `Metsaeraldisi leiti ${stands.length}.`
          : "Metsaregistri eraldisi ei leitud.",
        notices.length > 0
          ? `Metsateatisi kokku ${notices.length}: ${noticeTypes.slice(0, 5).join(", ")}.`
          : "Metsateatisi ei leitud.",
        stands.some(isInventoryOutdated)
          ? "Osa inventuuriinfost võib olla vananenud."
          : stands.length > 0
            ? "Eraldiste põhjal saab kirjeldada puuliiki, arenguklassi ja inventuuriaastat."
            : "Puuliigi ja arenguklassi detail puudub."
      ],
      caveat:
        "Metsateatis tähendab ametlikku teadet või menetlust, mitte automaatselt tehtud raiet."
    },
    {
      id: "nature-values",
      title: "Kaitse ja looduse hüved",
      subtitle: "Looduskaitse, puidutooraine ja süsiniku kontekst",
      tone: "nature",
      rank: 4,
      sourceIds: ["eelis", "elme"],
      items: [
        protectedNames.length > 0
          ? `Olulisemad kattuvad kaitseandmed: ${protectedNames.join(", ")}.`
          : protectedAreas.length > 0
            ? `Kaitse- või piirangukattuvusi on ${protectedAreas.length}.`
            : "Kaitsekattuvust ei leitud.",
        woodValues.length > 0
          ? `ELME puidutooraine näited: ${woodValues.join("; ")}.`
          : "ELME puidutooraine kattuvust ei leitud.",
        carbonValues.length > 0
          ? `ELME süsinikuvaru näited: ${carbonValues.join("; ")}.`
          : "ELME süsinikuvaru kattuvust ei leitud."
      ],
      caveat:
        "Looduse hüvede kihid on kontekst, mitte raie lubatavuse või rikkumise tõend."
    },
    {
      id: "data-gaps",
      title: "Andmelüngad",
      subtitle: "Mille kohta AI ei tohi veel tugevat väidet teha",
      tone: "gaps",
      rank: 5,
      sourceIds: ["forest-changes", "metsaregister-expertises", "smi", "kese", "kaia"],
      items: notConnected,
      caveat:
        "Andmelünk ei tähenda, et sündmust polnud; see tähendab, et see prototüüp ei saa seda veel tõendada."
    }
  ];
}

function buildEvidencePackage({
  area,
  stands,
  notices,
  changes,
  protectedAreas,
  ecosystemBenefits,
  diagnostics
}: {
  area: Area;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  ecosystemBenefits: EcosystemBenefit[];
  diagnostics: SourceDiagnostic[];
}): ForestAreaEvidencePackage {
  const activeNotices = notices.filter((notice) => notice.status !== "archived");
  const archivedNotices = notices.filter(
    (notice) => notice.status === "archived"
  );
  const woodRawMaterialOverlaps = ecosystemBenefits.filter(
    (item) => item.category === "wood_raw_material"
  );
  const carbonStorageOverlaps = ecosystemBenefits.filter(
    (item) => item.category === "carbon_storage"
  );
  const otherEcosystemOverlaps = ecosystemBenefits.filter(
    (item) =>
      item.category !== "wood_raw_material" && item.category !== "carbon_storage"
  );
  const protectionOverlaps = protectedAreas.map((item) =>
    protectedOverlap(item, area)
  );
  const protectedAreaOverlaps = protectionOverlaps.filter(
    (item) => item.properties.type === "protected_area"
  );
  const naturaOverlaps = protectionOverlaps.filter(
    (item) => item.properties.type === "natura"
  );
  const restrictionOverlaps = protectionOverlaps.filter(
    (item) =>
      item.properties.type === "restriction" ||
      item.properties.type === "habitat"
  );
  const derivedFindings: ForestAreaEvidencePackage["derivedFindings"] = [
    {
      id: "selected-real-etak-forest",
      title:
        area.type === "parcel"
          ? "Valitud objekt on päris katastriüksus"
          : "Valitud objekt on päris ETAK metsaala",
      severity: "info",
      claim: area.etakId
        ? `ETAK metsaala ${area.etakId}, pindala ${area.areaHa} ha.`
        : area.type === "parcel"
          ? `Katastriüksuse ${area.cadastralId ?? area.id} pindala on ${area.areaHa} ha.`
          : `Valitud ala pindala on ${area.areaHa} ha.`,
      evidenceItemIds: ["etak-area"],
      caveat:
        area.type === "parcel"
          ? "Katastriüksus ei tõenda, et kogu kinnistu on mets või et seal toimus raie."
          : "ETAK kirjeldab topograafilist metsaobjekti; see ei tõenda raiet, lubatavust ega metsaomaniku tegevust."
    }
  ];

  if (activeNotices.length > 0) {
    derivedFindings.push({
      id: "notice-without-change-proof",
      title: "Metsateatis on olemas",
      severity: changes.length > 0 ? "info" : "attention",
      claim: `Metsaregistrist leiti ${activeNotices.length} metsateatis(t).`,
      evidenceItemIds: activeNotices.map((notice) => notice.id),
      caveat:
        "Metsateatis viitab kavandatud või menetletud tegevusele; see ei tõenda üksi, et raie toimus."
    });
  }

  if (protectedAreas.length > 0) {
    derivedFindings.push({
      id: "protection-context",
      title: "Kaitse- või piirangukontekst on olemas",
      severity: "attention",
      claim: `EELISest leiti ${protectedAreas.length} kattuvust.`,
      evidenceItemIds: protectedAreas.map((item) => item.id),
      caveat:
        "Kaitsekattuvus võib tähendada lisapiiranguid, aga see ei ole lõplik õiguslik hinnang tegevuse lubatavusele."
    });
  }

  if (ecosystemBenefits.length > 0) {
    derivedFindings.push({
      id: "ecosystem-benefits-context",
      title: "Lisatud on looduse hüvede kontekst",
      severity: "info",
      claim: `ELME kihtidest leiti ${ecosystemBenefits.length} puidutooraine või süsiniku kattuvust.`,
      evidenceItemIds: ecosystemBenefits.map((item) => item.id),
      caveat:
        "Need kihid annavad ressursi- ja ökosüsteemse tausta; need ei tõenda raiet ega tegevuse lubatavust."
    });
  }

  if (changes.length === 0) {
    derivedFindings.push({
      id: "no-change-source-connected",
      title: "Tegelikku metsamuutust kinnitav kaugseire puudub",
      severity: "warning",
      claim:
        "Selles andmepakis ei ole LiDARi või metsamuutuste kattuvust, mis kinnitaks taimkatte kõrguse muutust.",
      evidenceItemIds: [],
      caveat:
        "See ei tõenda, et muutust pole olnud; see ütleb, et vastav tõend ei ole selles prototüübis ühendatud."
    });
  }

  return {
    selectedArea: {
      selectionType: area.type === "parcel" ? "cadastre" : "etak_forest",
      geometryId: area.etakFeatureId ?? area.etakId?.toString() ?? area.id,
      geometrySource: area.dataSource ?? "Maa- ja Ruumiamet ETAK WFS",
      areaHa: area.areaHa,
      county: area.county,
      municipality: area.municipality,
      cadastralIds: area.cadastralId ? [area.cadastralId] : []
    },
    etak: {
      forestObjectId: area.etakId?.toString() ?? area.etakFeatureId,
      objectType: area.etakType,
      areaHa: area.areaHa,
      sourceStatus: area.etakId || area.etakFeatureId ? "loaded" : "missing"
    },
    cadastre: {
      cadastralIds: area.cadastralId ? [area.cadastralId] : [],
      ownershipForm: area.ownershipForm,
      parcels: [
        {
          id: "cadastre-parcel",
          sourceId: "maaamet-cadastre",
          label: "Katastriüksus",
          value: area.cadastralId ?? null,
          confidence: area.cadastralId ? "high" : "low",
          explanation: [
            area.address ? `Aadress: ${area.address}.` : null,
            area.landUse ? `Sihtotstarve: ${area.landUse}.` : null,
            area.ownershipForm ? `Omandivorm: ${area.ownershipForm}.` : null,
            area.forestHa !== undefined
              ? `Katastris metsamaad: ${area.forestHa} ha.`
              : null
          ]
            .filter(Boolean)
            .join(" ")
        }
      ],
      sourceStatus: area.cadastralId ? "loaded" : "missing"
    },
    forestRegistry: {
      stands: stands.map((stand) => standOverlap(stand, area)),
      notices: activeNotices.map((notice) => noticeOverlap(notice, area)),
      archivedNotices: archivedNotices.map((notice) =>
        noticeOverlap(notice, area)
      ),
      forestProtectionExpertises: [],
      regenerationExpertises: [],
      sourceStatus: stands.length > 0 || notices.length > 0 ? "loaded" : "missing"
    },
    eelis: {
      protectedAreaOverlaps,
      naturaOverlaps,
      restrictionOverlaps,
      hiddenSensitiveDataNote:
        protectedAreas.some((item) => item.publicDetailLevel !== "full")
          ? "Osa looduskaitselist infot võib olla avalikus vaates üldistatud või varjatud."
          : undefined,
      sourceStatus: protectedAreas.length > 0 ? "loaded" : "missing"
    },
    forestChanges: {
      lidarChangeOverlaps: changes.map((change) => changeOverlap(change, area)),
      hasChangeEvidence: changes.length > 0,
      sourceStatus: changes.length > 0 ? "loaded" : "not_connected"
    },
    ecosystemBenefits: {
      woodRawMaterialOverlaps,
      carbonStorageOverlaps,
      otherOverlaps: otherEcosystemOverlaps,
      sourceStatus: ecosystemBenefits.length > 0 ? "loaded" : "missing"
    },
    mapContext: {
      countyBoundarySourceStatus: "loaded",
      basemapSourceStatus: "loaded"
    },
    priorityBlocks: buildPriorityBlocks({
      area,
      stands,
      notices,
      changes,
      protectedAreas,
      ecosystemBenefits
    }),
    prioritizedInsights: buildPrioritizedInsights({
      area,
      stands,
      notices,
      changes,
      protectedAreas,
      ecosystemBenefits
    }),
    dataCatalog: buildDataCatalog({
      area,
      stands,
      notices,
      changes,
      protectedAreas,
      ecosystemBenefits
    }),
    derivedFindings,
    missingEvidence: buildMissingEvidence({
      stands,
      notices,
      changes,
      protectedAreas
    }),
    sources: buildEvidenceSources({
      area,
      stands,
      notices,
      changes,
      protectedAreas,
      ecosystemBenefits
    }),
    diagnostics
  };
}

function sanitizeProtectedArea(area: ProtectedArea) {
  if (area.publicDetailLevel === "hidden") {
    return {
      id: area.id,
      type: area.type,
      publicDetailLevel: area.publicDetailLevel,
      overlapHa: area.overlapHa
    };
  }

  return area;
}

class ResolvedAreaProvider implements DataProvider {
  constructor(
    private readonly area: Area,
    private readonly fallbackProvider: DataProvider
  ) {}

  searchAreas(query: string) {
    return this.fallbackProvider.searchAreas(query);
  }

  async getAreaById(areaId: string) {
    if (areaId === this.area.id) {
      return this.area;
    }

    return this.fallbackProvider.getAreaById(areaId);
  }

  async getAreaGeometry(areaId: string) {
    const area = await this.getAreaById(areaId);
    if (!area) {
      return null;
    }

    return {
      type: "Feature" as const,
      properties: {},
      geometry: area.geometry
    };
  }

  getForestStands(areaGeometry: Area["geometry"], areaId?: string) {
    return this.fallbackProvider.getForestStands(areaGeometry, areaId, this.area);
  }

  getForestNotices(areaGeometry: Area["geometry"], areaId?: string) {
    return this.fallbackProvider.getForestNotices(areaGeometry, areaId, this.area);
  }

  getForestChanges(areaGeometry: Area["geometry"], areaId?: string) {
    return this.fallbackProvider.getForestChanges(areaGeometry, areaId, this.area);
  }

  getProtectedAreas(areaGeometry: Area["geometry"], areaId?: string) {
    return this.fallbackProvider.getProtectedAreas(areaGeometry, areaId, this.area);
  }

  getEcosystemBenefits(areaGeometry: Area["geometry"], areaId?: string) {
    return this.fallbackProvider.getEcosystemBenefits(
      areaGeometry,
      areaId,
      this.area
    );
  }

  getSatelliteSignal(areaId: string) {
    return this.fallbackProvider.getSatelliteSignal(areaId);
  }
}

export async function analyzeArea(
  areaId: string,
  provider: DataProvider = realDataProvider
): Promise<AnalysisResult> {
  const area = await provider.getAreaById(areaId);

  if (!area) {
    throw new Error(`Unknown area: ${areaId}`);
  }

  const useCache = provider === realDataProvider;
  if (useCache) {
    const cached = cachedAnalysis(area);
    if (cached) {
      return cached;
    }
  }

  return withSourceDiagnostics(async () => {
  const timedOutSources: string[] = [];
  const [
    stands,
    notices,
    changes,
    protectedAreas,
    ecosystemBenefits,
    satelliteSignal
  ] = await Promise.all([
    withAnalysisTimeout<ForestStand[]>({
      label: "metsaregister-stands",
      promise: provider.getForestStands(area.geometry, area.id, area),
      fallback: [],
      timeoutMs: 4500,
      timedOutSources,
      sourceId: "metsaregister",
      sourceName: "Metsaregister"
    }),
    withAnalysisTimeout<ForestNotice[]>({
      label: "metsaregister-notices",
      promise: provider.getForestNotices(area.geometry, area.id, area),
      fallback: [],
      timeoutMs: 4500,
      timedOutSources,
      sourceId: "metsaregister",
      sourceName: "Metsaregister"
    }),
    withAnalysisTimeout<ForestChange[]>({
      label: "forest-changes",
      promise: provider.getForestChanges(area.geometry, area.id, area),
      fallback: [],
      timeoutMs: 900,
      timedOutSources,
      sourceId: "forest-changes",
      sourceName: "Metsamuutused"
    }),
    withAnalysisTimeout<ProtectedArea[]>({
      label: "eelis",
      promise: provider.getProtectedAreas(area.geometry, area.id, area),
      fallback: [],
      timeoutMs: 3500,
      timedOutSources,
      sourceId: "eelis",
      sourceName: "EELIS"
    }),
    withAnalysisTimeout<EcosystemBenefit[]>({
      label: "elme",
      promise: provider.getEcosystemBenefits(area.geometry, area.id, area),
      fallback: [],
      timeoutMs: 2500,
      timedOutSources,
      sourceId: "elme",
      sourceName: "ELME"
    }),
    withAnalysisTimeout<SatelliteSignal | null>({
      label: "satellite-signal",
      promise: provider.getSatelliteSignal(area.id),
      fallback: null,
      timeoutMs: 900,
      timedOutSources,
      sourceId: "sentinel-comparison",
      sourceName: "Sentinel"
    })
  ]);

  const status = determineStatus({
    stands,
    notices,
    changes,
    protectedAreas,
    referenceYear: REFERENCE_YEAR
  });

  const confidenceScore = calculateConfidence({
    status,
    stands,
    notices,
    changes,
    protectedAreas,
    satelliteSignal,
    referenceYear: REFERENCE_YEAR
  });
  const headline = headlineForStatus(status);
  const summary = summaryForStatus(status);
  const whatHappened = buildWhatHappened(
    status,
    notices,
    changes,
    protectedAreas,
    ecosystemBenefits
  );
  const evidence = buildEvidence({
    stands,
    notices,
    changes,
    protectedAreas,
    ecosystemBenefits,
    satelliteSignal
  });
  const missingInfo = getMissingInfo({
    stands,
    notices,
    changes,
    protectedAreas,
    referenceYear: REFERENCE_YEAR
  });
  const warnings = getWarnings(status, protectedAreas);
  const publicAudit = buildPublicAudit({
    area,
    stands,
    notices,
    changes,
    protectedAreas
  });
  const aiNarrative = await generateAiNarrative(
    {
      status,
      headline,
      summary,
      whatHappened,
      missingInfo,
      warnings,
      evidence,
      publicAudit
    },
    { allowNetwork: false }
  );
  const diagnostics = currentSourceDiagnostics();
  const evidencePackage = buildEvidencePackage({
    area,
    stands,
    notices,
    changes,
    protectedAreas,
    ecosystemBenefits,
    diagnostics
  });
  const normalizedEvidence = normalizeSelectedAreaEvidence({
    area,
    status,
    confidenceScore,
    evidencePackage
  });

  const result: AnalysisResult = {
    area,
    status,
    confidenceScore,
    headline,
    summary,
    publicAudit,
    aiNarrative,
    whatHappened,
    evidence,
    missingInfo,
    timeline: normalizedEvidence.timeline,
    warnings,
    sources: buildSources(),
    evidencePackage,
    normalizedEvidence,
    diagnostics,
    rawFacts: {
      area,
      stands,
      notices,
      changes,
      protectedAreas: protectedAreas.map(sanitizeProtectedArea),
      ecosystemBenefits,
      satelliteSignal
    }
  };

  if (timedOutSources.length > 0) {
    partialAnalysisResults.add(result);
  }

  if (useCache && timedOutSources.length === 0) {
    rememberAnalysis(area, result);
  }

  return result;
  });
}

export async function analyzeResolvedArea(
  area: Area,
  provider: DataProvider = realDataProvider
): Promise<AnalysisResult> {
  if (provider === realDataProvider) {
    const cached = cachedAnalysis(area);
    if (cached) {
      return cached;
    }

    const result = await analyzeArea(area.id, new ResolvedAreaProvider(area, provider));
    if (!partialAnalysisResults.has(result)) {
      rememberAnalysis(area, result);
    }
    return result;
  }

  return analyzeArea(area.id, new ResolvedAreaProvider(area, provider));
}
