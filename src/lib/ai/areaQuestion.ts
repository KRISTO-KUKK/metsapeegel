import type {
  AnalysisResult,
  AreaAnswerEvidence,
  AreaQueryFilterId,
  AreaMapAction,
  AreaQuestionAnswer,
  AnswerVerdict,
  EvidenceTone,
  NormalizedEvidenceItem,
  NormalizedSelectedAreaEvidence
} from "@/lib/types/forestry";
import {
  areaQueryFilters,
  getAreaQueryFilter
} from "@/lib/data/sourceRegistry";
import {
  forestLawSources,
  forestLawTopicsForQuestion
} from "@/lib/ai/forestLaw";
import {
  dominantSpeciesAreaShares,
  dominantSpeciesStockShares,
  nationalForestInsights,
  nationalForestStatSources,
  nationalMetrics,
  ownershipShares
} from "@/lib/data/nationalForestStats";

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
  mapAction?: Partial<AreaMapAction> | null;
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

type ConceptGlossaryItem = {
  id: string;
  terms: string[];
  shortDefinition: string;
  whyItMatters: string;
  selectedAreaBoundary: string;
};

const conceptGlossary: ConceptGlossaryItem[] = [
  {
    id: "cadastre",
    terms: ["kataster", "katastriüksus", "katastritunnus", "kinnistu"],
    shortDefinition:
      "Kataster on maaüksuste register: seal on maatüki piir, tunnus, aadress, sihtotstarve ja avalik omandivormi info.",
    whyItMatters:
      "Metsatark kasutab katastrit selleks, et siduda klikitud metsaala Metsaregistri päringutega ja näidata omandivormi ilma omaniku isikuandmeid avamata.",
    selectedAreaBoundary:
      "Katastriüksus ei tähenda automaatselt, et kogu maaüksus on mets või et kogu mets kuulub samasse metsamajanduslikku üksusesse."
  },
  {
    id: "etak",
    terms: ["etak", "etak metsaala", "topograafiline metsaala"],
    shortDefinition:
      "ETAK on Eesti topograafiline andmekogu. ETAK metsaala on kaardil olev metsaobjekt ehk valitav geomeetria.",
    whyItMatters:
      "See annab Metsatargale ruumilise ankru: mille kohta päringud ja kattuvused arvutatakse.",
    selectedAreaBoundary:
      "ETAK kirjeldab kaardiobjekti, mitte kogu raiete, kaitse ega inventuuri seisu."
  },
  {
    id: "forest_notice",
    terms: ["metsateatis", "teatis", "raieteatis"],
    shortDefinition:
      "Metsateatis on ametlik registrifakt kavandatud, menetletud või registreeritud metsatöö kohta.",
    whyItMatters:
      "See on oluline tegevuse signaal, eriti kui küsitakse raie või kahjustuse kohta.",
    selectedAreaBoundary:
      "Metsateatis üksi ei tõenda, et töö tegelikult toimus; selleks on vaja muutusetõendit, näiteks kaugseire või LiDAR kihti."
  },
  {
    id: "forest_stand",
    terms: ["eraldis", "eraldised", "metsaregistri eraldis"],
    shortDefinition:
      "Eraldis on Metsaregistris kirjeldatud metsaosa, millele antakse inventuuriandmed nagu puuliik, arenguklass ja inventuuriaasta.",
    whyItMatters:
      "Eraldiste arv ja vanus aitavad aru saada, kui detailne või ajakohane registrikirjeldus on.",
    selectedAreaBoundary:
      "Eraldiste arv ei tõenda raiet ega metsa head või halba seisundit; see on registri jaotuse info."
  },
  {
    id: "stand_age",
    terms: [
      "puistu vanus",
      "puude vanus",
      "keskmine vanus",
      "raievanus",
      "raieküps"
    ],
    shortDefinition:
      "Puistu keskmine vanus on Metsaregistri takseerandmetes kirjeldatud metsa vanus; raievanus on reeglipõhine võrdluspunkt, mis sõltub puuliigist, boniteedist ja puistu koosseisust.",
    whyItMatters:
      "Vanuse võrdlus aitab aru saada, kas lageraie või turberaie vanusepoolne eeldus võib olla täidetud.",
    selectedAreaBoundary:
      "Raievanus üksi ei ole raieluba: kaitsekord, metsateatis, raieliik ja muud metsa majandamise nõuded tuleb ikkagi kontrollida."
  },
  {
    id: "eelis",
    terms: ["eelis", "kaitsekattuvus", "natura", "vep", "vääriselupaik", "elupaigatüüp"],
    shortDefinition:
      "EELIS koondab looduskaitse ja keskkonnapiirangutega seotud ruumiandmeid, näiteks kaitsealad, Natura alad, VEP-id ja elupaigad.",
    whyItMatters:
      "Kui valitud metsaala kattub EELIS infoga, peab tõlgendus olema ettevaatlikum ja kontekst peab olema nähtav.",
    selectedAreaBoundary:
      "Kattuvus ei ole automaatselt lõplik õiguslik otsus, kas konkreetne tegevus on lubatud või keelatud."
  },
  {
    id: "elme",
    terms: ["elme", "looduse hüved", "puidutooraine", "süsinik", "ökosüsteem"],
    shortDefinition:
      "ELME kihid annavad looduse hüvede taustainfot, näiteks puidutooraine ja süsiniku hinnanguid.",
    whyItMatters:
      "Need aitavad näha majanduslikku ja ökosüsteemset konteksti, mida lihtne registrivaade ei näita.",
    selectedAreaBoundary:
      "ELME ei ole raietõend, õiguslik otsus ega soovitus raiuda või raiumata jätta."
  },
  {
    id: "lidar_change",
    terms: ["lidar", "kaugseire", "metsamuutus", "muutusetõend", "muutuse tõend"],
    shortDefinition:
      "Muutusetõend tähendab eraldi ruumiandmestikku, mis viitab tegelikule muutusele maastikul, näiteks kõrguse või taimkatte muutusele.",
    whyItMatters:
      "Raie tegeliku toimumise järeldus vajab just seda tüüpi tõendit koos registrikontekstiga.",
    selectedAreaBoundary:
      "Kui muutusetõend pole ühendatud, peab AI ütlema, et toimunud raiet ei saa kinnitada."
  }
];

function normalizeQuestion(question: string) {
  return question.trim().toLocaleLowerCase("et");
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function asksConceptualQuestion(question: string) {
  const normalized = normalizeQuestion(question);
  return includesAny(normalized, [
    "mis on",
    "mis asi",
    "mida tähendab",
    "mida tahendab",
    "selgita mõistet",
    "selgita moistet",
    "defineeri",
    "üldse",
    "uldse",
    "kuidas aru saada"
  ]);
}

function conceptForQuestion(question: string) {
  const normalized = normalizeQuestion(question);
  return conceptGlossary.find((concept) =>
    concept.terms.some((term) => normalized.includes(term))
  );
}

function roundPositiveNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value * 100) / 100;
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
    asksHarvestOccurrence: includesAny(normalized, [
      "raie toimus",
      "toimus raie",
      "kas raiuti",
      "raiuti",
      "raiutud",
      "maha võetud",
      "maha voetud",
      "tehti raiet",
      "raie kohta tõendeid",
      "raie kohta toendeid",
      "raietõend",
      "raietoend"
    ]),
    asksHarvestPossibility: includesAny(normalized, [
      "raie oleks mõeldav",
      "raie oleks moeldav",
      "raie on mõeldav",
      "raie on moeldav",
      "raiet võiks",
      "raiet voiks",
      "raiet saaks",
      "vanus lubaks",
      "vanuse järgi",
      "vanuse jargi",
      "raievanus",
      "raieküps",
      "raiekups"
    ]),
    asksLegal: includesAny(normalized, [
      "seadus",
      "seaduslik",
      "ebaseadus",
      "rikkumine",
      "lubatud",
      "keelatud",
      "õiguspärane",
      "tohib",
      "ei tohi",
      "õigus",
      "oigus",
      "nõusolek",
      "nousolek"
    ]),
    asksProtectionImpact: includesAny(normalized, [
      "kuidas kaitse",
      "kuidas need kaitse",
      "kuidas piirang",
      "mõjutab",
      "mojutab",
      "hõlmab",
      "hõlmavad",
      "kattub",
      "kattuvad",
      "omanikuna",
      "mida tohib",
      "mida ei tohi",
      "sihtkaitse",
      "piiranguvöönd",
      "kaitse-eeskiri"
    ]),
    asksCompensation: includesAny(normalized, [
      "hüvitis",
      "huvitis",
      "kompensatsioon",
      "toetus",
      "saamata jäänud tulu",
      "saamata jaanud tulu",
      "maamaks",
      "saab selle eest",
      "riigile müük",
      "riigile myyk"
    ]),
    asksTreeAge: includesAny(normalized, [
      "puude vanus",
      "puistu vanus",
      "keskmine vanus",
      "raievanus",
      "raieküps",
      "raiekups",
      "kui vana",
      "vanus lubab",
      "vanuse põhjal",
      "vanuse pohjal"
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

function mapActionForQuestion(question: string): AreaMapAction | undefined {
  const normalized = normalizeQuestion(question);
  const asksForMapSet = includesAny(normalized, [
    "näita",
    "naita",
    "millised alad",
    "otsi alasid",
    "highlight",
    "märgi",
    "margi",
    "kaardil"
  ]);

  if (!asksForMapSet) {
    return undefined;
  }

  const asksNoProtection =
    includesAny(normalized, ["ei ole", "pole", "ilma", "puudub"]) &&
    includesAny(normalized, ["kaitse", "natura", "vep", "piirang"]);

  if (asksNoProtection) {
    return {
      type: "highlight_area_query",
      filterId: "no_protection_overlap",
      label: "Alad ilma kaitsekattuvuseta",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates ETAK metsaalad, millele ühendatud avalikud EELIS kihid ei tagasta kaitse-, Natura-, piirangu-, VEP- ega elupaigakattuvust."
    };
  }

  const inventoryYear =
    normalized.match(/(?:inventuur|inventuuri|inventeeritud)[^\d]*(20\d{2}|19\d{2})/)?.[1] ??
    normalized.match(/(20\d{2}|19\d{2})[^\n.]{0,40}(?:inventuur|inventuuri|inventeeritud)/)?.[1];

  if (inventoryYear) {
    const year = Number(inventoryYear);
    return {
      type: "highlight_area_query",
      filterId: "inventory_year",
      label: `${year}. aasta inventuuriga alad`,
      year,
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille seotud Metsaregistri eraldistel on see inventuuriaasta."
    };
  }

  return undefined;
}

function mapActionForQuestionV2(question: string): AreaMapAction | undefined {
  const normalized = normalizeQuestion(question);
  const asksForMapSet = includesAny(normalized, [
    "näita",
    "naita",
    "leia",
    "filtreeri",
    "millised alad",
    "mis alad",
    "otsi alasid",
    "highlight",
    "märgi",
    "margi",
    "kaardil",
    "kus on",
    "kus pole",
    "suuremad",
    "väiksemad",
    "vaiksemad",
    "vähemalt",
    "vahemalt"
  ]);

  if (!asksForMapSet) {
    return undefined;
  }

  const missingTerms = ["ei ole", "pole", "ilma", "puudub"];
  const asksMissing = includesAny(normalized, missingTerms);

  if (
    asksMissing &&
    includesAny(normalized, ["kaitse", "natura", "vep", "piirang"])
  ) {
    return {
      type: "highlight_area_query",
      filterId: "no_protection_overlap",
      label: "Alad ilma kaitsekattuvuseta",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates ETAK metsaalad, millele ühendatud avalikud EELIS kihid ei tagasta kaitsekattuvust."
    };
  }

  if (
    includesAny(normalized, ["kaitse", "natura", "vep", "piirang"]) &&
    !asksMissing
  ) {
    return {
      type: "highlight_area_query",
      filterId: "protection_overlap",
      label: "Kaitsekattuvusega alad",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates ETAK metsaalad, millele ühendatud avalikud EELIS kihid tagastavad kaitsekattuvuse."
    };
  }

  const inventoryBeforeYear =
    normalized.match(/(?:inventuur|inventuuri|inventeeritud|andmed)[^\d]*(?:enne|vanem kui|vanemad kui)[^\d]*(20\d{2}|19\d{2})/)?.[1] ??
    normalized.match(/(?:enne|vanem kui|vanemad kui)[^\d]*(20\d{2}|19\d{2})[^\n.]{0,50}(?:inventuur|inventuuri|inventeeritud|andmed)/)?.[1];

  if (inventoryBeforeYear) {
    const beforeYear = Number(inventoryBeforeYear);
    return {
      type: "highlight_area_query",
      filterId: "inventory_before_year",
      label: `Inventuur enne ${beforeYear}`,
      beforeYear,
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille Metsaregistri eraldiste inventuuriaasta on enne küsitud aastat."
    };
  }

  const inventoryYear =
    normalized.match(/(?:inventuur|inventuuri|inventeeritud)[^\d]*(20\d{2}|19\d{2})/)?.[1] ??
    normalized.match(/(20\d{2}|19\d{2})[^\n.]{0,40}(?:inventuur|inventuuri|inventeeritud)/)?.[1];

  if (inventoryYear) {
    const year = Number(inventoryYear);
    return {
      type: "highlight_area_query",
      filterId: "inventory_year",
      label: `${year}. aasta inventuuriga alad`,
      year,
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille seotud Metsaregistri eraldistel on see inventuuriaasta."
    };
  }

  if (includesAny(normalized, ["riigiomand", "riigimaa", "riigi omand"])) {
    return {
      type: "highlight_area_query",
      filterId: "ownership_form",
      label: "Riigiomandis alad",
      ownershipForm: "Riigiomand",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille katastri avalik omandivorm on Riigiomand."
    };
  }

  if (includesAny(normalized, ["eraomand", "eramaa", "era omand"])) {
    return {
      type: "highlight_area_query",
      filterId: "ownership_form",
      label: "Eraomandis alad",
      ownershipForm: "Eraomand",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille katastri avalik omandivorm on Eraomand."
    };
  }

  if (asksMissing && includesAny(normalized, ["teatis", "metsateatis"])) {
    return {
      type: "highlight_area_query",
      filterId: "no_forest_notice",
      label: "Metsateatiseta alad",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille kohta Metsaregistri avalik päring ei tagasta metsateatist."
    };
  }

  if (includesAny(normalized, ["teatis", "metsateatis"])) {
    return {
      type: "highlight_area_query",
      filterId: "has_forest_notice",
      label: "Metsateatisega alad",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille kohta Metsaregistri avalik päring tagastab metsateatise."
    };
  }

  if (includesAny(normalized, ["puidutooraine", "puidu", "puit"])) {
    return {
      type: "highlight_area_query",
      filterId: "has_wood_raw_material",
      label: "Puidutooraine ELME kattuvusega alad",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, millele ELME puidutooraine kiht tagastab kattuvuse."
    };
  }

  if (includesAny(normalized, ["süsinik", "susinik", "carbon"])) {
    return {
      type: "highlight_area_query",
      filterId: "has_carbon_storage",
      label: "Süsiniku ELME kattuvusega alad",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, millele ELME süsinikuvaru kiht tagastab kattuvuse."
    };
  }

  if (
    includesAny(normalized, ["eraldis", "metsaregister"]) &&
    asksMissing
  ) {
    return {
      type: "highlight_area_query",
      filterId: "no_registry_stands",
      label: "Metsaregistri eraldisteta alad",
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille seotud katastri kohta Metsaregister ei tagasta eraldisi."
    };
  }

  const areaNumber =
    normalized.match(/(?:üle|ule|suurem kui|vähemalt|vahemalt)[^\d]*(\d+(?:[,.]\d+)?)\s*(?:ha|hektar)/)?.[1] ??
    normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:ha|hektar)[^\n.]{0,40}(?:üle|ule|suurem|vähemalt|vahemalt)/)?.[1];
  if (areaNumber) {
    const minAreaHa = roundPositiveNumber(Number(areaNumber.replace(",", ".")));
    if (minAreaHa) {
      return {
        type: "highlight_area_query",
        filterId: "area_larger_than",
        label: `Vähemalt ${minAreaHa} ha metsaalad`,
        minAreaHa,
        scope: "current_map_view",
        explanation:
          "Filtreerin praeguses kaardivaates ETAK metsaalad, mille pindala on vähemalt küsitud hektarite arv."
      };
    }
  }

  const maxAreaNumber =
    normalized.match(/(?:alla|väiksem kui|vaiksem kui|kuni)[^\d]*(\d+(?:[,.]\d+)?)\s*(?:ha|hektar)/)?.[1] ??
    normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:ha|hektar)[^\n.]{0,40}(?:alla|väiksem|vaiksem|kuni)/)?.[1];
  if (maxAreaNumber) {
    const maxAreaHa = roundPositiveNumber(Number(maxAreaNumber.replace(",", ".")));
    if (maxAreaHa) {
      return {
        type: "highlight_area_query",
        filterId: "area_smaller_than",
        label: `Kuni ${maxAreaHa} ha metsaalad`,
        maxAreaHa,
        scope: "current_map_view",
        explanation:
          "Filtreerin praeguses kaardivaates ETAK metsaalad, mille pindala on kuni küsitud hektarite arv."
      };
    }
  }

  const minStands =
    normalized.match(/(?:vähemalt|vahemalt|üle|ule|rohkem kui)[^\d]*(\d+)[^\n.]{0,35}(?:eraldis|eraldist)/)?.[1] ??
    normalized.match(/(?:eraldis|eraldist)[^\n.]{0,35}(?:vähemalt|vahemalt|üle|ule|rohkem kui)[^\d]*(\d+)/)?.[1];
  if (minStands) {
    const minStandsValue = Math.max(1, Math.round(Number(minStands)));
    return {
      type: "highlight_area_query",
      filterId: "many_registry_stands",
      label: `Vähemalt ${minStandsValue} eraldisega alad`,
      minStands: minStandsValue,
      scope: "current_map_view",
      explanation:
        "Filtreerin praeguses kaardivaates metsaalad, mille seotud Metsaregistri eraldiste arv on vähemalt küsitud arv."
    };
  }

  return undefined;
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
    standAge: {
      summary:
        registry.standAgeSummary ??
        "Puistu keskmist vanust ega raievanuse võrdlust andmepakis ei ole.",
      standAgeMin: registry.standAgeMin,
      standAgeMax: registry.standAgeMax,
      averageHarvestAgeMin: registry.averageHarvestAgeMin,
      averageHarvestAgeMax: registry.averageHarvestAgeMax,
      standsWithAgeCount: registry.standsWithAgeCount ?? 0,
      standsWithHarvestAgeCount: registry.standsWithHarvestAgeCount ?? 0,
      standsAtOrAboveAverageHarvestAge:
        registry.standsAtOrAboveAverageHarvestAge ?? 0,
      interpretation:
        (registry.standsWithAgeCount ?? 0) === 0
          ? "Metsaregistri eraldistes ei ole selles andmepakis puistu vanust, seega raievanuse kohta ei saa ala järeldust teha."
          : (registry.standsWithHarvestAgeCount ?? 0) === 0
            ? "Puistu vanus on osaliselt olemas, aga keskmist raievanust ei ole võrdluseks piisavalt."
            : `${registry.standsAtOrAboveAverageHarvestAge ?? 0}/${registry.standsWithHarvestAgeCount ?? 0} vanuseandmetega eraldist on keskmise vanuse poolest keskmise raievanuseni jõudnud või üle selle; see ei ole üksi raieluba.`
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

function legalKnowledgeForAnalysis(analysis: AnalysisResult, question: string) {
  const normalized = analysis.normalizedEvidence;
  const registry = normalized.registrySummary;
  const topics = forestLawTopicsForQuestion(question);
  const ownership = ownershipCategory(normalized.area.ownershipForm);
  const relevantSourceIds = new Set(topics.flatMap((topic) => topic.sourceIds));

  return {
    checkedAt: "2026-05-30",
    useRules: [
      "Kasuta seda plokki ainult Eesti metsa- ja looduskaitse reeglite yldiseks selgitamiseks.",
      "Valitud ala faktid peavad ikka tulema selectedAreaData, queryableFacts, sourceDetails ja normalizedEvidence plokkidest.",
      "Ara anna ametlikku luba, keeldu, rikkumise otsust ega toetuse garantiid.",
      "Kui kasutaja küsib kaitsekattuvuse mõju kohta, vasta demo-kõlblikult: alusta praktilisest mõjust omanikule, nimeta andmepakis nähtavad kattuvused, seleta LKS § 30/§ 31 loogika ning lõpeta puuduva kontrolliga. Metsaseadus § 41 lisa ainult siis, kui küsimus puudutab raiet, metsateatist või tegevuse lubatavust.",
      "Ära kirjuta, et Metsaseaduse § 41 ise annab või nõuab kaitseala valitseja nõusolekut. Õige sõnastus: § 41 on metsateatise ja Keskkonnaameti raievastavuse kontrolli raam; kaitstaval alal võib lisaks vaja olla valitseja nõusolekut või kaitse-eeskirja eraldi tingimuse kontrolli."
    ],
    areaLegalSignals: {
      ownershipForm: normalized.area.ownershipForm,
      ownershipCategory: ownership,
      hasPrivateOwnership: ownership === "private",
      hasProtectionOverlap: normalized.protectionSummary.length > 0,
      protectionGroups: normalized.protectionSummary,
      hasForestNotices:
        registry.activeNoticesCount + registry.archivedNoticesCount > 0,
      hasChangeEvidence: harvestHasChangeProof(analysis),
      forestRegistry: {
        standsCount: registry.standsCount,
        dominantSpecies: registry.dominantSpecies,
        developmentClasses: registry.developmentClasses,
        inventoryYears: registry.inventoryYears,
        inventorySummary: registry.inventorySummary,
        standAgeSummary: registry.standAgeSummary,
        standAgeMin: registry.standAgeMin,
        standAgeMax: registry.standAgeMax,
        averageHarvestAgeMin: registry.averageHarvestAgeMin,
        averageHarvestAgeMax: registry.averageHarvestAgeMax,
        standsWithAgeCount: registry.standsWithAgeCount ?? 0,
        standsWithHarvestAgeCount: registry.standsWithHarvestAgeCount ?? 0,
        standsAtOrAboveAverageHarvestAge:
          registry.standsAtOrAboveAverageHarvestAge ?? 0
      },
      missingForLegalDecision: uniqueRows([
        normalized.protectionSummary.length > 0
          ? "Täpne kaitsevöönd ja konkreetne kaitse-eeskiri ei pruugi olla andmepakis otsustusena olemas."
          : undefined,
        "Ametlik menetlusotsus või Keskkonnaameti nõusolek ei ole andmepakis.",
        !harvestHasChangeProof(analysis)
          ? "Metsamuutuste/LiDAR tõend on ühendamata, seega tegelikku raiet ei saa kinnitada."
          : undefined,
        (registry.standsWithAgeCount ?? 0) === 0
          ? "Puistu keskmise vanuse andmeid ei leitud."
          : undefined
      ])
    },
    topics,
    sources: forestLawSources.filter((source) => relevantSourceIds.has(source.id))
  };
}

function nationalForestContextForAi() {
  return {
    role:
      "Üleriigiline taust valitud ala tõlgendamiseks; see ei ole sama asi kui valitud metsaala tõend.",
    keyMetrics: nationalMetrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: metric.value,
      detail: metric.detail
    })),
    ownershipShares,
    dominantSpeciesAreaShares,
    dominantSpeciesStockShares,
    interpretationHints: nationalForestInsights,
    sources: nationalForestStatSources.map((source) => ({
      id: source.id,
      label: source.label,
      url: source.url,
      note: source.note
    }))
  };
}

function summarizeProtectionGroups(normalized: NormalizedSelectedAreaEvidence) {
  if (normalized.protectionSummary.length === 0) {
    return "EELIS kaitse-, Natura-, VEP- või elupaigakattuvust ei näita.";
  }

  return normalized.protectionSummary
    .slice(0, 4)
    .map((group) => {
      const overlap =
        group.overlapHa !== undefined ? `, kattuvus ligikaudu ${group.overlapHa} ha` : "";
      const codes = group.codes?.length ? ` (${group.codes.join(", ")})` : "";
      return `${group.label}${codes}${overlap}`;
    })
    .join("; ");
}

function protectionPracticalMeanings(
  normalized: NormalizedSelectedAreaEvidence
) {
  const groups = normalized.protectionSummary;
  if (groups.length === 0) {
    return [
      "Ühendatud EELIS kihid ei näita kaitse-, Natura-, VEP- ega elupaigakattuvust."
    ];
  }

  const types = new Set(groups.map((group) => group.type));
  const knownOverlapHa = sumKnownOverlapHa(groups);

  return uniqueRows([
    knownOverlapHa !== undefined
      ? `EELIS kattuvuste teadaolev koondpind on umbes ${knownOverlapHa} ha; see näitab, et kaitsekontekst puudutab päriselt valitud geomeetriat, mitte ainult kauget naaberalat.`
      : "EELIS kattuvus on olemas, kuid kõikide kihtide pindala ei ole usaldusväärselt koondatav.",
    types.has("protected_area")
      ? "Kaitseala kattuvus tähendab, et enne raiet või muud tegevust peab selgeks tegema konkreetse vööndi ja kaitse-eeskirja."
      : undefined,
    types.has("natura")
      ? "Natura kattuvus tähendab, et oluline küsimus on mõju kaitse-eesmärgile ja elupaiga/liigi seisundile; see ei ole automaatne raiekeeld, aga tõstab kontrollivajadust."
      : undefined,
    types.has("vep")
      ? "VEP ehk vääriselupaik on tugev looduskaitseline signaal vana või väärtusliku metsaosa kohta; majandamisotsus vajab eraldi piirangu ja kokkuleppe kontrolli."
      : undefined,
    types.has("habitat")
      ? "Elupaigatüübi kattuvus tähendab, et raie, kuivendus või väljavedu võib mõjutada kaitstavat kooslust; seda peab tõlgendama kaitse-eesmärgi kaudu."
      : undefined,
    types.has("restriction")
      ? "Piiranguinfo tähendab, et tavapärasele metsateatise kontrollile võib lisanduda tegevuse, aja, raieviisi või väljaveo tingimus."
      : undefined
  ]);
}

function protectionImpactAnswer(input: AreaQuestionInput): AreaQuestionAnswer {
  const { analysis, question } = input;
  const normalized = analysis.normalizedEvidence;
  const intent = detectedIntent(question);
  const hasProtection = normalized.protectionSummary.length > 0;
  const privateOwner = ownershipCategory(normalized.area.ownershipForm) === "private";
  const shouldExplainHarvestProcedure =
    intent.asksHarvest ||
    intent.asksHarvestOccurrence ||
    intent.asksHarvestPossibility ||
    intent.asksLegal;
  const evidenceIds = evidenceById(normalized, [
    "protection-summary",
    privateOwner ? "cadastre-context" : undefined,
    shouldExplainHarvestProcedure ? "registry-active-notices" : undefined
  ].filter((id): id is string => Boolean(id)));

  const compensationLine = privateOwner
    ? "Kui piirang puudutab eraomandit, võib järgmiseks kontrollida, kas konkreetne vöönd või VEP annab aluse hüvitisele, toetusele või maamaksusoodustusele; seda see andmepakk automaatselt ei otsusta."
    : undefined;
  const practicalMeanings = protectionPracticalMeanings(normalized);

  return {
    mode: "template",
    status: "ready",
    provider: "deterministic-forest-law",
    question,
    verdict: hasProtection ? "partial" : "unknown",
    verdictLabel: verdictLabels[hasProtection ? "partial" : "unknown"],
    confidence: normalized.dataCompleteness.score,
    shortAnswer: hasProtection
      ? "See tähendab praktiliselt: ära loe seda ala tavaliseks piiranguta tulundusmetsaks, vaid kontrolli enne tegevust vööndit, kaitse-eeskirja ja Keskkonnaameti nõusoleku vajadust."
      : "Praegune andmepakk kaitsekattuvust ei näita, seega ei saa selle ala kohta kaitseala mõju väita.",
    explanation: [
      hasProtection
        ? `Sinu alaga kattub andmepakis: ${summarizeProtectionGroups(normalized)}.`
        : "Ühendatud EELIS kihid ei tagastanud kaitse-, Natura-, VEP- ega elupaigakattuvust.",
      hasProtection
        ? "Õigusraam: Looduskaitseseaduse § 30 puhul on sihtkaitsevööndis majandustegevus ja loodusvarade kasutamine üldjuhul keelatud; § 31 puhul on piiranguvööndis majandustegevus lubatud kitsendustega ja täpsed tingimused tulevad kaitse-eeskirjast."
        : "Kui kaitseinfo on mitteavalik või eraldi menetluses, seda see prototüüp ei pruugi näha.",
      hasProtection && shouldExplainHarvestProcedure
        ? "Metsaseaduse § 41 lisab raie puhul eraldi kontrolli: metsateatis on kavandatud tegevuse kontroll, mitte tõend, et tegevus on juba toimunud või automaatselt lubatud igas kaitsevööndis."
        : undefined,
      ...practicalMeanings.slice(0, 4),
      compensationLine,
      hasProtection
        ? "Järgmine praktiline samm on vaadata täpset vööndit ja kaitse-eeskirja, mitte teha otsust ainult kattuvuse nime järgi."
        : undefined
    ]
      .filter(Boolean)
      .join("\n"),
    canSay: uniqueRows([
      hasProtection
        ? "Kaitsekattuvus on praktiline riskisignaal: enne metsamajanduslikku või muud looduskeskkonda mõjutavat tegevust tuleb kontrollida täpset vööndit ja kaitse-eeskirja."
        : "Andmepakis ei ole avalikku kaitsekattuvust.",
      normalized.area.ownershipForm
        ? `Katastri avalik omandivorm: ${normalized.area.ownershipForm}.`
        : undefined
    ]),
    cannotSay: uniqueRows([
      shouldExplainHarvestProcedure
        ? "Metsatark ei saa ainult EELIS kattuvuse põhjal öelda, et konkreetne raie on lubatud või keelatud."
        : "Metsatark ei saa ainult EELIS kattuvuse põhjal öelda, et konkreetne tegevus on lubatud või keelatud.",
      "Metsatark ei tea selles prototüübis alati täpset vööndit, kaitse-eeskirja erisust ega Keskkonnaameti menetlusotsust.",
      "Hüvitise või maamaksusoodustuse õigus vajab toetuskõlbliku ala ja taotlustingimuste kontrolli."
    ]),
    evidence: evidenceFromAnalysis(analysis),
    evidenceIds,
    mapHints: [],
    followUps: [
      "Milline info on õigusliku otsuse jaoks puudu?",
      "Kas puude vanus lubaks siin raiet?",
      "Kas selle ala eest võiks hüvitist küsida?"
    ],
    sources: analysis.sources
  };
}

function treeAgeAnswer(input: AreaQuestionInput): AreaQuestionAnswer {
  const { analysis, question } = input;
  const normalized = analysis.normalizedEvidence;
  const registry = normalized.registrySummary;
  const hasAge = (registry.standsWithAgeCount ?? 0) > 0;
  const hasHarvestAge = (registry.standsWithHarvestAgeCount ?? 0) > 0;
  const hasProtection = normalized.protectionSummary.length > 0;
  const evidenceIds = evidenceById(normalized, [
    "registry-stands",
    hasProtection ? "protection-summary" : undefined
  ].filter((id): id is string => Boolean(id)));

  const ageComparison =
    hasHarvestAge && (registry.standsWithHarvestAgeCount ?? 0) > 0
      ? `${registry.standsAtOrAboveAverageHarvestAge ?? 0}/${registry.standsWithHarvestAgeCount ?? 0} vanuseandmetega eraldist on keskmise vanuse poolest keskmise raievanuseni jõudnud või üle selle`
      : undefined;

  const ageSignal =
    ageComparison && (registry.standsAtOrAboveAverageHarvestAge ?? 0) > 0
      ? `Vanuse poolelt on raie mõeldav vähemalt osal eraldistest: ${ageComparison}.`
      : hasAge
        ? "Puistu vanuse kohta on andmeid, aga need ei näita selget vanusepoolset raiemõeldavust."
        : "Selles andmepakis ei ole puistu keskmise vanuse andmeid, seega ei saa vanuse põhjal raievõimalust hinnata.";

  return {
    mode: "template",
    status: "ready",
    provider: "deterministic-forest-law",
    question,
    verdict: hasAge ? "partial" : "unknown",
    verdictLabel: verdictLabels[hasAge ? "partial" : "unknown"],
    confidence: normalized.dataCompleteness.score,
    shortAnswer: ageSignal,
    explanation: [
      hasAge
        ? registry.standAgeSummary
        : "Metsaregistri eraldised ei andnud puistu keskmise vanuse välja.",
      !hasHarvestAge
        ? "Raievanuse võrdlus vajab puistu keskmist vanust ja keskmist raievanust; inventuuriaasta ei ole puude vanus."
        : undefined,
      "Üldreegel: lageraie ja turberaie vanusepoolne sobivus sõltub puistu koosseisuga kaalutud keskmisest vanusest ning raievanusest; sanitaarraie võib olla võimalik ka eri vanuses puistus, aga ainult sanitaarraie tingimustel.",
      hasProtection
        ? "Selle ala kaitsekattuvus võib tavalisest raievanuse loogikast rangem olla, seega tuleb kontrollida kaitsevööndit ja kaitse-eeskirja."
        : undefined
    ]
      .filter(Boolean)
      .join("\n"),
    canSay: uniqueRows([
      registry.dominantSpecies.length > 0
        ? `Peamised puuliigid andmetes: ${registry.dominantSpecies.join(", ")}.`
        : undefined,
      registry.developmentClasses.length > 0
        ? `Arenguklassid andmetes: ${registry.developmentClasses.join(", ")}.`
        : undefined,
      hasAge ? registry.standAgeSummary : undefined
    ]),
    cannotSay: uniqueRows([
      "Inventuuriaasta ei ole puude vanus.",
      "Vanuse võrdlus ei ole raieluba ega õiguslik lõppotsus.",
      "Raie mõeldavus vajab lisaks raieliiki, kaitsekorda ja ametliku menetluse kontrolli."
    ]),
    evidence: evidenceFromAnalysis(analysis),
    evidenceIds,
    mapHints: [],
    followUps: [
      "Kas kaitsekattuvus muudab seda järeldust?",
      "Kas siin on metsateatis olemas?",
      "Selgita raievanust lihtsamalt."
    ],
    sources: analysis.sources
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

function conceptualAnswer(
  input: AreaQuestionInput,
  concept: ConceptGlossaryItem
): AreaQuestionAnswer {
  const { analysis, question } = input;
  const normalized = analysis.normalizedEvidence;

  return {
    mode: "template",
    status: "ready",
    provider: "deterministic-concept-glossary",
    question,
    verdict: "supported",
    verdictLabel: verdictLabels.supported,
    confidence: normalized.dataCompleteness.score,
    shortAnswer: concept.shortDefinition,
    explanation: `${concept.whyItMatters}\n${concept.selectedAreaBoundary}`,
    canSay: [],
    cannotSay: [],
    evidence: evidenceFromAnalysis(analysis),
    evidenceIds: [],
    mapHints: [],
    followUps: [
      "Kuidas see valitud ala puhul välja paistab?",
      "Millised andmed selle mõistega seotud on?",
      "Mis piirangud selle allikal on?"
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
    const hasWoodValueRange =
      ecosystem.woodEurPerHaMin !== undefined &&
      ecosystem.woodEurPerHaMax !== undefined;

    return {
      kind: "wood_raw_material",
      title: "ELME puidutooraine",
      shortAnswer:
        ecosystem.woodRawMaterialCount > 0
          ? `See tähendab, et ELME puidutooraine kiht lõikub valitud alaga ${ecosystem.woodRawMaterialCount} kirjes; see on ressursi- ja väärtustaust, mitte raietõend.`
          : "ELME puidutooraine kattuvusi selles andmepakis ei leitud.",
      explanation:
        ecosystem.woodRawMaterialCount > 0
          ? [
              "Praktiliselt aitab see aru saada, kas valitud metsaalal on ELME mudeli järgi puidutooraine ressursi-, potentsiaali- või väärtuse taustainfot.",
              `${ecosystem.woodRawMaterialCount} ei tähenda ${ecosystem.woodRawMaterialCount} raiet, ${ecosystem.woodRawMaterialCount} omanikku ega ${ecosystem.woodRawMaterialCount} metsaeraldist; see on ruumiliste ELME hinnangukirjete arv, mis alaga kattuvad.`,
              hasWoodValueRange
                ? `Andmepakis olevate kirjete väärtusvahemik on ${ecosystem.woodEurPerHaMin}-${ecosystem.woodEurPerHaMax} eurot/ha, mida tuleb lugeda taustahinnanguna.`
                : "Selles vastuses ei arvutata majanduslikku otsust ega lõplikku puidu väärtust."
            ].join("\n")
          : "ELME puidutooraine kattuvusi selles andmepakis ei leitud.",
      canSay: uniqueRows([
        ecosystem.woodRawMaterialCount > 0
          ? `ELME puidutooraine kattuvusi on ${ecosystem.woodRawMaterialCount}.`
          : "ELME puidutooraine kattuvust ei leitud.",
        ecosystem.woodRawMaterialCount > 0
          ? "Kattuvuste olemasolu annab kasutajale lisakonteksti metsa ressursi ja ökosüsteemse väärtuse kohta."
          : undefined,
        `Süsiniku kattuvusi: ${ecosystem.carbonStorageCount}.`,
        `Muid ELME kattuvusi: ${ecosystem.otherCount}.`,
        hasWoodValueRange
          ? `Puidutooraine hinnangu vahemik: ${ecosystem.woodEurPerHaMin}-${ecosystem.woodEurPerHaMax} eurot/ha.`
          : undefined,
        ecosystem.woodTotalEur !== undefined
          ? `Leitud puidutooraine hinnangute summa: ${ecosystem.woodTotalEur} eurot.`
          : undefined
      ]),
      cannotSay: [
        "See ei ütle, et ala tuleks raiuda või raiumata jätta.",
        "See ei tõenda, et raie on toimunud või lubatud.",
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
  const mapAction = mapActionForQuestionV2(question) ?? mapActionForQuestion(question);
  const concept =
    asksConceptualQuestion(question) &&
    !focus &&
    !intent.asksTreeAge &&
    !intent.asksProtectionImpact &&
    !intent.asksCompensation &&
    !intent.asksHarvestPossibility
      ? conceptForQuestion(question)
      : null;

  let verdict: AnswerVerdict = "supported";
  let shortAnswer =
    normalized.keyFindings[0]?.summary ??
    "Saan vastata ainult valitud ala andmepaki põhjal.";
  let explanation = normalized.quickAnswer.join(" ");
  let canSay = factsFromQuickAnswer(normalized);
  let cannotSay = limitsFromNormalized(normalized);
  let evidenceIds = defaultEvidenceIds(normalized);

  if (concept && !mapAction) {
    return conceptualAnswer(input, concept);
  } else if (mapAction) {
    verdict = "partial";
    shortAnswer = `Saan selle kaardil esile tõsta praeguse vaate ulatuses: ${mapAction.label}.`;
    explanation = [
      mapAction.explanation,
      "See ei ole veel üle-Eestiline eelindeks; backend kontrollib nähtavaid ETAK metsaalasid ja kasutab ainult ühendatud ametlikke allikaid."
    ].join("\n");
    canSay = [
      "Tulemused jäävad kaardile alles, et saaksid järjest esile tõstetud alasid klõpsida.",
      "Kui liigutad kaarti või suumid teise piirkonda, käivita sama küsimus uuesti selle vaate kohta."
    ];
    cannotSay = [
      "Ma ei väida, et need on kõik Eesti alad, mis tingimusele vastavad.",
      "Kaitsekattuvuse puudumine tähendab ainult, et ühendatud avalikud EELIS kihid ei tagastanud kattuvust.",
      "Inventuuriaasta filter sõltub sellest, kas ala õnnestub siduda katastri ja Metsaregistri eraldistega."
    ];
    evidenceIds = evidenceById(
      normalized,
      mapAction.filterId === "inventory_year" ||
        mapAction.filterId === "inventory_before_year" ||
        mapAction.filterId === "many_registry_stands"
        ? ["registry-stands"]
        : mapAction.filterId === "ownership_form"
          ? ["cadastre-context", "area-base"]
          : mapAction.filterId === "has_wood_raw_material" ||
              mapAction.filterId === "has_carbon_storage"
            ? ["elme-context"]
            : mapAction.filterId === "area_larger_than" ||
                mapAction.filterId === "area_smaller_than"
              ? ["area-base"]
              : ["protection-summary"]
    );
  } else if (focus) {
    verdict = "supported";
    shortAnswer = focus.shortAnswer;
    explanation = focus.explanation;
    canSay = focus.canSay;
    cannotSay = uniqueRows([...focus.cannotSay, ...limitsFromNormalized(normalized)]).slice(0, 6);
    evidenceIds = evidenceById(normalized, focus.evidenceIds);
  } else if (intent.asksInterpretiveSummary) {
    return interpretiveSummaryAnswer(input);
  } else if (intent.asksTreeAge) {
    return treeAgeAnswer(input);
  } else if (intent.asksHarvestPossibility && !intent.asksHarvestOccurrence) {
    return treeAgeAnswer(input);
  } else if (intent.asksProtectionImpact || intent.asksCompensation) {
    return protectionImpactAnswer(input);
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
    const legalTopics = forestLawTopicsForQuestion(question);
    const topicTitles = legalTopics.map((topic) => topic.title).slice(0, 3);
    verdict = "unknown";
    evidenceIds = evidenceById(normalized, [
      "protection-summary",
      "registry-active-notices",
      "registry-stands",
      "forest-change-proof"
    ]);
    shortAnswer =
      "Saan anda praktilise õigusliku riskiselgituse, aga mitte ametlikku luba, keeldu ega rikkumise otsust.";
    explanation = [
      hasProtection
        ? `Andmepakis on kaitsekontekst: ${summarizeProtectionGroups(normalized)}.`
        : "Andmepakk ei näita avalikku kaitsekattuvust.",
      hasAnyNotice
        ? `Metsaregistris on ${registry.activeNoticesCount} aktiivset ja ${registry.archivedNoticesCount} arhiveeritud metsateatist.`
        : "Metsateatist ei leitud.",
      registry.standAgeSummary
        ? `Puistu vanuse kontekst: ${registry.standAgeSummary}`
        : undefined,
      topicTitles.length > 0
        ? `Asjakohane üldraam: ${topicTitles.join("; ")}.`
        : "Asjakohane üldraam: metsaseadus, metsa majandamise eeskiri ja vajadusel looduskaitseseadus."
    ]
      .filter(Boolean)
      .join("\n");
    canSay = uniqueRows([
      ...factsFromQuickAnswer(normalized),
      hasProtection
        ? "Kaitseala või EELIS kattuvuse korral tuleb kontrollida konkreetset vööndit ja kaitse-eeskirja."
        : undefined,
      registry.standAgeSummary
        ? "Vanuseandmeid saab kasutada ainult ühe sisendsignaalina, mitte loana."
        : undefined
    ]);
    cannotSay = uniqueRows([
      "Metsatark ei anna juriidilist hinnangut, lõpphinnangut ega ametlikku otsust.",
      "EELIS kattuvus ei ütle automaatselt, et tegevus on keelatud või lubatud.",
      "Metsateatis ei kinnita üksi, et töö on tehtud või et kõik muud tingimused on täidetud.",
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
    mapAction,
    mapHints: [
      mapAction
        ? `Käivitan kaardifiltri: ${mapAction.label}.`
        : undefined,
      "Valitud metsaala on kaardil tugevama rohelise täite ja kontuuriga.",
      hasProtection
        ? "Kaitsekattuvuse kihti saab tõendichipist esile tõsta."
        : "Kaitsekattuvust ei leitud või seda ei kasutata tõendina.",
      !hasChangeProof
        ? "Metsamuutuste/LiDAR tõend on piiranguna nähtav."
        : "Muutusetõend on tõendipakis olemas."
    ].filter((hint): hint is string => Boolean(hint)),
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
    conceptGlossary,
    legalKnowledge: legalKnowledgeForAnalysis(analysis, question),
    nationalForestContext: nationalForestContextForAi(),
    availableMapTools: areaQueryFilters.map((filter) => ({
      id: filter.id,
      label: filter.label,
      description: filter.description,
      parameters: filter.parameters,
      requiredDatasets: filter.requiredDatasets,
      caveat: filter.caveat
    })),
    deterministicMapAction: mapActionForQuestionV2(question) ?? mapActionForQuestion(question) ?? null,
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

function isKnownFilterId(value: unknown): value is AreaQueryFilterId {
  return (
    typeof value === "string" &&
    Boolean(getAreaQueryFilter(value as AreaQueryFilterId))
  );
}

function cleanMapAction(
  value: Partial<AreaMapAction> | null | undefined,
  fallback?: AreaMapAction
): AreaMapAction | undefined {
  const candidate = value ?? fallback;
  if (!candidate || candidate.type !== "highlight_area_query") {
    return fallback;
  }

  const filterId = candidate.filterId;
  if (!isKnownFilterId(filterId)) {
    return fallback;
  }

  const filter = getAreaQueryFilter(filterId);
  if (!filter) {
    return fallback;
  }

  const action: AreaMapAction = {
    type: "highlight_area_query",
    filterId,
    label:
      typeof candidate.label === "string" && candidate.label.trim()
        ? candidate.label.trim().slice(0, 90)
        : filter.label,
    scope: "current_map_view",
    explanation:
      typeof candidate.explanation === "string" && candidate.explanation.trim()
        ? candidate.explanation.trim().slice(0, 350)
        : filter.description
  };

  const year = roundPositiveNumber(
    typeof candidate.year === "number" ? candidate.year : undefined
  );
  const beforeYear = roundPositiveNumber(
    typeof candidate.beforeYear === "number" ? candidate.beforeYear : undefined
  );
  const minAreaHa = roundPositiveNumber(
    typeof candidate.minAreaHa === "number" ? candidate.minAreaHa : undefined
  );
  const maxAreaHa = roundPositiveNumber(
    typeof candidate.maxAreaHa === "number" ? candidate.maxAreaHa : undefined
  );
  const minStands =
    typeof candidate.minStands === "number" && Number.isFinite(candidate.minStands)
      ? Math.max(1, Math.round(candidate.minStands))
      : undefined;

  if (year) action.year = Math.round(year);
  if (beforeYear) action.beforeYear = Math.round(beforeYear);
  if (minAreaHa) action.minAreaHa = minAreaHa;
  if (maxAreaHa) action.maxAreaHa = maxAreaHa;
  if (minStands) action.minStands = minStands;

  if (
    typeof candidate.ownershipForm === "string" &&
    candidate.ownershipForm.trim().length > 0
  ) {
    action.ownershipForm = candidate.ownershipForm.trim().slice(0, 80);
  }

  if (action.filterId === "inventory_year" && !action.year) return fallback;
  if (action.filterId === "inventory_before_year" && !action.beforeYear) {
    return fallback;
  }
  if (action.filterId === "ownership_form" && !action.ownershipForm) {
    return fallback;
  }
  if (action.filterId === "area_larger_than" && !action.minAreaHa) {
    return fallback;
  }
  if (action.filterId === "area_smaller_than" && !action.maxAreaHa) {
    return fallback;
  }
  if (action.filterId === "many_registry_stands" && !action.minStands) {
    return fallback;
  }

  return action;
}

function requiredEvidenceIdsForQuestion(
  analysis: AnalysisResult,
  question: string
) {
  const intent = detectedIntent(question);
  const ids: string[] = [];

  if (
    intent.asksProtection ||
    intent.asksProtectionImpact ||
    intent.asksCompensation ||
    intent.asksLegal
  ) {
    ids.push("protection-summary");
  }

  if (intent.asksTreeAge || intent.asksHarvestPossibility) {
    ids.push("registry-stands");
  }

  if (
    intent.asksHarvestOccurrence ||
    intent.asksNotice ||
    (intent.asksLegal && !intent.asksHarvestPossibility)
  ) {
    ids.push(
      "registry-active-notices",
      "registry-archived-notices",
      "forest-change-proof"
    );
  }

  if (intent.asksEcosystem) {
    ids.push("elme-context");
  }

  return evidenceById(analysis.normalizedEvidence, ids);
}

const conversationalAnswerInstructions = [
  "Sa oled Metsatark, Eesti ametlike metsaandmete peale ehitatud praktiline andmeanalüütik.",
  "Valitud ala puudutavad faktid peavad tulema ainult sisendis olevatest väljadest selectedAreaData, queryableFacts, sourceDetails ja normalizedEvidence.",
  "Ära kasuta internetti ega jooksvaid välisandmeid.",
  "Kui kasutaja küsib Eesti metsaõiguse, kaitseala mõju, hüvitise, raieõiguse või puude vanuse/raievanuse kohta, kasuta ainult dataPackage.legalKnowledge plokki üldise õigusraamistiku selgitamiseks.",
  "Õigusvastustes erista alati kolm asja: mida valitud ala andmepakk näitab, milline on üldine Eesti reegli loogika legalKnowledge ploki põhjal, ja mida ei saa selle prototüübi põhjal otsustada.",
  "Ära anna ametlikku õigusnõu, luba, keeldu, rikkumise otsust ega toetuse garantiid. Sõnasta praktilise riskiselgitusena.",
  "Kui küsitakse 'kuidas kaitsealad mind mõjutavad' või 'mida tähendab, et kaitsealad hõlmavad minu metsa', alusta praktilisest mõjust: see ei ole tavaline piiranguta tulundusmets; tuleb kontrollida vööndit, kaitse-eeskirja ja vajadusel kaitseala valitseja või Keskkonnaameti tingimusi. Ära alusta pindalast, eraldiste arvust, metsateatistest ega kattuvuste arvust.",
  "Kaitsekattuvuse vastuses nimeta Looduskaitseseaduse § 30 sihtkaitsevööndi üldloogika ja § 31 piiranguvööndi üldloogika, kui küsimus puudutab kaitse mõju. Metsaseaduse § 41 metsateatise kontrolli loogikat maini ainult siis, kui kasutaja küsib raiet, metsateatist, lubatavust, keeldu või konkreetset tegevust. Kui täpset vööndit ei ole andmepakis, ütle seda selgelt.",
  "Kui kaitse küsimus ei küsi raiet, ära lisa aktiivsete metsateatiste arvu, eraldiste arvu ega metsamuutuste/LiDAR piirangut. Need on olulised ainult raie, tegevuse tõendi või metsaregistri struktuuri küsimustes.",
  "Kaitseküsimuses ära ütle 'raiekeeld' kindlas kõneviisis ainult EELIS kattuvuse põhjal. Õige sõnastus on näiteks 'võimalik range piirang, kui see osa jääb sihtkaitsevööndisse' või 'piiranguvööndis võib olla raieviisi/aja/langu tingimus'.",
  "Ära ütle, et Metsaseaduse § 41 ise nõuab Keskkonnaameti nõusolekut. Õige on: § 41 kohaselt esitatakse kavandatava raie kohta metsateatis ja Keskkonnaamet kontrollib vastavust; kaitstaval alal võib eraldi nõusoleku või tingimuse vajadus tulla kaitse-eeskirjast või looduskaitseseaduse loogikast.",
  "Kui küsitakse hüvitist, ütle, et see ei ole automaatne: vaja on eraomandit, toetuskõlblikku ala, õiget vööndit ja taotluse tingimusi. Ära arvuta summat, kui toetuskõlbliku ala andmeid ei ole.",
  "Kui küsitakse puude vanust, raievanust või seda, kas raie oleks vanuse poolest mõeldav, ära aja inventuuriaastat puude vanusega segi. Kasuta dataPackage.queryableFacts.registrySummary.standAgeSummary ning dataPackage.sourceDetails.forestRegistry.stands averageAge/averageHarvestAge välju, kui need on olemas.",
  "Kui keskmine vanus on raievanusega võrdne või suurem, tohib öelda ainult, et vanusepoolne signaal võib olla olemas; ära ütle, et raie on lubatud ilma kaitsekorra, metsateatise ja menetluseta.",
  "Kui küsimus on raie mõeldavuse või vanusepoolse võimalikkuse kohta, ära vasta tegeliku raie toimumise kontrolliga ning ära too LiDAR/muutusetõendit sisse, kui kasutaja ei küsi, kas raie toimus.",
  "Kui kasutaja küsib suurt pilti, võrdlust või 'mida see tähendab', võid kasutada dataPackage.nationalForestContext plokki taustaks. Ütle selgelt, et see on Eesti üldstatistika, mitte valitud ala tõend.",
  "Ole rohkem analüütik kui väljavõtte generaator: seo omavahel eraldiste arv, pindala, puuliigid, vanus, teatised, kaitsekattuvus, muutusetõend ja Eesti üldtaust. Tee ettevaatlik järeldus, kui andmed seda lubavad.",
  "Kui muster on nõrk, sõnasta see nõrgalt: 'viitab', 'paistab', 'praktiliselt tähendab', 'järgmine kontroll oleks'. Kui muster on tugev, ütle lühidalt, miks ta tugev on.",
  "Ära lisa vastusesse automaatselt kõiki piiranguid. Too ainult need piirid, mis muudavad konkreetse vastuse tähendust.",
  "Kui kasutaja küsib üldist metsanduse, andmeallika või kaarditermini tähendust, võid anda lihtsa üldise selgituse oma mudeliteadmiste põhjal. Erista see selgelt valitud ala kohta tõendatud faktidest.",
  "Kui kasutaja küsib valitud ala kohta ja vastust andmepakis pole, ütle seda otse.",
  "Kui kasutaja küsib mõiste tähendust, kasuta esmalt dataPackage.conceptGlossary sõnastikku ja lisa valitud ala fakte ainult siis, kui neid küsitakse.",
  "Kui kasutaja palub kaardil alasid leida, valida, näidata, filtreerida või esile tõsta, vali sobiv tööriist dataPackage.availableMapTools nimekirjast ning tagasta mapAction. Kui sobivat tööriista ei ole, ütle seda ausalt.",
  "Kaarditööriist töötab praeguse kaardivaate ulatuses. Ära luba üle-Eestilist täielikkust, kui tööriista scope seda ei anna.",
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
  "Kui kasutaja küsib, mida puidutooraine kattuvuste arv tähendab, ära piirdu arvu kordamisega. Selgita: kattuvus on ELME ruumilise hinnangukihi kirje valitud alal; see aitab mõista ressursi- ja väärtustausta; see ei ole raie, omanik, eraldis, luba ega soovitus.",
  "ELME vastustes ütle kasutaja jaoks praktiline tähendus enne metoodikapiirangut: milleks infot saab kasutada, mida see ei otsusta ja milline järgmine kontroll oleks mõistlik.",
  "Kui kasutaja küsib kaitse/Natura/VEP/elupaiga kohta, kasuta EELIS fakte; ära vasta ELME arvuga.",
  "Kõik arvud peavad täpselt kattuma sisendis olevate arvudega. Ära ümarda ega asenda teise allika arvuga.",
  "Iga valitud ala kohta käiv sisuline fakt peab tuginema normalizedEvidence.evidenceItems id-le ja vastuses peab olema evidenceIds massiiv.",
  "Üldise mõisteselgituse puhul võib evidenceIds olla tühi, aga ära väida siis midagi konkreetse valitud ala kohta.",
  "Kui valitud ala fakti evidence id puudub, ära esita väidet kindla faktina; sõnasta see piiranguna.",
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
      mapAction: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: ["highlight_area_query"]
              },
              filterId: {
                type: "string",
                enum: areaQueryFilters.map((filter) => filter.id)
              },
              label: { type: "string" },
              scope: {
                type: "string",
                enum: ["current_map_view"]
              },
              explanation: { type: "string" },
              year: { type: ["number", "null"] },
              beforeYear: { type: ["number", "null"] },
              ownershipForm: { type: ["string", "null"] },
              minAreaHa: { type: ["number", "null"] },
              maxAreaHa: { type: ["number", "null"] },
              minStands: { type: ["number", "null"] }
            },
            required: [
              "type",
              "filterId",
              "label",
              "scope",
              "explanation",
              "year",
              "beforeYear",
              "ownershipForm",
              "minAreaHa",
              "maxAreaHa",
              "minStands"
            ]
          },
          { type: "null" }
        ]
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
      "mapAction",
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
  const parsedEvidenceIds = evidenceById(
    input.analysis.normalizedEvidence,
    cleanStringArray(parsed.evidenceIds, 10)
  );
  const evidenceIds = uniqueRows([
    ...requiredEvidenceIdsForQuestion(input.analysis, input.question),
    ...parsedEvidenceIds
  ]);
  const canSay = cleanStringArray(parsed.canSay, 6);
  const cannotSay = cleanStringArray(parsed.cannotSay, 6);
  const missingInfo = cleanStringArray(parsed.missingInfo, 4);
  const followUps = cleanStringArray(parsed.followUps, 4);
  const mapHints = cleanStringArray(parsed.mapHints, 4);
  const allowNoEvidence = asksConceptualQuestion(input.question) && !focus;
  const mapAction = cleanMapAction(parsed.mapAction, fallback.mapAction);

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
    evidenceIds:
      evidenceIds.length > 0
        ? evidenceIds
        : allowNoEvidence
          ? []
          : fallback.evidenceIds,
    mapAction,
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

  const intent = detectedIntent(input.question);
  if (intent.asksTreeAge) {
    const registry = input.analysis.normalizedEvidence.registrySummary;
    const hasAge = (registry.standsWithAgeCount ?? 0) > 0;
    const text = `${answer.shortAnswer}\n${answer.explanation}\n${answer.canSay.join("\n")}\n${answer.cannotSay.join("\n")}`.toLocaleLowerCase("et");
    const mentionsAgeRange =
      registry.standAgeMin === undefined ||
      text.includes(String(registry.standAgeMin));
    const mentionsHarvestAge =
      registry.averageHarvestAgeMin === undefined ||
      text.includes(String(registry.averageHarvestAgeMin));
    const falselyMissingAge =
      hasAge &&
      (text.includes("ei ole puistu keskmise vanuse") ||
        text.includes("ei sisalda puistu keskmist vanust") ||
        text.includes("keskmise vanuse andmeid ei ole"));
    const driftsToOccurrenceProof =
      !intent.asksHarvestOccurrence &&
      (text.includes("toimumist ei saa kinnitada") ||
        text.includes("tegelikku raiet") ||
        text.includes("lidar") ||
        text.includes("muutusetõend"));

    if (
      falselyMissingAge ||
      !mentionsAgeRange ||
      !mentionsHarvestAge ||
      driftsToOccurrenceProof
    ) {
      return fallback;
    }
  }

  if (
    intent.asksProtectionImpact &&
    !intent.asksHarvest &&
    !intent.asksHarvestOccurrence &&
    !intent.asksHarvestPossibility &&
    !intent.asksNotice &&
    !intent.asksLegal
  ) {
    const text = `${answer.shortAnswer}\n${answer.explanation}\n${answer.canSay.join("\n")}\n${answer.cannotSay.join("\n")}`.toLocaleLowerCase("et");
    const driftsToHarvestAudit =
      text.includes("metsateatis") ||
      text.includes("eraldist") ||
      text.includes("lidar") ||
      text.includes("muutusetõend") ||
      text.includes("raie toimum");

    if (driftsToHarvestAudit) {
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
