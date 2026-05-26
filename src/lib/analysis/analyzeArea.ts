import type { SatelliteSignal } from "@/lib/data/DataProvider";
import type { DataProvider } from "@/lib/data/DataProvider";
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
import type {
  Area,
  AnalysisResult,
  DataSourceRef,
  EvidenceItem,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea,
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

function buildEvidence({
  stands,
  notices,
  changes,
  protectedAreas,
  satelliteSignal
}: {
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
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
  protectedAreas: ProtectedArea[]
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
      type: "official_rest",
      detail: "register.metsad.ee/portaal/api/rest/eraldis/puu ja teatis/puu"
    },
    {
      id: "eelis",
      name: "EELIS avalik WFS",
      type: "official_wfs",
      detail: "Keskkonnaagentuuri EELIS WFS kaitse-, Natura- ja vääriselupaiga kihid"
    },
    {
      id: "maaamet-map",
      name: "Maa- ja Ruumiameti aluskaart ja metsakiht",
      type: "official_wms",
      detail: "kaart.maaamet.ee/wms/alus-geo"
    }
  ];
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

  const [stands, notices, changes, protectedAreas, satelliteSignal] =
    await Promise.all([
      provider.getForestStands(area.geometry, area.id, area),
      provider.getForestNotices(area.geometry, area.id, area),
      provider.getForestChanges(area.geometry, area.id, area),
      provider.getProtectedAreas(area.geometry, area.id, area),
      provider.getSatelliteSignal(area.id)
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

  return {
    area,
    status,
    confidenceScore,
    headline: headlineForStatus(status),
    summary: summaryForStatus(status),
    whatHappened: buildWhatHappened(status, notices, changes, protectedAreas),
    evidence: buildEvidence({
      stands,
      notices,
      changes,
      protectedAreas,
      satelliteSignal
    }),
    missingInfo: getMissingInfo({
      stands,
      notices,
      changes,
      protectedAreas,
      referenceYear: REFERENCE_YEAR
    }),
    timeline: buildTimeline({
      stands,
      notices,
      changes,
      protectedAreas
    }),
    warnings: getWarnings(status, protectedAreas),
    sources: buildSources(),
    rawFacts: {
      area,
      stands,
      notices,
      changes,
      protectedAreas: protectedAreas.map(sanitizeProtectedArea),
      satelliteSignal
    }
  };
}

export async function analyzeResolvedArea(
  area: Area,
  provider: DataProvider = realDataProvider
): Promise<AnalysisResult> {
  return analyzeArea(area.id, new ResolvedAreaProvider(area, provider));
}
