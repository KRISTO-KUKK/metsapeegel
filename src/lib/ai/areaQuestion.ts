import type {
  AnalysisResult,
  AreaAnswerEvidence,
  AreaQuestionAnswer,
  AnswerVerdict,
  EvidenceTone,
  NormalizedEvidenceItem,
  NormalizedSelectedAreaEvidence
} from "@/lib/types/forestry";

type AreaQuestionInput = {
  analysis: AnalysisResult;
  question: string;
  history?: AreaQuestionHistoryItem[];
};

type AreaQuestionHistoryItem = {
  question: string;
  answer: string;
};

type AiAnswerPayload = {
  verdict?: string;
  shortAnswer?: string;
  explanation?: string;
  canSay?: string[];
  cannotSay?: string[];
  missingInfo?: string[];
  evidenceIds?: string[];
  followUps?: string[];
  mapHints?: string[];
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      output_text?: string;
      parsed?: unknown;
      type?: string;
    }>;
  }>;
};

type QuestionFocus = {
  kind:
    | "ecosystem"
    | "wood_raw_material"
    | "carbon"
    | "source_status"
    | "registry"
    | "protection"
    | "area";
  title: string;
  shortAnswer: string;
  explanation: string;
  canSay: string[];
  cannotSay: string[];
  evidenceIds: string[];
  exactNumbers: number[];
};

const defaultOpenAiModel = "gpt-4.1-mini";

const verdictLabels: Record<AnswerVerdict, string> = {
  supported: "Andmed toetavad",
  partial: "Osaliselt toetatud",
  not_supported: "Andmed ei toeta",
  unknown: "Andmetest ei piisa"
};

const sourceShortLabels: Record<string, string> = {
  "maaamet-etak-forest": "ETAK",
  "maaamet-cadastre": "Kataster",
  metsaregister: "Metsaregister",
  eelis: "EELIS",
  elme: "ELME",
  "forest-changes": "Metsamuutused/LiDAR",
  kaia: "KAIA",
  "smi-kese": "SMI/KESE"
};

function normalizeQuestion(question: string) {
  return question.trim().toLocaleLowerCase("et");
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function detectedIntent(question: string) {
  const normalized = normalizeQuestion(question);

  return {
    asksAttention: includesAny(normalized, [
      "tähele",
      "oluline",
      "risk",
      "millele",
      "prioriteet",
      "kokkuvõte",
      "selgita",
      "mida saab",
      "kindlalt"
    ]),
    asksInterpretiveSummary: includesAny(normalized, [
      "võta kokku",
      "vota kokku",
      "kokkuvõte",
      "kokkuvote",
      "tõenäoliselt",
      "toenaoliselt",
      "mis siin",
      "paistab",
      "tundub",
      "järeldus",
      "jareldus",
      "järeldada",
      "jareldada"
    ]),
    asksAreaSize: includesAny(normalized, [
      "kui suur",
      "pindala",
      "suurus",
      "hektar",
      " ha"
    ]),
    asksBroadSearch: includesAny(normalized, [
      "näita alasid",
      "otsi alasid",
      "kus on",
      "üle eesti",
      "kõik alad"
    ]),
    asksHarvest: includesAny(normalized, [
      "raie",
      "raiuti",
      "raiutud",
      "lageraie",
      "harvendus",
      "sanitaar",
      "toimus",
      "maha võetud"
    ]),
    asksLegal: includesAny(normalized, [
      "seadus",
      "seaduslik",
      "ebaseadus",
      "rikkumine",
      "lubatud",
      "keelatud",
      "õiguspärane"
    ]),
    asksLimits: includesAny(normalized, [
      "ei saa väita",
      "ei saa järeldada",
      "mida ei",
      "piir",
      "puudu",
      "andmed puuduvad"
    ]),
    asksNotice: includesAny(normalized, ["teatis", "metsateatis"]),
    asksEcosystem: includesAny(normalized, [
      "elme",
      "looduse hüv",
      "looduse huv",
      "puidutooraine",
      "puidu",
      "süsinik",
      "susinik",
      "ökosüsteem",
      "okosusteem",
      "biomass",
      "euro",
      "t c/ha"
    ]),
    asksOwnership: includesAny(normalized, [
      "omand",
      "omanik",
      "kuulub",
      "riigiomand",
      "eraomand",
      "eramaa",
      "riigimaa",
      "munitsipaal"
    ]),
    asksProtection: includesAny(normalized, [
      "kaitse",
      "kaitseal",
      "natura",
      "piirang",
      "vääriselupaik",
      "vep",
      "elupaik"
    ])
  };
}

function uniqueRows(rows: Array<string | undefined | null>) {
  return Array.from(new Set(rows.filter((row): row is string => Boolean(row))));
}

function cleanStringArray(value: unknown, max = 6) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function toneFromNormalized(item: NormalizedEvidenceItem): EvidenceTone {
  if (item.tone === "positive") return "success";
  if (item.tone === "attention") return "warning";
  if (item.tone === "limit") return "danger";
  return "info";
}

function evidenceFromAnalysis(analysis: AnalysisResult): AreaAnswerEvidence[] {
  const sourceNames = new Map(
    analysis.normalizedEvidence.sourceStatus.map((source) => [
      source.id,
      source.name
    ])
  );

  return analysis.normalizedEvidence.evidenceItems.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.summary,
    source:
      sourceShortLabels[item.sourceId] ??
      sourceNames.get(item.sourceId) ??
      item.sourceId,
    sourceId: item.sourceId,
    tone: toneFromNormalized(item)
  }));
}

function evidenceById(
  normalized: NormalizedSelectedAreaEvidence,
  evidenceIds: string[]
) {
  const known = new Set(normalized.evidenceItems.map((item) => item.id));
  return Array.from(new Set(evidenceIds.filter((id) => known.has(id))));
}

function defaultEvidenceIds(normalized: NormalizedSelectedAreaEvidence) {
  return evidenceById(
    normalized,
    [
      ...normalized.keyFindings.flatMap((finding) => finding.evidenceIds),
      ...normalized.cannotClaim.flatMap((finding) => finding.evidenceIds)
    ]
  ).slice(0, 8);
}

function harvestHasChangeProof(analysis: AnalysisResult) {
  return Boolean(analysis.evidencePackage.forestChanges.hasChangeEvidence);
}

function ownershipCategory(value?: string) {
  if (!value) return null;
  const normalized = value.toLocaleLowerCase("et");
  if (normalized.includes("era") || normalized.includes("füüs") || normalized.includes("juriid")) {
    return "private";
  }
  if (normalized.includes("riigi") || normalized.includes("riik")) {
    return "state";
  }
  if (normalized.includes("munitsipaal") || normalized.includes("omavalits")) {
    return "municipal";
  }
  return "other";
}

function claimedOwnershipCategory(question: string) {
  const normalized = normalizeQuestion(question);
  if (
    normalized.includes("eraomand") ||
    normalized.includes("era omand") ||
    normalized.includes("eramaa") ||
    normalized.includes("eraomanik")
  ) {
    return "private";
  }
  if (
    normalized.includes("riigiomand") ||
    normalized.includes("riigi omand") ||
    normalized.includes("riigimaa") ||
    normalized.includes("riigi")
  ) {
    return "state";
  }
  if (normalized.includes("munitsipaal") || normalized.includes("omavalits")) {
    return "municipal";
  }
  return null;
}

function ownershipLabel(category: string | null) {
  switch (category) {
    case "private":
      return "eraomand";
    case "state":
      return "riigiomand";
    case "municipal":
      return "munitsipaalomand";
    default:
      return "see omandivorm";
  }
}

function areaSquareKm(areaHa: number) {
  return Math.round((areaHa / 100) * 1000) / 1000;
}

function roundMetric(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sumKnownOverlapHa(
  groups: NormalizedSelectedAreaEvidence["protectionSummary"]
) {
  const values = groups
    .map((group) => group.overlapHa)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return undefined;
  }

  return roundMetric(values.reduce((sum, value) => sum + value, 0), 2);
}

function interpretationSignalsForAnalysis(analysis: AnalysisResult) {
  const normalized = analysis.normalizedEvidence;
  const registry = normalized.registrySummary;
  const areaHa = normalized.area.areaHa;
  const averageStandAreaHa =
    registry.standsCount > 0 && areaHa > 0
      ? roundMetric(areaHa / registry.standsCount, 2)
      : undefined;
  const standsPer100Ha =
    registry.standsCount > 0 && areaHa > 0
      ? roundMetric((registry.standsCount / areaHa) * 100, 1)
      : undefined;
  const standStructure =
    averageStandAreaHa === undefined
      ? "Metsaregistri eraldiste jaotust ei saa hinnata, sest eraldisi ei leitud."
      : averageStandAreaHa < 1
        ? "Ala on registris väga peenelt eraldisteks jaotatud; see võib viidata kirjumale metsakoosseisule või detailsele inventuurile."
        : averageStandAreaHa <= 3
          ? "Ala on registris üsna mitmeks eraldiseks jaotatud; see ei paista ühe ühtlase metsaplokina."
          : "Eraldised on keskmiselt suuremad; registri järgi on ala vähem peeneks jaotatud.";
  const hasActiveNotices = registry.activeNoticesCount > 0;
  const hasArchivedNotices = registry.archivedNoticesCount > 0;
  const hasChangeProof = harvestHasChangeProof(analysis);
  const knownProtectionOverlapHa = sumKnownOverlapHa(normalized.protectionSummary);
  const sourceGaps = normalized.sourceStatus
    .filter((source) => source.status !== "loaded")
    .map((source) => ({
      id: source.id,
      name: source.name,
      status: source.status,
      summary: source.summary
    }));

  return {
    standStructure: {
      standsCount: registry.standsCount,
      averageStandAreaHa,
      standsPer100Ha,
      interpretation: standStructure,
      caveat:
        "See on arvutus valitud ala pindala ja Metsaregistri eraldiste arvu põhjal, mitte eraldi metsanduslik eksperthinnang."
    },
    activityEvidence: {
      activeNotices: registry.activeNoticesCount,
      archivedNotices: registry.archivedNoticesCount,
      hasAnyNotice: hasActiveNotices || hasArchivedNotices,
      hasChangeProof,
      interpretation:
        hasActiveNotices && hasChangeProof
          ? "Registriteatis ja muutusetõend on koos olemas; see on tugevaim tegevuse signaal selles prototüübis."
          : hasActiveNotices || hasArchivedNotices
            ? "Metsateatis on registris olemas, aga ilma muutusetõendita ei saa öelda, et töö toimus."
            : hasChangeProof
              ? "Muutusetõend on olemas, aga metsateatise seos puudub selles andmepakis."
              : "Andmepakk ei näita praegu aktiivset metsateatist ega ühendatud muutusetõendit; tegevuse toimumist ei saa kinnitada."
    },
    protection: {
      groupsCount: normalized.protectionSummary.length,
      knownOverlapHa: knownProtectionOverlapHa,
      groups: normalized.protectionSummary,
      interpretation:
        normalized.protectionSummary.length > 0
          ? "Kaitse- või keskkonnakattuvus on olemas, seega peaks seda ala tõlgendades olema ettevaatlikum."
          : "Ühendatud EELIS kihid ei näita kaitse- või piirangukattuvust."
    },
    inventory: {
      years: registry.inventoryYears,
      oldestYear: registry.oldestInventoryYear,
      newestYear: registry.newestInventoryYear,
      veryOld: registry.veryOldInventory,
      summary: registry.inventorySummary,
      interpretation: registry.veryOldInventory
        ? "Inventuuriandmed on vanad, seega tänase metsaseisu kohta tuleb järeldusi hoida ettevaatlikuna."
        : "Inventuuri vanus ei ole selles andmepakis peamine punane lipp."
    },
    ecosystem: {
      woodRawMaterialCount: normalized.ecosystemContext.woodRawMaterialCount,
      carbonStorageCount: normalized.ecosystemContext.carbonStorageCount,
      otherCount: normalized.ecosystemContext.otherCount,
      summary: normalized.ecosystemContext.summary
    },
    sourceGaps
  };
}

function interpretiveSummaryAnswer(input: AreaQuestionInput): AreaQuestionAnswer {
  const { analysis, question } = input;
  const normalized = analysis.normalizedEvidence;
  const signals = interpretationSignalsForAnalysis(analysis);
  const hasProtection = normalized.protectionSummary.length > 0;
  const hasChangeProof = harvestHasChangeProof(analysis);
  const evidenceIds = evidenceById(
    normalized,
    [
      "registry-active-notices",
      "registry-archived-notices",
      "registry-stands",
      "forest-change-proof",
      "protection-summary",
      "elme-context"
    ]
  );

  return {
    mode: "template",
    status: "ready",
    provider: "deterministic-normalized-evidence",
    question,
    verdict: "partial",
    verdictLabel: verdictLabels.partial,
    confidence: normalized.dataCompleteness.score,
    shortAnswer:
      "Kõige ausam kokkuvõte: andmepakk ei kinnita siin toimunud raiet ega muud konkreetset tegevust, aga näitab registris kirjeldatud metsaala koos keskkonnakontekstiga.",
    explanation: [
      signals.activityEvidence.interpretation,
      signals.standStructure.interpretation,
      hasProtection
        ? signals.protection.interpretation
        : undefined,
      signals.inventory.interpretation,
      "Seega saab öelda, mis kontekst sellel alal on, aga mitte kindlalt, mis siin hiljuti füüsiliselt juhtus."
    ]
      .filter(Boolean)
      .join("\n"),
    canSay: uniqueRows([
      `${signals.standStructure.standsCount} Metsaregistri eraldist; keskmiselt ${signals.standStructure.averageStandAreaHa ?? "?"} ha eraldise kohta.`,
      `${signals.activityEvidence.activeNotices} aktiivset ja ${signals.activityEvidence.archivedNotices} arhiveeritud metsateatist.`,
      hasProtection
        ? `${signals.protection.groupsCount} koondatud EELIS kattuvust.`
        : "EELIS kaitsekattuvust ei näidanud.",
      normalized.ecosystemContext.woodRawMaterialCount +
        normalized.ecosystemContext.carbonStorageCount +
        normalized.ecosystemContext.otherCount >
      0
        ? `ELME lisakontekst: ${normalized.ecosystemContext.woodRawMaterialCount} puidutooraine, ${normalized.ecosystemContext.carbonStorageCount} süsiniku ja ${normalized.ecosystemContext.otherCount} muud kattuvust.`
        : undefined
    ]),
    cannotSay: uniqueRows([
      !hasChangeProof
        ? "Tegelikku raiet või muutust ei saa kinnitada, sest metsamuutuste/LiDAR tõend ei ole ühendatud."
        : undefined,
      "Eraldiste arv ei tõenda iseenesest raiet, vaid kirjeldab registri jaotust.",
      "Kaitsekattuvus ei ole automaatne õiguslik otsus."
    ]),
    evidence: evidenceFromAnalysis(analysis),
    evidenceIds,
    mapHints: [],
    followUps: [
      "Kas siin on raie kohta tõendeid?",
      "Miks eraldisi nii palju on?",
      "Mis oleks kõige suurem andmelünk?"
    ],
    sources: analysis.sources
  };
}

function factsFromQuickAnswer(normalized: NormalizedSelectedAreaEvidence) {
  return normalized.quickAnswer.slice(0, 5);
}

function limitsFromNormalized(normalized: NormalizedSelectedAreaEvidence) {
  return uniqueRows([
    ...normalized.cannotClaim.map((item) => item.summary),
    ...normalized.criticalGaps.map((item) => item.summary)
  ]).slice(0, 6);
}

function questionFocusForAnalysis(
  analysis: AnalysisResult,
  question: string
): QuestionFocus | null {
  const normalizedQuestion = normalizeQuestion(question);
  const normalized = analysis.normalizedEvidence;
  const ecosystem = normalized.ecosystemContext;

  if (
    includesAny(normalizedQuestion, [
      "puidutooraine",
      "puidu tooraine",
      "puidu",
      "wood"
    ])
  ) {
    return {
      kind: "wood_raw_material",
      title: "ELME puidutooraine",
      shortAnswer: `Puidutooraine kattuvusi on ${ecosystem.woodRawMaterialCount}.`,
      explanation:
        ecosystem.woodRawMaterialCount > 0
          ? "See arv tuleb ELME looduse hüvede puidutooraine kattuvustest valitud geomeetriaga."
          : "ELME puidutooraine kattuvusi selles andmepakis ei leitud.",
      canSay: uniqueRows([
        `Puidutooraine kattuvusi: ${ecosystem.woodRawMaterialCount}.`,
        `Süsiniku kattuvusi: ${ecosystem.carbonStorageCount}.`,
        `Muid ELME kattuvusi: ${ecosystem.otherCount}.`,
        ecosystem.woodEurPerHaMin !== undefined &&
        ecosystem.woodEurPerHaMax !== undefined
          ? `Puidutooraine hinnangu vahemik: ${ecosystem.woodEurPerHaMin}-${ecosystem.woodEurPerHaMax} eurot/ha.`
          : undefined,
        ecosystem.woodTotalEur !== undefined
          ? `Leitud puidutooraine hinnangute summa: ${ecosystem.woodTotalEur} eurot.`
          : undefined
      ]),
      cannotSay: [
        "ELME väärtused on kontekst, mitte raietõend ega tegevuse lubatavuse otsus.",
        "Kui metoodika ei luba väärtusi summeerida, ei tohi neid esitada lõpliku majandusliku hinnanguna."
      ],
      evidenceIds: ["elme-context"],
      exactNumbers: [
        ecosystem.woodRawMaterialCount,
        ecosystem.carbonStorageCount,
        ecosystem.otherCount
      ]
    };
  }

  if (includesAny(normalizedQuestion, ["süsinik", "susinik", "carbon", "t c/ha"])) {
    return {
      kind: "carbon",
      title: "ELME süsinik",
      shortAnswer: `Süsiniku kattuvusi on ${ecosystem.carbonStorageCount}.`,
      explanation:
        ecosystem.carbonStorageCount > 0
          ? "See arv tuleb ELME süsiniku kattuvustest valitud geomeetriaga."
          : "ELME süsiniku kattuvusi selles andmepakis ei leitud.",
      canSay: uniqueRows([
        `Süsiniku kattuvusi: ${ecosystem.carbonStorageCount}.`,
        `Puidutooraine kattuvusi: ${ecosystem.woodRawMaterialCount}.`,
        ecosystem.carbonTonPerHaMin !== undefined &&
        ecosystem.carbonTonPerHaMax !== undefined
          ? `Süsiniku hinnangu vahemik: ${ecosystem.carbonTonPerHaMin}-${ecosystem.carbonTonPerHaMax} t C/ha.`
          : undefined
      ]),
      cannotSay: [
        "Süsiniku hinnang ei tõenda raiet ega tegevuse lubatavust.",
        "See ei ole lõplik kliima- või majandusotsus."
      ],
      evidenceIds: ["elme-context"],
      exactNumbers: [
        ecosystem.carbonStorageCount,
        ecosystem.woodRawMaterialCount
      ]
    };
  }

  if (
    includesAny(normalizedQuestion, [
      "elme",
      "looduse hüv",
      "looduse huv",
      "ökosüsteem",
      "okosusteem",
      "biomass"
    ])
  ) {
    return {
      kind: "ecosystem",
      title: "ELME looduse hüved",
      shortAnswer: `ELME andmepakis on ${ecosystem.woodRawMaterialCount} puidutooraine, ${ecosystem.carbonStorageCount} süsiniku ja ${ecosystem.otherCount} muud kattuvust.`,
      explanation:
        "Need on valitud ala lisakonteksti kihid. Need ei tõenda raiet ega tegevuse lubatavust.",
      canSay: uniqueRows([
        `Puidutooraine kattuvusi: ${ecosystem.woodRawMaterialCount}.`,
        `Süsiniku kattuvusi: ${ecosystem.carbonStorageCount}.`,
        `Muid ELME kattuvusi: ${ecosystem.otherCount}.`,
        ecosystem.summary
      ]),
      cannotSay: [
        "ELME ei ole raietõend.",
        "ELME ei ole majanduslik soovitus ega õiguslik otsus."
      ],
      evidenceIds: ["elme-context"],
      exactNumbers: [
        ecosystem.woodRawMaterialCount,
        ecosystem.carbonStorageCount,
        ecosystem.otherCount
      ]
    };
  }

  return null;
}

function exactNumberMentioned(answer: AreaQuestionAnswer, focus: QuestionFocus | null) {
  if (!focus || focus.exactNumbers.length === 0) {
    return true;
  }

  const text = `${answer.shortAnswer}\n${answer.explanation}\n${answer.canSay.join("\n")}`;
  if (focus.kind === "wood_raw_material" || focus.kind === "carbon") {
    return text.includes(String(focus.exactNumbers[0]));
  }

  return focus.exactNumbers.some((value) => text.includes(String(value)));
}

function answerForIntent(input: AreaQuestionInput): AreaQuestionAnswer {
  const { analysis, question } = input;
  const normalized = analysis.normalizedEvidence;
  const intent = detectedIntent(question);
  const registry = normalized.registrySummary;
  const hasActiveNotices = registry.activeNoticesCount > 0;
  const hasArchivedNotices = registry.archivedNoticesCount > 0;
  const hasAnyNotice = hasActiveNotices || hasArchivedNotices;
  const hasChangeProof = harvestHasChangeProof(analysis);
  const hasProtection = normalized.protectionSummary.length > 0;
  const focus = questionFocusForAnalysis(analysis, question);

  let verdict: AnswerVerdict = "supported";
  let shortAnswer =
    normalized.keyFindings[0]?.summary ??
    "Saan vastata ainult valitud ala andmepaki põhjal.";
  let explanation = normalized.quickAnswer.join(" ");
  let canSay = factsFromQuickAnswer(normalized);
  let cannotSay = limitsFromNormalized(normalized);
  let evidenceIds = defaultEvidenceIds(normalized);

  if (focus) {
    verdict = "supported";
    shortAnswer = focus.shortAnswer;
    explanation = focus.explanation;
    canSay = focus.canSay;
    cannotSay = uniqueRows([...focus.cannotSay, ...limitsFromNormalized(normalized)]).slice(0, 6);
    evidenceIds = evidenceById(normalized, focus.evidenceIds);
  } else if (intent.asksInterpretiveSummary) {
    return interpretiveSummaryAnswer(input);
  } else if (intent.asksBroadSearch) {
    verdict = "unknown";
    shortAnswer =
      "Seda küsimust ei saa ainult valitud ala andmepaki põhjal lahendada.";
    explanation =
      "Praegune vestlus mäletab valitud metsaala konteksti. Üle-Eestiline otsing vajab eraldi eelindeksit, mis sama tõendimudeli järgi alasid järjestab.";
    cannotSay = uniqueRows([
      "Ma ei väida praegu, et olen leidnud kõik Eesti alad, kus see tingimus kehtib.",
      ...cannotSay
    ]);
  } else if (intent.asksOwnership) {
    const actual = ownershipCategory(normalized.area.ownershipForm);
    const claimed = claimedOwnershipCategory(question);
    evidenceIds = evidenceById(normalized, ["cadastre-context", "area-base"]);
    canSay = uniqueRows([
      normalized.area.ownershipForm
        ? `Katastri avalikus kontekstis on omandivorm: ${normalized.area.ownershipForm}.`
        : "Omandivormi sellest andmepakist ei leitud.",
      normalized.area.cadastralId
        ? `Katastriüksus: ${normalized.area.cadastralId}.`
        : undefined
    ]);
    cannotSay = uniqueRows([
      "Selles vaates ei kuvata eraomaniku nime ega isikuandmeid.",
      ...limitsFromNormalized(normalized)
    ]);

    if (!actual) {
      verdict = "unknown";
      shortAnswer = "Omandivormi kohta ei ole selles andmepakis piisavat infot.";
      explanation =
        "Katastri kontekst ei andnud valitud ala kohta kontrollitavat omandivormi.";
    } else if (claimed) {
      const matches = actual === claimed;
      verdict = matches ? "supported" : "not_supported";
      shortAnswer = matches
        ? `Jah. Andmepakis on omandivorm ${normalized.area.ownershipForm}.`
        : `Ei. Andmepakis on omandivorm ${normalized.area.ownershipForm}, mitte ${ownershipLabel(claimed)}.`;
      explanation =
        "Kontrollin ainult andmepakis olevat avalikku omandivormi, mitte omaniku nime.";
    } else {
      shortAnswer = normalized.area.ownershipForm
        ? `Andmepakis on omandivorm ${normalized.area.ownershipForm}.`
        : "Omandivormi ei leitud.";
      explanation =
        "See tuleb katastri avalikust kontekstist ja on seotud valitud geomeetriaga.";
    }
  } else if (intent.asksAreaSize) {
    evidenceIds = evidenceById(normalized, ["area-base", "cadastre-context"]);
    shortAnswer = `Valitud ala pindala on ${normalized.area.areaHa} ha.`;
    explanation = `See on ligikaudu ${areaSquareKm(normalized.area.areaHa)} km². Tegemist on valitud ETAK või katastri geomeetria pindalaga, mitte automaatselt kogu omaniku metsamaaga.`;
    canSay = uniqueRows([
      `Pindala: ${normalized.area.areaHa} ha.`,
      `Ligikaudu ${areaSquareKm(normalized.area.areaHa)} km².`,
      normalized.area.cadastralId
        ? `Katastriüksus: ${normalized.area.cadastralId}.`
        : undefined
    ]);
  } else if (intent.asksLegal) {
    verdict = "unknown";
    evidenceIds = evidenceById(normalized, [
      "protection-summary",
      "registry-active-notices",
      "forest-change-proof"
    ]);
    shortAnswer =
      "Õiguslikku lõppotsust nende andmete põhjal teha ei saa.";
    explanation =
      "Andmepakk näitab registri-, kaitse- ja allikaseisu. Lubatavuse või rikkumise otsus vajab menetluse, tingimuste ja ametliku kontrolli konteksti.";
    canSay = factsFromQuickAnswer(normalized);
    cannotSay = uniqueRows([
      "Ma ei anna juriidilist hinnangut ega ametlikku otsust.",
      "EELIS kattuvus ei ütle automaatselt, et tegevus on keelatud või lubatud.",
      "Metsateatis ei kinnita üksi, et töö on tehtud.",
      ...limitsFromNormalized(normalized)
    ]);
  } else if (intent.asksHarvest) {
    evidenceIds = evidenceById(normalized, [
      "registry-active-notices",
      "registry-archived-notices",
      "forest-change-proof"
    ]);
    canSay = uniqueRows([
      hasActiveNotices
        ? `Metsaregistris on ${registry.activeNoticesCount} aktiivset või mittearhiveeritud metsateatist.`
        : "Aktiivseid ega mittearhiveeritud metsateatisi ei leitud.",
      hasArchivedNotices
        ? `Arhiveeritud metsateatisi leiti ${registry.archivedNoticesCount}.`
        : "Arhiveeritud metsateatisi ei leitud.",
      hasChangeProof
        ? "Metsamuutuste/LiDAR tõend on selles andmepakis olemas."
        : "Metsamuutuste/LiDAR tõend on ühendamata või puudub selles prototüübis."
    ]);
    cannotSay = uniqueRows([
      !hasChangeProof
        ? "Raie toimumist ei saa kinnitada ilma tegeliku muutuse tõendita."
        : undefined,
      hasAnyNotice
        ? "Metsateatis tähendab kavandatud, menetletud või registreeritud tegevust; see ei tõenda üksi, et töö on juba tehtud."
        : "Kui metsateatist ei leitud, ei tohi väita, et raie oli selles andmepakis kavandatud.",
      ...limitsFromNormalized(normalized)
    ]);

    if (hasActiveNotices && hasChangeProof) {
      verdict = "supported";
      shortAnswer =
        "Andmepakk toetab, et siin on raie või oluline metsamuutus tõenäoline.";
      explanation =
        "Seda võib öelda ainult seetõttu, et koos on olemas Metsaregistri teatis ja metsamuutuste/LiDAR muutusetõend.";
    } else if (hasAnyNotice) {
      verdict = "partial";
      shortAnswer = intent.asksProtection && hasProtection
        ? "Väide on osaliselt toetatud: kaitsekattuvus ja metsateatis on olemas, aga toimunud raiet see ei kinnita."
        : "Metsateatis on registris olemas, aga tegelikult toimunud raiet see üksi ei kinnita.";
      explanation =
        "Metsateatis on ametlik registrifakt kavandatud või menetletud tegevuse kohta. Selles andmepakis puudub tegeliku muutuse tõend.";
    } else if (hasChangeProof) {
      verdict = "partial";
      shortAnswer =
        "Muutusetõend on olemas, aga sama andmepakk ei leidnud metsateatist.";
      explanation =
        "Ilma registrikontekstita ei nimeta Metsatark seda kindlaks raietõendiks.";
    } else {
      verdict = "not_supported";
      shortAnswer =
        "Praegune andmepakk ei toeta väidet, et siin toimus raie.";
      explanation =
        "Aktiivseid metsateatisi ei leitud ja metsamuutuste/LiDAR tõend on ühendamata või puudub. See ei tõesta, et midagi pole kunagi juhtunud; see ütleb, mida andmepakk praegu ei kinnita.";
    }
  } else if (intent.asksProtection) {
    evidenceIds = evidenceById(normalized, ["protection-summary"]);
    canSay = hasProtection
      ? normalized.protectionSummary.slice(0, 4).map((group) => {
          const overlap = group.overlapHa !== undefined
            ? `, kattuvus ligikaudu ${group.overlapHa} ha`
            : "";
          const codes = group.codes?.length ? ` (${group.codes.join(", ")})` : "";
          return `${group.label}${codes}${overlap}.`;
        })
      : ["EELIS ei tagastanud kaitse- ega piirangukattuvust."];
    cannotSay = uniqueRows([
      "Kattuvus ei ole lõplik õiguslik otsus ega ütle automaatselt, kas tegevus on lubatud.",
      ...limitsFromNormalized(normalized)
    ]);

    if (hasProtection) {
      verdict = "supported";
      shortAnswer =
        "Jah, EELIS näitab selle valitud ala puhul kaitse-, Natura-, VEP- või elupaigakattuvust.";
      explanation =
        "See on oluline kontekst, aga mitte automaatne õiguslik otsus.";
    } else {
      verdict = "not_supported";
      shortAnswer =
        "Ühendatud EELIS kihid ei näita selle ala kohta kaitsekattuvust.";
      explanation =
        "See tähendab ainult praeguse andmepaki tulemust. Mitteavalik või üldistatud info võib jääda eraldi kontrolli alla.";
    }
  } else if (intent.asksNotice) {
    evidenceIds = evidenceById(normalized, [
      "registry-active-notices",
      "registry-archived-notices"
    ]);
    canSay = uniqueRows([
      hasActiveNotices
        ? `${registry.activeNoticesCount} aktiivset või mittearhiveeritud metsateatist.`
        : "Aktiivseid ega mittearhiveeritud metsateatisi ei leitud.",
      hasArchivedNotices
        ? `${registry.archivedNoticesCount} arhiveeritud metsateatist.`
        : "Arhiveeritud metsateatisi ei leitud."
    ]);
    cannotSay = uniqueRows([
      hasAnyNotice
        ? "Teatis ei tõenda üksi, et töö on tegelikult toimunud."
        : "Teatise puudumine selles andmepakis ei tõesta, et ühtegi menetlust pole kunagi olnud.",
      ...limitsFromNormalized(normalized)
    ]);

    verdict = hasAnyNotice ? "supported" : "not_supported";
    shortAnswer = hasAnyNotice
      ? "Jah, Metsaregistri andmepakis on selle ala kohta metsateatise infot."
      : "Metsaregistri päring ei leidnud selle ala kohta metsateatist.";
    explanation = hasAnyNotice
      ? "See on registrifakt, mitte automaatne tõend tegelikult tehtud töö kohta."
      : "Seda tuleb lugeda kui praeguse ühendatud päringu tulemust, mitte lõplikku ajaloolist kinnitust.";
  } else if (intent.asksLimits) {
    verdict = "partial";
    evidenceIds = evidenceById(
      normalized,
      normalized.cannotClaim.flatMap((finding) => finding.evidenceIds)
    );
    shortAnswer =
      "Kõige olulisem piir on see, et Metsatark tõlgendab andmepakki, mitte ei tee ametlikku otsust.";
    explanation =
      "Ta saab öelda, millised ametlikud faktid on olemas ja milliseid liiga tugevaid väiteid nende põhjal teha ei tohi.";
    canSay = factsFromQuickAnswer(normalized);
    cannotSay = limitsFromNormalized(normalized);
  } else if (intent.asksAttention) {
    evidenceIds = defaultEvidenceIds(normalized);
    shortAnswer =
      "Vaata kõigepealt metsateatisi, muutusetõendi puudumist, kaitsekattuvusi ja inventuuri vanust.";
    explanation = normalized.keyFindings
      .slice(0, 5)
      .map((finding) => `${finding.title}: ${finding.summary}`)
      .join("\n");
    canSay = factsFromQuickAnswer(normalized);
    cannotSay = limitsFromNormalized(normalized);
  }

  evidenceIds = evidenceIds.length > 0 ? evidenceIds : defaultEvidenceIds(normalized);

  return {
    mode: "template",
    status: "ready",
    provider: "deterministic-normalized-evidence",
    question,
    verdict,
    verdictLabel: verdictLabels[verdict],
    confidence: normalized.dataCompleteness.score,
    shortAnswer,
    explanation,
    canSay,
    cannotSay,
    evidence: evidenceFromAnalysis(analysis),
    evidenceIds,
    mapHints: [
      "Valitud metsaala on kaardil tugevama rohelise täite ja kontuuriga.",
      hasProtection
        ? "Kaitsekattuvuse kihti saab tõendichipist esile tõsta."
        : "Kaitsekattuvust ei leitud või seda ei kasutata tõendina.",
      !hasChangeProof
        ? "Metsamuutuste/LiDAR tõend on piiranguna nähtav."
        : "Muutusetõend on tõendipakis olemas."
    ],
    followUps: [
      "Kas siin on raie kohta tõendeid?",
      "Mis andmed on puudu?",
      "Selgita seda ilma metsandusterminiteta."
    ],
    sources: analysis.sources
  };
}

function compactOverlapForAi(item: {
  id: string;
  layerName: string;
  title?: string;
  valueLabel?: string;
  dataYear?: number;
  overlapAreaHa?: number;
  properties: Record<string, unknown>;
}) {
  return {
    id: item.id,
    layerName: item.layerName,
    title: item.title,
    valueLabel: item.valueLabel,
    dataYear: item.dataYear,
    overlapAreaHa: item.overlapAreaHa,
    properties: item.properties
  };
}

function compactAnalysisForAi(analysis: AnalysisResult, question: string) {
  const normalized = analysis.normalizedEvidence;
  const sourceStatus = normalized.sourceStatus;
  const evidencePackage = analysis.evidencePackage;
  const intent = detectedIntent(question);

  return {
    selectedAreaData: normalized.area,
    answerStyle: intent.asksInterpretiveSummary
      ? {
          type: "interpretive_summary",
          priority:
            "Alusta sellest, mida tegevuse kohta saab või ei saa järeldada. Ära alusta pindala, katastri ega omandiga.",
          avoid:
            "Ära tee üldist pindala/omandi loetelu, kui see ei aita vastata, mis siin tõenäoliselt toimunud on."
        }
      : {
          type: "direct_answer",
          priority: "Vasta kasutaja täpsele küsimusele võimalikult otse.",
          avoid: "Ära lisa standardset kontrollnimekirja."
        },
    questionFocus: questionFocusForAnalysis(analysis, question),
    interpretationSignals: interpretationSignalsForAnalysis(analysis),
    interpretation: normalized.interpretation,
    queryableFacts: {
      area: normalized.area,
      counts: {
        forestRegistryStands: normalized.registrySummary.standsCount,
        activeForestNotices: normalized.registrySummary.activeNoticesCount,
        archivedForestNotices: normalized.registrySummary.archivedNoticesCount,
        eelisGroups: normalized.protectionSummary.length,
        elmeWoodRawMaterialOverlaps: normalized.ecosystemContext.woodRawMaterialCount,
        elmeCarbonStorageOverlaps: normalized.ecosystemContext.carbonStorageCount,
        elmeOtherOverlaps: normalized.ecosystemContext.otherCount,
        loadedSources: sourceStatus.filter((source) => source.status === "loaded").length,
        totalSources: sourceStatus.length
      },
      registrySummary: normalized.registrySummary,
      protectionSummary: normalized.protectionSummary,
      ecosystemContext: normalized.ecosystemContext,
      sourceStatus
    },
    normalizedEvidence: {
      quickAnswer: normalized.quickAnswer,
      keyFindings: normalized.keyFindings,
      criticalGaps: normalized.criticalGaps,
      cannotClaim: normalized.cannotClaim,
      evidenceItems: normalized.evidenceItems,
      sourceStatus: normalized.sourceStatus,
      protectionSummary: normalized.protectionSummary,
      registrySummary: normalized.registrySummary,
      ecosystemContext: normalized.ecosystemContext,
      dataCompleteness: normalized.dataCompleteness,
      interpretation: normalized.interpretation,
      timeline: normalized.timeline,
      aiContext: normalized.aiContext
    },
    sourceDetails: {
      forestRegistry: {
        notices: {
          active: evidencePackage.forestRegistry.notices.map(compactOverlapForAi),
          archived: evidencePackage.forestRegistry.archivedNotices.map(compactOverlapForAi)
        },
        stands: evidencePackage.forestRegistry.stands.map(compactOverlapForAi)
      },
      eelis: {
        protectedAreaOverlaps: evidencePackage.eelis.protectedAreaOverlaps.map(compactOverlapForAi),
        naturaOverlaps: evidencePackage.eelis.naturaOverlaps.map(compactOverlapForAi),
        restrictionOverlaps: evidencePackage.eelis.restrictionOverlaps.map(compactOverlapForAi)
      },
      elme: {
        woodRawMaterialOverlaps: evidencePackage.ecosystemBenefits.woodRawMaterialOverlaps.map(compactOverlapForAi),
        carbonStorageOverlaps: evidencePackage.ecosystemBenefits.carbonStorageOverlaps.map(compactOverlapForAi),
        otherOverlaps: evidencePackage.ecosystemBenefits.otherOverlaps.map(compactOverlapForAi)
      },
      forestChanges: {
        hasChangeEvidence: evidencePackage.forestChanges.hasChangeEvidence,
        lidarChangeOverlaps: evidencePackage.forestChanges.lidarChangeOverlaps.map(compactOverlapForAi)
      }
    }
  };
}

function compactAnswerForAi(answer: AreaQuestionAnswer) {
  return {
    question: answer.question,
    verdict: answer.verdict,
    shortAnswer: answer.shortAnswer,
    explanation: answer.explanation,
    canSay: answer.canSay,
    cannotSay: answer.cannotSay,
    evidenceIds: answer.evidenceIds
  };
}

function extractOpenAiText(payload: OpenAiResponse): string | null {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => {
      if (typeof item.text === "string") return item.text;
      if (typeof item.output_text === "string") return item.output_text;
      if (item.parsed && typeof item.parsed === "object") {
        return JSON.stringify(item.parsed);
      }
      return undefined;
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

function parseAiAnswerPayload(text: string): AiAnswerPayload | null {
  const trimmed = text.trim();
  const jsonText =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed
      : trimmed.match(/\{[\s\S]*\}/)?.[0];

  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as AiAnswerPayload;
    if (
      typeof parsed.shortAnswer === "string" ||
      typeof parsed.explanation === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function isAnswerVerdict(value: string | undefined): value is AnswerVerdict {
  return (
    value === "supported" ||
    value === "partial" ||
    value === "not_supported" ||
    value === "unknown"
  );
}

function requestedProvider(): "template" | "openai" | "ollama" {
  if (process.env.NODE_ENV === "test") {
    return "template";
  }

  const configured = process.env.AI_PROVIDER?.toLocaleLowerCase("en");
  if (configured === "template" || configured === "openai" || configured === "ollama") {
    return configured;
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.OLLAMA_BASE_URL) {
    return "ollama";
  }

  return "template";
}

const conversationalAnswerInstructions = [
  "Sa oled Metsatark, Eesti ametlike metsaandmete peale ehitatud praktiline andmeanalüütik.",
  "Vasta ainult sisendis olevate väljade selectedAreaData, queryableFacts, sourceDetails ja normalizedEvidence põhjal.",
  "Ära kasuta internetti, üldteadmisi ega oletusi. Kui vastust andmepakis pole, ütle seda.",
  "Järgi dataPackage.answerStyle juhist: see ütleb, kas vaja on otsest vastust või tõlgendavat kokkuvõtet.",
  "Ära käsitle iga kasutaja küsimust väite tõesuse kontrollina. Vasta täpselt sellele, mida küsiti.",
  "Ära alusta vaikimisi pindalast, katastrist ega omandist, kui kasutaja ei küsi neid. Kokkuvõtte või 'mis siin toimunud on' küsimuses alusta tegevuse tõenditest, muutusetõendist, teatistest, eraldiste mustrist ja andmelünkadest.",
  "Ära korda selectedAreaData põhiandmeid kokkuvõttes, kui pindala, kataster või omand ei ole kasutaja küsimusele otseselt vajalik.",
  "Sa võid teha ettevaatlikke järeldusi interpretationSignals põhjal, kasutades sõnu nagu 'paistab', 'viitab', 'võib tähendada'. Ära esita neid ametliku otsusena.",
  "Eelista normalizedEvidence.interpretation plokke, kui kasutaja küsib kokkuvõtet, prioriteete või 'mis siin toimunud on'.",
  "Ole kasulik: too välja mustreid ja seoseid, mitte ainult andmeread. Näiteks kui eraldisi on pindala kohta palju, võid öelda, et ala on registris peenelt jaotatud, kui interpretationSignals seda toetab.",
  "Kui questionFocus on olemas, on see otsene fookus ja selle shortAnswer, canSay ning evidenceIds on sinu faktialus.",
  "Kui kasutaja küsib mitu/palju/kui palju/arvu, vasta queryableFacts.counts vastava täpse arvuga.",
  "Kui kasutaja küsib ELME, looduse hüvede, puidutooraine, süsiniku või biomassiga seotud asja, kasuta ainult queryableFacts.ecosystemContext ja sourceDetails.elme; ära vasta EELIS kaitsekattuvuste arvuga.",
  "Kui kasutaja küsib kaitse/Natura/VEP/elupaiga kohta, kasuta EELIS fakte; ära vasta ELME arvuga.",
  "Kõik arvud peavad täpselt kattuma sisendis olevate arvudega. Ära ümarda ega asenda teise allika arvuga.",
  "Iga sisuline fakt peab tuginema normalizedEvidence.evidenceItems id-le ja vastuses peab olema evidenceIds massiiv.",
  "Kui evidence id puudub, ära esita väidet kindla faktina; sõnasta see piiranguna.",
  "Raie toimumist tohib pidada tõenäoliseks ainult siis, kui andmepakis on koos metsateatis ja metsamuutuste/LiDAR tõend.",
  "Metsateatis üksi tähendab kavandatud, menetletud või registreeritud tegevust, mitte tehtud raiet.",
  "EELIS kattuvus on kaitse- või keskkonnakontekst, mitte lõplik õiguslik otsus.",
  "ELME väärtused on lisakontekst, mitte majanduslik soovitus ega lubatavuse tõend.",
  "Hoia vastus lühike ja eestikeelne. Ära kõla nagu debug-paneel ega bürokraatlik kontroll-leht.",
  "Ära lisa üldist 'andmed toetavad' stiilis hinnangut vastuse teksti. Verdict on ainult sisemiseks masinloetavaks väljaks.",
  "shortAnswer peab olema üks konkreetne esimene lause, mitte pealkiri. explanation võib olla 2-5 lühikest rida, kui see aitab vastust lugeda.",
  "canSay ja cannotSay massiivid peavad sisaldama ainult kasutaja küsimuse jaoks päriselt vajalikke punkte; tühjad massiivid on lubatud ja sageli parem valik.",
  "Tagasta ainult JSON kujul: {\"verdict\":\"supported|partial|not_supported|unknown\",\"shortAnswer\":\"...\",\"explanation\":\"...\",\"canSay\":[\"...\"],\"cannotSay\":[\"...\"],\"missingInfo\":[\"...\"],\"evidenceIds\":[\"...\"],\"followUps\":[\"...\"],\"mapHints\":[\"...\"]}."
].join(" ");

const aiAnswerJsonFormat = {
  type: "json_schema",
  name: "metsatark_area_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: {
        type: "string",
        enum: ["supported", "partial", "not_supported", "unknown"]
      },
      shortAnswer: { type: "string" },
      explanation: { type: "string" },
      canSay: {
        type: "array",
        items: { type: "string" }
      },
      cannotSay: {
        type: "array",
        items: { type: "string" }
      },
      missingInfo: {
        type: "array",
        items: { type: "string" }
      },
      evidenceIds: {
        type: "array",
        items: { type: "string" }
      },
      followUps: {
        type: "array",
        items: { type: "string" }
      },
      mapHints: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: [
      "verdict",
      "shortAnswer",
      "explanation",
      "canSay",
      "cannotSay",
      "missingInfo",
      "evidenceIds",
      "followUps",
      "mapHints"
    ]
  }
};

async function openAiAnswer(
  input: AreaQuestionInput,
  fallback: AreaQuestionAnswer
): Promise<AreaQuestionAnswer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const model = process.env.OPENAI_MODEL ?? defaultOpenAiModel;
  const focus = questionFocusForAnalysis(input.analysis, input.question);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: conversationalAnswerInstructions,
      input: JSON.stringify({
        question: input.question,
        recentConversation: (input.history ?? []).slice(-6),
        dataPackage: compactAnalysisForAi(input.analysis, input.question),
        fallback: compactAnswerForAi(fallback)
      }),
      text: {
        format: aiAnswerJsonFormat
      },
      temperature: 0.25,
      max_output_tokens: 1200
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI answer failed with ${response.status}`);
  }

  const text = extractOpenAiText((await response.json()) as OpenAiResponse);
  const parsed = text ? parseAiAnswerPayload(text) : null;
  if (!parsed) {
    throw new Error("OpenAI answer response was not valid JSON.");
  }

  const verdict = isAnswerVerdict(parsed.verdict)
    ? parsed.verdict
    : fallback.verdict;
  const evidenceIds = evidenceById(
    input.analysis.normalizedEvidence,
    cleanStringArray(parsed.evidenceIds, 10)
  );
  const canSay = cleanStringArray(parsed.canSay, 6);
  const cannotSay = cleanStringArray(parsed.cannotSay, 6);
  const missingInfo = cleanStringArray(parsed.missingInfo, 4);
  const followUps = cleanStringArray(parsed.followUps, 4);
  const mapHints = cleanStringArray(parsed.mapHints, 4);

  const answer: AreaQuestionAnswer = {
    ...fallback,
    mode: "openai",
    status: "generated",
    provider: "openai-responses",
    model,
    verdict,
    verdictLabel: verdictLabels[verdict],
    shortAnswer: parsed.shortAnswer?.trim() || fallback.shortAnswer,
    explanation: parsed.explanation?.trim() || fallback.explanation,
    canSay: canSay.length > 0 ? canSay : fallback.canSay,
    cannotSay:
      cannotSay.length > 0 || missingInfo.length > 0
        ? uniqueRows([...cannotSay, ...missingInfo])
        : fallback.cannotSay,
    evidence: evidenceFromAnalysis(input.analysis),
    evidenceIds: evidenceIds.length > 0 ? evidenceIds : fallback.evidenceIds,
    followUps: followUps.length > 0 ? followUps : fallback.followUps,
    mapHints: mapHints.length > 0 ? mapHints : fallback.mapHints,
    sources: input.analysis.sources
  };

  if (focus) {
    const requiredEvidence = new Set(focus.evidenceIds);
    const hasFocusEvidence = answer.evidenceIds.some((id) => requiredEvidence.has(id));
    if (!hasFocusEvidence || !exactNumberMentioned(answer, focus)) {
      return fallback;
    }
  }

  return answer;
}

export async function generateAreaQuestionAnswer(
  input: AreaQuestionInput
): Promise<AreaQuestionAnswer> {
  const fallback = answerForIntent(input);
  const provider = requestedProvider();

  if (provider === "template" || provider === "ollama") {
    return provider === "ollama"
      ? {
          ...fallback,
          mode: "ollama",
          status: "fallback",
          provider: "deterministic-normalized-evidence",
          note:
            "Ollama vestlusmudelit ei kasutata selles prototüübis faktide laiendamiseks; vastus on koostatud normaliseeritud andmepaki põhjal."
        }
      : fallback;
  }

  try {
    return await openAiAnswer(input, fallback);
  } catch {
    return {
      ...fallback,
      status: "fallback"
    };
  }
}
