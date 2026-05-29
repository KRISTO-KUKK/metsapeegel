import type {
  AnalysisStatus,
  Area,
  EvidenceTone,
  ForestAreaEvidencePackage,
  NormalizedDataCompleteness,
  NormalizedEcosystemContext,
  NormalizedEvidenceItem,
  NormalizedInterpretation,
  NormalizedKeyFinding,
  NormalizedProtectionGroup,
  NormalizedRegistrySummary,
  NormalizedSelectedAreaEvidence,
  NormalizedSourceStatus,
  NormalizedTimelineItem,
  SourceStatus,
  SpatialOverlap
} from "@/lib/types/forestry";

type NormalizeInput = {
  area: Area;
  status: AnalysisStatus;
  confidenceScore: number;
  evidencePackage: ForestAreaEvidencePackage;
};

const currentYear = 2026;

function compactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function formatHa(value: number | undefined) {
  return value === undefined ? undefined : `${compactNumber(value)} ha`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function uniqueRows(rows: string[]) {
  return Array.from(new Set(rows.filter(Boolean)));
}

function countBy(rows: Array<string | undefined>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row) continue;
    counts.set(row, (counts.get(row) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "et"))
    .map(([label, count]) => (count > 1 ? `${label} (${count})` : label));
}

function sourceStatusLabel(status: SourceStatus) {
  switch (status) {
    case "loaded":
      return "laetud";
    case "missing":
      return "andmed puuduvad";
    case "not_connected":
      return "ühendamata";
    case "not_public":
      return "mitteavalik";
    case "error":
      return "viga";
  }
}

function sourceTone(status: SourceStatus): NormalizedEvidenceItem["tone"] {
  if (status === "loaded") return "positive";
  if (status === "missing") return "neutral";
  return "limit";
}

function publicAreaTitle(area: Area) {
  if (area.address) {
    return area.address.includes("metsaala")
      ? area.address
      : `${area.address} metsaala`;
  }

  return area.etakId ? `ETAK ${area.etakId} metsaala` : area.name;
}

function buildRegistrySummary(
  pkg: ForestAreaEvidencePackage
): NormalizedRegistrySummary {
  const stands = pkg.forestRegistry.stands;
  const activeNotices = pkg.forestRegistry.notices;
  const archivedNotices = pkg.forestRegistry.archivedNotices;
  const inventoryYears = uniqueRows(
    stands
      .map((stand) => numberValue(stand.properties.inventoryYear))
      .filter((year): year is number => year !== undefined)
      .map(String)
  )
    .map(Number)
    .sort((a, b) => a - b);
  const oldestInventoryYear = inventoryYears[0];
  const newestInventoryYear = inventoryYears[inventoryYears.length - 1];
  const veryOldInventory =
    oldestInventoryYear !== undefined && currentYear - oldestInventoryYear >= 20;
  const noticeTypes = countBy(
    [...activeNotices, ...archivedNotices].map((notice) =>
      stringValue(notice.properties.workTypeLabel) ??
      stringValue(notice.properties.type)
    )
  );
  const dominantSpecies = countBy(
    stands.map((stand) => stringValue(stand.properties.mainSpecies))
  ).slice(0, 4);
  const developmentClasses = countBy(
    stands.map((stand) => stringValue(stand.properties.developmentClass))
  ).slice(0, 4);
  const inventorySummary =
    inventoryYears.length === 0
      ? "Inventuuriaastat andmetes ei leitud."
      : inventoryYears.length === 1
        ? `${inventoryYears[0]}: ${stands.length} eraldise inventuuriandmed.`
        : `${oldestInventoryYear}-${newestInventoryYear}: ${stands.length} eraldise inventuuriandmed.`;

  return {
    standsCount: stands.length,
    activeNoticesCount: activeNotices.length,
    archivedNoticesCount: archivedNotices.length,
    noticeTypes,
    dominantSpecies,
    developmentClasses,
    inventoryYears,
    oldestInventoryYear,
    newestInventoryYear,
    veryOldInventory,
    inventorySummary
  };
}

function protectionType(item: SpatialOverlap): NormalizedProtectionGroup["type"] {
  const rawType = String(item.properties.type ?? "");
  const name = String(item.properties.name ?? "");
  if (rawType === "natura") return "natura";
  if (rawType === "protected_area") return "protected_area";
  if (rawType === "restriction") return "restriction";
  if (name.toLocaleLowerCase("et").includes("vep")) return "vep";
  return "habitat";
}

function displayProtectionLabel(type: NormalizedProtectionGroup["type"], name: string) {
  switch (type) {
    case "protected_area":
      return `Kaitseala: ${name}`;
    case "natura":
      return `Natura ala: ${name}`;
    case "restriction":
      return `Piiranguala: ${name}`;
    case "vep":
      return name.toLocaleLowerCase("et").startsWith("vep") ? name : `VEP: ${name}`;
    case "habitat":
      return "Elupaigatüübid";
  }
}

function buildProtectionSummary(
  pkg: ForestAreaEvidencePackage
): NormalizedProtectionGroup[] {
  const overlaps = [
    ...pkg.eelis.protectedAreaOverlaps,
    ...pkg.eelis.naturaOverlaps,
    ...pkg.eelis.restrictionOverlaps
  ];
  const groups = new Map<string, NormalizedProtectionGroup>();
  const habitatCodes = new Set<string>();
  const habitatEvidenceIds: string[] = [];

  for (const item of overlaps) {
    const type = protectionType(item);
    const name = stringValue(item.properties.name) ?? item.layerName;

    if (type === "habitat") {
      habitatCodes.add(name);
      habitatEvidenceIds.push(item.id);
      continue;
    }

    const key = `${type}:${name}`;
    const existing = groups.get(key);
    const overlapHa = item.overlapAreaHa ?? numberValue(item.properties.overlapHa);

    if (existing) {
      existing.count += 1;
      existing.evidenceIds.push(item.id);
      existing.overlapHa =
        existing.overlapHa === undefined
          ? overlapHa
          : overlapHa === undefined
            ? existing.overlapHa
            : Math.max(existing.overlapHa, overlapHa);
      continue;
    }

    groups.set(key, {
      id: `protection-${key}`,
      type,
      label: displayProtectionLabel(type, name),
      count: 1,
      overlapHa,
      evidenceIds: [item.id]
    });
  }

  if (habitatCodes.size > 0) {
    groups.set("habitat:codes", {
      id: "protection-habitat-codes",
      type: "habitat",
      label: "Elupaigatüübid",
      count: habitatEvidenceIds.length,
      codes: Array.from(habitatCodes).sort((a, b) => a.localeCompare(b, "et")),
      evidenceIds: habitatEvidenceIds
    });
  }

  const order: Record<NormalizedProtectionGroup["type"], number> = {
    protected_area: 0,
    natura: 1,
    vep: 2,
    habitat: 3,
    restriction: 4
  };

  return Array.from(groups.values()).sort(
    (a, b) => order[a.type] - order[b.type] || a.label.localeCompare(b.label, "et")
  );
}

function buildEcosystemContext(
  pkg: ForestAreaEvidencePackage
): NormalizedEcosystemContext {
  const wood = pkg.ecosystemBenefits.woodRawMaterialOverlaps;
  const carbon = pkg.ecosystemBenefits.carbonStorageOverlaps;
  const other = pkg.ecosystemBenefits.otherOverlaps;
  const woodEurPerHa = wood
    .map((item) => numberValue(item.properties.keskm_sum_5a))
    .filter((value): value is number => value !== undefined);
  const woodTotals = wood
    .map((item) => numberValue(item.properties.keskm_abs_hind_5a))
    .filter((value): value is number => value !== undefined);
  const carbonValues = carbon
    .map((item) => numberValue(item.properties.puit_c_tha))
    .filter((value): value is number => value !== undefined);

  return {
    sourceStatus: pkg.ecosystemBenefits.sourceStatus,
    summary:
      wood.length > 0 || carbon.length > 0 || other.length > 0
        ? "ELME kontekst: leiti puidutooraine ja/või süsiniku hinnangud; need annavad majandusliku ja ökosüsteemse tausta, kuid ei tõenda raiet ega tegevuse lubatavust."
        : "ELME looduse hüvede kattuvust selle ala kohta ei leitud.",
    woodRawMaterialCount: wood.length,
    carbonStorageCount: carbon.length,
    otherCount: other.length,
    woodEurPerHaMin: woodEurPerHa.length ? Math.min(...woodEurPerHa) : undefined,
    woodEurPerHaMax: woodEurPerHa.length ? Math.max(...woodEurPerHa) : undefined,
    woodTotalEur: woodTotals.length
      ? Math.round(woodTotals.reduce((sum, value) => sum + value, 0))
      : undefined,
    carbonTonPerHaMin: carbonValues.length ? Math.min(...carbonValues) : undefined,
    carbonTonPerHaMax: carbonValues.length ? Math.max(...carbonValues) : undefined
  };
}

function buildSourceStatus(
  pkg: ForestAreaEvidencePackage
): NormalizedSourceStatus[] {
  return pkg.sources.map((source) => ({
    id: source.id,
    name: source.name,
    provider: source.provider,
    url: source.url,
    status: source.status,
    targetId: `source-${source.id}`,
    summary:
      source.warning ??
      (source.status === "loaded"
        ? "Allikas on selle ala andmepakis kasutusel."
        : `Allika staatus: ${sourceStatusLabel(source.status)}.`)
  }));
}

function dataCompleteness(
  score: number,
  sourceStatus: NormalizedSourceStatus[]
): NormalizedDataCompleteness {
  const loaded = sourceStatus
    .filter((source) => source.status === "loaded")
    .map((source) => source.name);
  const notReady = sourceStatus
    .filter((source) => source.status !== "loaded")
    .map((source) => `${source.name}: ${sourceStatusLabel(source.status)}`);

  return {
    score,
    label: score >= 80 ? "hea" : score >= 55 ? "keskmine" : "lünklik",
    reasons: [
      loaded.length > 0 ? `Laetud: ${loaded.join(", ")}.` : "",
      notReady.length > 0 ? `Puudu või ühendamata: ${notReady.join(", ")}.` : ""
    ].filter(Boolean),
    meaning:
      "Praegu saab kirjeldada ala, kaitsekonteksti ja registriseisu, kuid ei saa kinnitada tegelikult toimunud raiet."
  };
}

function metric(label: string, value: string | number | undefined) {
  return value === undefined || value === ""
    ? undefined
    : { label, value: String(value) };
}

function compactMetric(value: number | undefined, suffix = "") {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return `${compactNumber(value)}${suffix}`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildInterpretation({
  area,
  pkg,
  registrySummary,
  protectionSummary,
  ecosystemContext,
  sourceStatus
}: {
  area: Area;
  pkg: ForestAreaEvidencePackage;
  registrySummary: NormalizedRegistrySummary;
  protectionSummary: NormalizedProtectionGroup[];
  ecosystemContext: NormalizedEcosystemContext;
  sourceStatus: NormalizedSourceStatus[];
}): NormalizedInterpretation {
  const activeNotices = registrySummary.activeNoticesCount;
  const archivedNotices = registrySummary.archivedNoticesCount;
  const hasAnyNotice = activeNotices > 0 || archivedNotices > 0;
  const hasChangeProof = pkg.forestChanges.hasChangeEvidence;
  const standAreas = pkg.forestRegistry.stands
    .map((stand) => stand.overlapAreaHa ?? numberValue(stand.properties.areaHa))
    .filter((value): value is number => value !== undefined && value > 0);
  const totalStandAreaHa =
    standAreas.length > 0
      ? Math.round(standAreas.reduce((sum, value) => sum + value, 0) * 100) / 100
      : undefined;
  const averageStandAreaHa =
    average(standAreas) ??
    (registrySummary.standsCount > 0
      ? area.areaHa / registrySummary.standsCount
      : undefined);
  const standsPer100Ha =
    registrySummary.standsCount > 0 && area.areaHa > 0
      ? Math.round((registrySummary.standsCount / area.areaHa) * 1000) / 10
      : undefined;
  const standCoveragePercent =
    totalStandAreaHa !== undefined && area.areaHa > 0
      ? Math.min(999, Math.round((totalStandAreaHa / area.areaHa) * 1000) / 10)
      : undefined;
  const isFinelySplit =
    averageStandAreaHa !== undefined && averageStandAreaHa <= 1.5;
  const disconnected = sourceStatus.filter((source) => source.status !== "loaded");
  const loaded = sourceStatus.filter((source) => source.status === "loaded");

  const activitySummary = hasAnyNotice
    ? hasChangeProof
      ? "Registris on metsateatis ja muutusetõend on olemas; see on tugev signaal, et ala vajab tegevuse kontrolli."
      : "Registris on metsateatise infot, kuid ilma muutusetõendita ei saa öelda, et töö tegelikult toimus."
    : hasChangeProof
      ? "Muutusetõend on olemas, kuid metsateatist ei leitud; see vajab eraldi kontrolli."
      : "Tegevuse tuum: aktiivseid ega arhiveeritud metsateatisi ei leitud ja muutusetõend on ühendamata, seega raiet või muud tegevust ei saa kinnitada.";

  const standSummary =
    registrySummary.standsCount === 0
      ? "Metsaregistri eraldisi ei leitud, seega ei saa puistu koosseisu ega inventuuri põhjal sügavamat järeldust teha."
      : isFinelySplit
        ? `Metsaregister jagab ala ${registrySummary.standsCount} eraldiseks; keskmine eraldis on umbes ${compactNumber(averageStandAreaHa ?? 0)} ha. See paistab üsna peen jaotus, mis võib viidata kirjumale puistule või detailsele inventuurile.`
        : `Metsaregister jagab ala ${registrySummary.standsCount} eraldiseks; keskmine eraldis on umbes ${compactNumber(averageStandAreaHa ?? 0)} ha. Jaotus on pigem mõõdukas.`;

  const natureSummary =
    protectionSummary.length > 0
      ? `Keskkonnakontekst on oluline: EELISes on ${protectionSummary.length} koondatud kattuvust ning ELME-s ${ecosystemContext.woodRawMaterialCount} puidutooraine ja ${ecosystemContext.carbonStorageCount} süsiniku kattuvust.`
      : `EELIS kaitsekattuvust ei näita; ELME-s on ${ecosystemContext.woodRawMaterialCount} puidutooraine ja ${ecosystemContext.carbonStorageCount} süsiniku kattuvust.`;

  const dataGapSummary = disconnected.length > 0
    ? `Suurim piirang on ${disconnected.map((source) => source.name).join(", ")}. Need ei ole praegu faktitõendina kasutusel.`
    : "Peamised allikad on selle prototüübi jaoks laetud.";

  const primaryTakeaway = hasAnyNotice || hasChangeProof
    ? activitySummary
    : protectionSummary.length > 0
      ? "Kõige olulisem ei ole siin raietõend, vaid keskkonnakontekst: tegevust andmepakk ei kinnita, kuid kaitse/ELME kihid muudavad tõlgenduse tundlikumaks."
      : "Kõige olulisem on andmepiir: andmepakk kirjeldab ala ja registriseisu, kuid ei näita konkreetset hiljutist tegevust.";

  return {
    primaryTakeaway,
    activity: {
      id: "interpretation-activity",
      title: "Mis paistab toimunud olevat?",
      summary: activitySummary,
      tone: hasAnyNotice || hasChangeProof ? "attention" : "positive",
      evidenceIds: ["registry-active-notices", "registry-archived-notices", "forest-change-proof"],
      metrics: [
        metric("Aktiivsed teatised", activeNotices),
        metric("Arhiveeritud teatised", archivedNotices),
        metric("Muutusetõend", hasChangeProof ? "olemas" : "ühendamata")
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    },
    standStructure: {
      id: "interpretation-stand-structure",
      title: "Metsa struktuur registris",
      summary: standSummary,
      tone: isFinelySplit ? "attention" : "neutral",
      evidenceIds: ["registry-stands"],
      metrics: [
        metric("Eraldised", registrySummary.standsCount),
        metric("Keskmine eraldis", compactMetric(averageStandAreaHa, " ha")),
        metric("Eraldisi / 100 ha", compactMetric(standsPer100Ha)),
        metric("Eraldiste pindala katvus", compactMetric(standCoveragePercent, "%")),
        metric("Puuliigid", registrySummary.dominantSpecies.join(", "))
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    },
    nature: {
      id: "interpretation-nature",
      title: "Kaitse ja looduse hüved",
      summary: natureSummary,
      tone: protectionSummary.length > 0 ? "attention" : "neutral",
      evidenceIds: ["protection-summary", "elme-context"],
      metrics: [
        metric("EELIS grupid", protectionSummary.length),
        metric("Puidutooraine", ecosystemContext.woodRawMaterialCount),
        metric("Süsinik", ecosystemContext.carbonStorageCount),
        metric("ELME muud", ecosystemContext.otherCount)
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    },
    dataGaps: {
      id: "interpretation-data-gaps",
      title: "Mis piirab järeldust?",
      summary: dataGapSummary,
      tone: disconnected.length > 0 ? "limit" : "positive",
      evidenceIds: ["forest-change-proof"],
      metrics: [
        metric("Laetud allikad", `${loaded.length}/${sourceStatus.length}`),
        metric("Ühendamata/puudu", disconnected.length)
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    }
  };
}

function buildTimelineSummary(
  registrySummary: NormalizedRegistrySummary,
  pkg: ForestAreaEvidencePackage
): NormalizedTimelineItem[] {
  const items: NormalizedTimelineItem[] = [];

  if (registrySummary.inventoryYears.length > 0) {
    items.push({
      id: "timeline-inventory-summary",
      year: registrySummary.oldestInventoryYear,
      label: "Metsainventuur",
      detail: registrySummary.inventorySummary,
      tone: registrySummary.veryOldInventory ? "warning" : "success",
      evidenceIds: ["registry-stands"]
    });
  }

  if (pkg.forestRegistry.notices.length > 0) {
    items.push({
      id: "timeline-active-notices",
      label: "Metsateatised",
      detail: `${pkg.forestRegistry.notices.length} aktiivset või mittearhiveeritud metsateatist.`,
      tone: "info",
      evidenceIds: ["registry-active-notices"]
    });
  }

  if (pkg.forestRegistry.archivedNotices.length > 0) {
    items.push({
      id: "timeline-archived-notices",
      label: "Arhiveeritud metsateatised",
      detail: `${pkg.forestRegistry.archivedNotices.length} arhiveeritud metsateatist.`,
      tone: "info",
      evidenceIds: ["registry-archived-notices"]
    });
  }

  if (pkg.eelis.sourceStatus === "loaded") {
    items.push({
      id: "timeline-protection-context",
      label: "Kaitsekontekst",
      detail: "EELIS näitab valitud alal kaitse-, Natura-, VEP- või elupaigakattuvusi.",
      tone: "info",
      evidenceIds: ["protection-summary"]
    });
  }

  return items;
}

export function normalizeSelectedAreaEvidence({
  area,
  confidenceScore,
  evidencePackage: pkg
}: NormalizeInput): NormalizedSelectedAreaEvidence {
  const registrySummary = buildRegistrySummary(pkg);
  const protectionSummary = buildProtectionSummary(pkg);
  const ecosystemContext = buildEcosystemContext(pkg);
  const sourceStatus = buildSourceStatus(pkg);
  const dataState = dataCompleteness(confidenceScore, sourceStatus);
  const interpretation = buildInterpretation({
    area,
    pkg,
    registrySummary,
    protectionSummary,
    ecosystemContext,
    sourceStatus
  });
  const isEtakForest = area.type === "forest" && Boolean(area.etakId);
  const evidenceItems: NormalizedEvidenceItem[] = [
    {
      id: "area-base",
      sourceId: "maaamet-etak-forest",
      label: isEtakForest ? "ETAK metsaala" : "Valitud ala",
      summary: isEtakForest
        ? `ETAK-i järgi metsaala, pindala ${formatHa(area.areaHa)}.`
        : `Valitud katastriüksus või ala, pindala ${formatHa(area.areaHa)}.`,
      status: "loaded",
      tone: "neutral",
      targetId: "card-basic"
    },
    {
      id: "cadastre-context",
      sourceId: "maaamet-cadastre",
      label: "Katastriüksus",
      summary: [
        area.cadastralId ? `katastriüksus ${area.cadastralId}` : "katastriüksus puudub",
        area.ownershipForm ? area.ownershipForm.toLocaleLowerCase("et") : "omandivorm puudub",
        area.landUse ? area.landUse.toLocaleLowerCase("et") : ""
      ]
        .filter(Boolean)
        .join(" · "),
      status: pkg.cadastre.sourceStatus,
      tone: sourceTone(pkg.cadastre.sourceStatus),
      targetId: "card-basic"
    },
    {
      id: "registry-stands",
      sourceId: "metsaregister",
      label: "Metsaregistri eraldised",
      summary:
        registrySummary.standsCount > 0
          ? `${registrySummary.standsCount} eraldist; ${registrySummary.inventorySummary}`
          : "Eraldisi ei leitud.",
      status: pkg.forestRegistry.sourceStatus,
      tone: registrySummary.veryOldInventory ? "attention" : sourceTone(pkg.forestRegistry.sourceStatus),
      targetId: "card-registry"
    },
    {
      id: "registry-active-notices",
      sourceId: "metsaregister",
      label: "Aktiivsed metsateatised",
      summary:
        registrySummary.activeNoticesCount > 0
          ? `${registrySummary.activeNoticesCount} aktiivset või mittearhiveeritud metsateatist.`
          : "Aktiivseid metsateatisi ei leitud.",
      status: pkg.forestRegistry.sourceStatus,
      tone: registrySummary.activeNoticesCount > 0 ? "attention" : "positive",
      targetId: "card-attention"
    },
    {
      id: "registry-archived-notices",
      sourceId: "metsaregister",
      label: "Arhiveeritud metsateatised",
      summary:
        registrySummary.archivedNoticesCount > 0
          ? `${registrySummary.archivedNoticesCount} arhiveeritud metsateatist.`
          : "Arhiveeritud metsateatisi ei leitud.",
      status: pkg.forestRegistry.sourceStatus,
      tone: "neutral",
      targetId: "card-attention"
    },
    {
      id: "protection-summary",
      sourceId: "eelis",
      label: "EELIS kattuvused",
      summary:
        protectionSummary.length > 0
          ? `${protectionSummary.length} kaitse-, Natura-, VEP- või elupaigagruppi.`
          : "Kaitse- või piirangukattuvust ei leitud.",
      status: pkg.eelis.sourceStatus,
      tone: protectionSummary.length > 0 ? "attention" : sourceTone(pkg.eelis.sourceStatus),
      targetId: "card-protection"
    },
    {
      id: "forest-change-proof",
      sourceId: "forest-changes",
      label: "Metsamuutuste/LiDAR tõend",
      summary: pkg.forestChanges.hasChangeEvidence
        ? `${pkg.forestChanges.lidarChangeOverlaps.length} muutusetõendit.`
        : "Ühendamata; raie toimumist ei saa selle prototüübi põhjal kinnitada.",
      status: pkg.forestChanges.sourceStatus,
      tone: pkg.forestChanges.hasChangeEvidence ? "attention" : "limit",
      targetId: "card-cannot-claim"
    },
    {
      id: "elme-context",
      sourceId: "elme",
      label: "ELME looduse hüved",
      summary: [
        ecosystemContext.summary,
        `Puidutooraine kattuvusi: ${ecosystemContext.woodRawMaterialCount}.`,
        `Süsiniku kattuvusi: ${ecosystemContext.carbonStorageCount}.`,
        `Muid ELME kattuvusi: ${ecosystemContext.otherCount}.`
      ].join(" "),
      status: ecosystemContext.sourceStatus,
      tone: "neutral",
      targetId: "card-ecosystem"
    }
  ];

  const keyFindings: NormalizedKeyFinding[] = [
    {
      id: "finding-notices",
      title: "Metsateatised",
      summary:
        registrySummary.activeNoticesCount > 0
          ? `Metsaregistris on ${registrySummary.activeNoticesCount} aktiivset või mittearhiveeritud metsateatist.`
          : "Aktiivseid ega mittearhiveeritud metsateatisi ei leitud.",
      tone: registrySummary.activeNoticesCount > 0 ? "attention" : "positive",
      evidenceIds: ["registry-active-notices"]
    },
    {
      id: "finding-change-proof",
      title: "Tegelik muutus",
      summary: pkg.forestChanges.hasChangeEvidence
        ? `Metsamuutuste andmetes on ${pkg.forestChanges.lidarChangeOverlaps.length} kattuvust.`
        : "Metsamuutuste/LiDAR tõend on ühendamata, seega süsteem ei tohi väita, et raie toimus.",
      tone: pkg.forestChanges.hasChangeEvidence ? "attention" : "limit",
      evidenceIds: ["forest-change-proof"]
    },
    {
      id: "finding-protection",
      title: "Kaitsekontekst",
      summary:
        protectionSummary.length > 0
          ? `EELIS näitab ${protectionSummary.length} koondatud kaitse-, Natura-, VEP- või elupaigakattuvust.`
          : "EELIS ei tagastanud kaitse- ega piirangukattuvust.",
      tone: protectionSummary.length > 0 ? "attention" : "neutral",
      evidenceIds: ["protection-summary"]
    },
    {
      id: "finding-inventory-age",
      title: "Inventuuri vanus",
      summary: registrySummary.inventorySummary,
      tone: registrySummary.veryOldInventory ? "attention" : "neutral",
      evidenceIds: ["registry-stands"]
    },
    {
      id: "finding-area-context",
      title: "Ala ja omand",
      summary: [
        formatHa(area.areaHa),
        area.ownershipForm?.toLocaleLowerCase("et"),
        area.cadastralId ? `katastriüksus ${area.cadastralId}` : ""
      ]
        .filter(Boolean)
        .join(" · "),
      tone: "neutral",
      evidenceIds: ["area-base", "cadastre-context"]
    },
    {
      id: "finding-ecosystem-context",
      title: "Looduse hüved",
      summary:
        ecosystemContext.woodRawMaterialCount > 0 ||
        ecosystemContext.carbonStorageCount > 0 ||
        ecosystemContext.otherCount > 0
          ? `ELME: ${ecosystemContext.woodRawMaterialCount} puidutooraine, ${ecosystemContext.carbonStorageCount} süsiniku ja ${ecosystemContext.otherCount} muud kattuvust.`
          : "ELME looduse hüvede kattuvust ei leitud.",
      tone: "neutral",
      evidenceIds: ["elme-context"]
    }
  ];

  const criticalGaps: NormalizedKeyFinding[] = [
    {
      id: "gap-change-proof",
      title: "Raie toimumise tõend",
      summary:
        "Metsamuutuste/LiDAR muutusetõend on ühendamata; metsateatis üksi ei kinnita tehtud raiet.",
      tone: "limit",
      evidenceIds: ["forest-change-proof"]
    },
    {
      id: "gap-expertises",
      title: "Metsakaitse ja uuenduse detailid",
      summary:
        "Metsakaitseekspertiisid, metsauuenduse info ja välitööde detailid ei ole selles prototüübis valitud ala tõendina kasutusel.",
      tone: "limit",
      evidenceIds: []
    }
  ];

  const cannotClaim: NormalizedKeyFinding[] = [
    {
      id: "claim-harvest",
      title: "Raie toimumist ei saa kinnitada",
      summary:
        "Seda saab väita ainult siis, kui registriteatis ja tegelik muutusetõend koos seda toetavad.",
      tone: "limit",
      evidenceIds: ["forest-change-proof", "registry-active-notices"]
    },
    {
      id: "claim-legal",
      title: "Kattuvus ei ole õiguslik otsus",
      summary:
        "EELIS kattuvus on oluline kontekst, aga see ei ütle automaatselt, et tegevus on keelatud või lubatud.",
      tone: "limit",
      evidenceIds: ["protection-summary"]
    },
    {
      id: "claim-elme",
      title: "ELME ei ole majanduslik soovitus",
      summary:
        "ELME väärtused on taust, mitte soovitus raiuda, mitte raiuda ega hinnang tegevuse lubatavusele.",
      tone: "limit",
      evidenceIds: ["elme-context"]
    }
  ];

  const quickAnswer = uniqueRows([
    isEtakForest
      ? `Ala on ETAK-i järgi metsaala, pindala ${formatHa(area.areaHa)}.`
      : `Valitud ala pindala on ${formatHa(area.areaHa)}.`,
    [
      area.cadastralId ? `Katastriüksus ${area.cadastralId}` : "",
      area.ownershipForm ? area.ownershipForm.toLocaleLowerCase("et") : ""
    ]
      .filter(Boolean)
      .join(" · "),
    `Metsaregistrist leiti ${registrySummary.standsCount} eraldist; aktiivseid teatisi ${registrySummary.activeNoticesCount}, arhiveeritud teatisi ${registrySummary.archivedNoticesCount}.`,
    protectionSummary.length > 0
      ? `EELIS näitab kaitse-, Natura-, VEP- või elupaigakattuvusi.`
      : "EELIS kaitsekattuvust ei näidanud.",
    registrySummary.veryOldInventory
      ? `Inventuuriandmed võivad olla väga vanad: ${registrySummary.inventorySummary}`
      : "",
    pkg.forestChanges.hasChangeEvidence
      ? "Metsamuutuste tõend on olemas."
      : "Metsamuutuste/LiDAR tõend on ühendamata; süsteem ei tohi väita, et raie toimus."
  ]).slice(0, 5);

  return {
    area: {
      title: publicAreaTitle(area),
      subtitle: [
        formatHa(area.areaHa),
        area.ownershipForm?.toLocaleLowerCase("et"),
        area.cadastralId ? `katastriüksus ${area.cadastralId}` : undefined
      ]
        .filter(Boolean)
        .join(" · "),
      areaHa: area.areaHa,
      cadastralId: area.cadastralId,
      ownershipForm: area.ownershipForm,
      landUse: area.landUse,
      etakId: area.etakId,
      type: area.type
    },
    quickAnswer,
    keyFindings,
    criticalGaps,
    cannotClaim,
    evidenceItems,
    sourceStatus,
    protectionSummary,
    registrySummary,
    ecosystemContext,
    dataCompleteness: dataState,
    interpretation,
    timeline: buildTimelineSummary(registrySummary, pkg),
    aiContext: {
      answerRules: [
        "Kasuta ainult normalizedEvidence fakte.",
        "Metsateatis ei tõenda üksi tehtud raiet.",
        "EELIS kattuvus ei ole lõplik õiguslik otsus.",
        "Ühendamata allika kohta ütle selgelt, et seda ei kasutata tõendina."
      ],
      evidenceRequired: [
        "Iga kindel väide peab viitama evidenceItems id-le.",
        "Kui evidence id puudub, sõnasta väide piiranguna, mitte faktina."
      ]
    }
  };
}
