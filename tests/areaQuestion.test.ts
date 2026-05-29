import { describe, expect, it } from "vitest";
import { generateAreaQuestionAnswer } from "@/lib/ai/areaQuestion";
import type {
  AnalysisResult,
  ForestAreaEvidencePackage,
  NormalizedSelectedAreaEvidence
} from "@/lib/types/forestry";

const geometry = {
  type: "Polygon" as const,
  coordinates: [
    [
      [24.88, 58.89],
      [24.89, 58.89],
      [24.89, 58.9],
      [24.88, 58.9],
      [24.88, 58.89]
    ]
  ]
};

function analysisWith({
  notices = 0,
  stands = 0,
  changes = 0,
  protectedAreas = 0,
  woodRawMaterial = 0,
  carbonStorage = 0,
  otherEcosystem = 0,
  ownershipForm = "Eraomand",
  areaHa = 1
}: {
  notices?: number;
  stands?: number;
  changes?: number;
  protectedAreas?: number;
  woodRawMaterial?: number;
  carbonStorage?: number;
  otherEcosystem?: number;
  ownershipForm?: string;
  areaHa?: number;
} = {}): AnalysisResult {
  const evidencePackage: ForestAreaEvidencePackage = {
    selectedArea: {
      selectionType: "etak_forest",
      geometryId: "123",
      geometrySource: "ETAK WFS test fixture",
      areaHa,
      cadastralIds: ["29202:005:0601"]
    },
    etak: {
      forestObjectId: "123",
      objectType: "Mets",
      areaHa,
      sourceStatus: "loaded"
    },
    cadastre: {
      cadastralIds: ["29202:005:0601"],
      ownershipForm,
      parcels: [
        {
          id: "cadastre-parcel",
          sourceId: "maaamet-cadastre",
          label: "Katastriüksus",
          value: "29202:005:0601",
          confidence: "high"
        }
      ],
      sourceStatus: "loaded"
    },
    forestRegistry: {
      stands: Array.from({ length: stands }, (_, index) => ({
        id: `stand-${index}`,
        sourceId: "metsaregister",
        layerName: "Metsaregistri eraldised",
        properties: {
          id: `stand-${index}`,
          inventoryYear: 2015,
          mainSpecies: index % 2 === 0 ? "mänd" : "kask"
        }
      })),
      notices: Array.from({ length: notices }, (_, index) => ({
        id: `notice-${index}`,
        sourceId: "metsaregister",
        layerName: "Metsateatised",
        properties: { id: `notice-${index}` }
      })),
      archivedNotices: [],
      forestProtectionExpertises: [],
      regenerationExpertises: [],
      sourceStatus: notices > 0 || stands > 0 ? "loaded" : "missing"
    },
    eelis: {
      protectedAreaOverlaps: Array.from(
        { length: protectedAreas },
        (_, index) => ({
          id: `protected-${index}`,
          sourceId: "eelis",
          layerName: "EELIS kaitse- ja piirangukattuvus",
          properties: { id: `protected-${index}` }
        })
      ),
      naturaOverlaps: [],
      restrictionOverlaps: [],
      sourceStatus: protectedAreas > 0 ? "loaded" : "missing"
    },
    forestChanges: {
      lidarChangeOverlaps: Array.from({ length: changes }, (_, index) => ({
        id: `change-${index}`,
        sourceId: "forest-changes",
        layerName: "Metsamuutused / kaugseire",
        properties: { id: `change-${index}` }
      })),
      hasChangeEvidence: changes > 0,
      sourceStatus: changes > 0 ? "loaded" : "not_connected"
    },
    ecosystemBenefits: {
      woodRawMaterialOverlaps: Array.from(
        { length: woodRawMaterial },
        (_, index) => ({
          id: `wood-${index}`,
          sourceId: "elme",
          layerName: "ELME puidutooraine",
          category: "wood_raw_material" as const,
          title: "Puidutooraine",
          valueLabel: `${100 + index} eurot/ha`,
          properties: {
            id: `wood-${index}`,
            keskm_sum_5a: 100 + index,
            keskm_abs_hind_5a: 1000 + index
          }
        })
      ),
      carbonStorageOverlaps: Array.from(
        { length: carbonStorage },
        (_, index) => ({
          id: `carbon-${index}`,
          sourceId: "elme",
          layerName: "ELME süsinik",
          category: "carbon_storage" as const,
          title: "Süsinik",
          valueLabel: `${10 + index} t C/ha`,
          properties: {
            id: `carbon-${index}`,
            puit_c_tha: 10 + index
          }
        })
      ),
      otherOverlaps: Array.from({ length: otherEcosystem }, (_, index) => ({
        id: `ecosystem-${index}`,
        sourceId: "elme",
        layerName: "ELME muu",
        category: "wood_context" as const,
        title: "Muu looduse hüve",
        properties: { id: `ecosystem-${index}` }
      })),
      sourceStatus:
        woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
          ? "loaded"
          : "missing"
    },
    mapContext: {
      countyBoundarySourceStatus: "loaded",
      basemapSourceStatus: "loaded"
    },
    priorityBlocks: [
      {
        id: "base-info",
        title: "Põhiinfo",
        subtitle: "Test",
        tone: "base",
        rank: 1,
        items: [`ETAK metsaala 123, pindala ${areaHa} ha.`],
        sourceIds: ["maaamet-etak-forest"]
      },
      {
        id: "needs-attention",
        title: "Tähelepanu vajab",
        subtitle: "Test",
        tone: "attention",
        rank: 2,
        items: [
          notices > 0
            ? `Metsaregistris on ${notices} metsateatist.`
            : "Metsateatist ei leitud.",
          protectedAreas > 0
            ? `EELIS näitab ${protectedAreas} kaitsekattuvust.`
            : "Kaitsekattuvust ei leitud."
        ],
        sourceIds: ["metsaregister", "eelis"]
      }
    ],
    prioritizedInsights: [
      {
        id: "selected-area-anchor",
        priority: "critical",
        title: "Valitud ala alusfakt",
        summary: `ETAK metsaala 123, pindala ${areaHa} ha.`,
        sourceIds: ["maaamet-etak-forest"],
        visibleByDefault: true,
        reason: "Test fixture"
      }
    ],
    dataCatalog: [
      {
        id: "maaamet-etak-forest",
        name: "ETAK metsaala",
        provider: "Maa- ja Ruumiamet",
        scope: "selected_area",
        priority: "critical",
        status: "loaded",
        description: "Test",
        aiUse: "Test",
        userVisibility: "always"
      },
      {
        id: "forest-changes",
        name: "Metsamuutuste / LiDAR muutusetõend",
        provider: "Maa- ja Ruumiamet",
        scope: "selected_area",
        priority: "critical",
        status: changes > 0 ? "loaded" : "not_connected",
        description: "Test",
        aiUse: "Test",
        userVisibility: "always"
      }
    ],
    derivedFindings: [],
    missingEvidence: [],
    sources: [
      {
        id: "maaamet-etak-forest",
        name: "ETAK metsaala",
        provider: "Maa- ja Ruumiamet",
        status: "loaded"
      },
      {
        id: "maaamet-cadastre",
        name: "Katastriüksuse kontekst",
        provider: "Maa- ja Ruumiamet",
        status: "loaded"
      },
      {
        id: "metsaregister",
        name: "Metsaregister",
        provider: "Kliimaministeerium / Metsaregister",
        status: notices > 0 || stands > 0 ? "loaded" : "missing"
      },
      {
        id: "eelis",
        name: "EELIS kaitse- ja piiranguandmed",
        provider: "Keskkonnaagentuur / Keskkonnaportaal",
        status: protectedAreas > 0 ? "loaded" : "missing"
      },
      {
        id: "forest-changes",
        name: "Metsamuutuste / LiDAR muutusetõend",
        provider: "Maa- ja Ruumiamet",
        status: changes > 0 ? "loaded" : "not_connected"
      }
    ]
  };
  const normalizedEvidence: NormalizedSelectedAreaEvidence = {
    area: {
      title: "Test forest",
      subtitle: `${areaHa} ha · ${ownershipForm.toLocaleLowerCase("et")} · katastriüksus 29202:005:0601`,
      areaHa,
      cadastralId: "29202:005:0601",
      ownershipForm,
      etakId: 123,
      type: "forest"
    },
    quickAnswer: [
      `Ala on ETAK-i järgi metsaala, pindala ${areaHa} ha.`,
      `Metsaregistris on ${notices} metsateatist.`,
      protectedAreas > 0
        ? "EELIS näitab kaitsekattuvust."
        : "EELIS kaitsekattuvust ei näidanud.",
      "Metsamuutuste/LiDAR tõend on ühendamata; süsteem ei tohi väita, et raie toimus."
    ],
    keyFindings: [
      {
        id: "finding-notices",
        title: "Metsateatised",
        summary:
          notices > 0
            ? `Metsaregistris on ${notices} metsateatist.`
            : "Aktiivseid metsateatisi ei leitud.",
        tone: notices > 0 ? "attention" : "positive",
        evidenceIds: ["registry-active-notices"]
      },
      {
        id: "finding-protection",
        title: "Kaitsekontekst",
        summary:
          protectedAreas > 0
            ? `EELIS näitab ${protectedAreas} kaitsekattuvust.`
            : "EELIS kaitsekattuvust ei näidanud.",
        tone: protectedAreas > 0 ? "attention" : "neutral",
        evidenceIds: ["protection-summary"]
      },
      {
        id: "finding-ecosystem-context",
        title: "Looduse hüved",
        summary:
          woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
            ? `ELME: ${woodRawMaterial} puidutooraine, ${carbonStorage} süsiniku ja ${otherEcosystem} muud kattuvust.`
            : "ELME looduse hüvede kattuvust ei leitud.",
        tone: "neutral",
        evidenceIds: ["elme-context"]
      }
    ],
    criticalGaps: [
      {
        id: "gap-change-proof",
        title: "Raie toimumise tõend",
        summary: "Metsamuutuste/LiDAR muutusetõend on ühendamata.",
        tone: "limit",
        evidenceIds: ["forest-change-proof"]
      }
    ],
    cannotClaim: [
      {
        id: "claim-harvest",
        title: "Raie toimumist ei saa kinnitada",
        summary: "Metsateatis ei tõenda üksi tehtud raiet.",
        tone: "limit",
        evidenceIds: ["forest-change-proof", "registry-active-notices"]
      },
      {
        id: "claim-legal",
        title: "Kattuvus ei ole õiguslik otsus",
        summary:
          "EELIS kattuvus ei ütle automaatselt, et tegevus on keelatud või lubatud.",
        tone: "limit",
        evidenceIds: ["protection-summary"]
      }
    ],
    evidenceItems: [
      {
        id: "registry-stands",
        sourceId: "metsaregister",
        label: "Metsaregistri eraldised",
        summary:
          stands > 0
            ? `${stands} eraldist; 2015: ${stands} eraldise inventuuriandmed.`
            : "Eraldisi ei leitud.",
        status: notices > 0 || stands > 0 ? "loaded" : "missing",
        tone: stands > 0 ? "neutral" : "neutral"
      },
      {
        id: "registry-active-notices",
        sourceId: "metsaregister",
        label: "Aktiivsed metsateatised",
        summary:
          notices > 0
            ? `${notices} metsateatist.`
            : "Aktiivseid metsateatisi ei leitud.",
        status: notices > 0 ? "loaded" : "missing",
        tone: notices > 0 ? "attention" : "positive"
      },
      {
        id: "forest-change-proof",
        sourceId: "forest-changes",
        label: "Metsamuutuste/LiDAR tõend",
        summary: "Ühendamata.",
        status: changes > 0 ? "loaded" : "not_connected",
        tone: changes > 0 ? "attention" : "limit"
      },
      {
        id: "protection-summary",
        sourceId: "eelis",
        label: "EELIS kattuvused",
        summary:
          protectedAreas > 0
            ? `${protectedAreas} kaitsekattuvust.`
            : "Kaitsekattuvust ei leitud.",
        status: protectedAreas > 0 ? "loaded" : "missing",
        tone: protectedAreas > 0 ? "attention" : "neutral"
      },
      {
        id: "elme-context",
        sourceId: "elme",
        label: "ELME looduse hüved",
        summary: `Puidutooraine kattuvusi: ${woodRawMaterial}. Süsiniku kattuvusi: ${carbonStorage}. Muid ELME kattuvusi: ${otherEcosystem}.`,
        status:
          woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
            ? "loaded"
            : "missing",
        tone: "neutral"
      }
    ],
    sourceStatus: [
      {
        id: "maaamet-etak-forest",
        name: "ETAK metsaala",
        status: "loaded",
        targetId: "source-maaamet-etak-forest",
        summary: "Allikas on selle ala andmepakis kasutusel."
      },
      {
        id: "metsaregister",
        name: "Metsaregister",
        status: notices > 0 || stands > 0 ? "loaded" : "missing",
        targetId: "source-metsaregister",
        summary:
          notices > 0 || stands > 0 ? "Allikas on kasutusel." : "Andmed puuduvad."
      },
      {
        id: "eelis",
        name: "EELIS",
        status: protectedAreas > 0 ? "loaded" : "missing",
        targetId: "source-eelis",
        summary:
          protectedAreas > 0 ? "Allikas on kasutusel." : "Andmed puuduvad."
      },
      {
        id: "forest-changes",
        name: "Metsamuutuste / LiDAR muutusetõend",
        status: changes > 0 ? "loaded" : "not_connected",
        targetId: "source-forest-changes",
        summary: changes > 0 ? "Allikas on kasutusel." : "Ühendamata."
      },
      {
        id: "elme",
        name: "ELME looduse hüved",
        status:
          woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
            ? "loaded"
            : "missing",
        targetId: "source-elme",
        summary:
          woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
            ? "Allikas on kasutusel."
            : "Andmed puuduvad."
      }
    ],
    protectionSummary:
      protectedAreas > 0
        ? [
            {
              id: "protection-test",
              type: "protected_area",
              label: "Kaitseala: test",
              count: protectedAreas,
              evidenceIds: ["protection-summary"]
            }
          ]
        : [],
    registrySummary: {
      standsCount: stands,
      activeNoticesCount: notices,
      archivedNoticesCount: 0,
      noticeTypes: [],
      dominantSpecies: stands > 0 ? ["mänd", "kask"] : [],
      developmentClasses: [],
      inventoryYears: stands > 0 ? [2015] : [],
      oldestInventoryYear: stands > 0 ? 2015 : undefined,
      newestInventoryYear: stands > 0 ? 2015 : undefined,
      veryOldInventory: false,
      inventorySummary:
        stands > 0
          ? `2015: ${stands} eraldise inventuuriandmed.`
          : "Inventuuriaastat andmetes ei leitud."
    },
    ecosystemContext: {
      sourceStatus:
        woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
          ? "loaded"
          : "missing",
      summary:
        woodRawMaterial > 0 || carbonStorage > 0 || otherEcosystem > 0
          ? "ELME kontekst on olemas."
          : "ELME kattuvust ei leitud.",
      woodRawMaterialCount: woodRawMaterial,
      carbonStorageCount: carbonStorage,
      otherCount: otherEcosystem
    },
    dataCompleteness: {
      score: 70,
      label: "keskmine",
      reasons: [],
      meaning:
        "Praegu saab kirjeldada ala, kaitsekonteksti ja registriseisu, kuid ei saa kinnitada tegelikult toimunud raiet."
    },
    interpretation: {
      primaryTakeaway:
        "Andmepakk ei kinnita konkreetset tegevust, kuid kirjeldab registri- ja keskkonnakonteksti.",
      activity: {
        id: "interpretation-activity",
        title: "Mis paistab toimunud olevat?",
        summary:
          notices > 0
            ? "Metsateatis on registris olemas, aga muutusetõendita ei saa öelda, et töö toimus."
            : "Aktiivseid metsateatisi ei leitud ja muutusetõend on ühendamata.",
        tone: notices > 0 ? "attention" : "positive",
        evidenceIds: ["registry-active-notices", "forest-change-proof"]
      },
      standStructure: {
        id: "interpretation-stand-structure",
        title: "Metsa struktuur registris",
        summary:
          stands > 0
            ? `Metsaregister jagab ala ${stands} eraldiseks.`
            : "Metsaregistri eraldisi ei leitud.",
        tone: "neutral",
        evidenceIds: ["registry-stands"]
      },
      nature: {
        id: "interpretation-nature",
        title: "Kaitse ja looduse hüved",
        summary:
          protectedAreas > 0
            ? `EELISes on ${protectedAreas} kattuvust.`
            : "EELIS kaitsekattuvust ei näidanud.",
        tone: protectedAreas > 0 ? "attention" : "neutral",
        evidenceIds: ["protection-summary", "elme-context"]
      },
      dataGaps: {
        id: "interpretation-data-gaps",
        title: "Mis piirab järeldust?",
        summary: "Metsamuutuste/LiDAR tõend on ühendamata.",
        tone: "limit",
        evidenceIds: ["forest-change-proof"]
      }
    },
    timeline: [],
    aiContext: {
      answerRules: [],
      evidenceRequired: []
    }
  };

  return {
    area: {
      id: "area-1",
      name: "Test forest",
      type: "forest",
      etakId: 123,
      cadastralId: "29202:005:0601",
      ownershipForm,
      areaHa,
      geometry
    },
    status: notices > 0 ? "planned_activity" : "no_major_change",
    confidenceScore: 70,
    headline: "Test",
    summary: "Test summary",
    publicAudit: {
      targetUser: "test",
      riskScore: 30,
      riskLevel: "medium",
      publicSummary: "Test",
      publicUserSees: [],
      possibleMisreadings: [],
      riskFactors: [],
      disclosureRecommendation: {
        level: "explain_publicly",
        label: "Test",
        rationale: "Test",
        suggestedUiText: []
      },
      aiBrief: []
    },
    aiNarrative: {
      mode: "template",
      status: "ready",
      provider: "test",
      summary: "Test"
    },
    whatHappened: [],
    evidence: [
      ...(notices > 0
        ? [
            {
              id: "notice-1",
              kind: "registry" as const,
              tone: "success" as const,
              title: "Metsateatis",
              description: "Registris on metsateatis."
            }
          ]
        : []),
      ...(protectedAreas > 0
        ? [
            {
              id: "protected-1",
              kind: "protection" as const,
              tone: "info" as const,
              title: "Kaitseala",
              description: "Ala kattub kaitsealaga."
            }
          ]
        : [])
    ],
    missingInfo: [],
    timeline: [],
    warnings: [],
    sources: [
      {
        id: "metsaregister",
        name: "Metsaregister",
        type: "official_rest",
        detail: "test"
      }
    ],
    evidencePackage,
    normalizedEvidence,
    rawFacts: {
      stands: Array.from({ length: stands }, (_, index) => ({ id: `stand-${index}` })),
      notices: Array.from({ length: notices }, (_, index) => ({ id: `notice-${index}` })),
      changes: Array.from({ length: changes }, (_, index) => ({ id: `change-${index}` })),
      protectedAreas: Array.from({ length: protectedAreas }, (_, index) => ({
        id: `protected-${index}`
      }))
    }
  };
}

describe("generateAreaQuestionAnswer", () => {
  it("keeps harvest claims partial when only a notice exists", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ notices: 1 }),
      question: "Kas siin on toimunud raie?"
    });

    expect(answer.verdict).toBe("partial");
    expect(answer.shortAnswer).toContain("Metsateatis");
    expect(answer.cannotSay.join(" ")).toContain("töö on juba tehtud");
  });

  it("does not provide legal conclusions", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ notices: 1, protectedAreas: 1 }),
      question: "Kas see raie oli ebaseaduslik?"
    });

    expect(answer.verdict).toBe("unknown");
    expect(answer.cannotSay.join(" ")).toContain("juriidilist hinnangut");
  });

  it("supports protection answers when EELIS overlap exists", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ protectedAreas: 1 }),
      question: "Kas see ala on kaitse all?"
    });

    expect(answer.verdict).toBe("supported");
    expect(answer.shortAnswer).toContain("kaitse");
  });

  it("answers general capability questions with concrete facts", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ notices: 1, protectedAreas: 1 }),
      question: "Mida selle ala kohta saab kindlalt öelda?"
    });

    expect(answer.verdict).toBe("supported");
    expect(answer.shortAnswer).toContain("metsateatis");
    expect(answer.canSay.join(" ")).toContain("ETAK-i järgi metsaala");
    expect(answer.canSay.join(" ")).toContain("metsateatist");
    expect(answer.canSay.join(" ")).toContain("kaitse");
  });

  it("does not repeat legal limitations for a basic notice question", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ notices: 1 }),
      question: "Kas siin on metsateatis?"
    });

    expect(answer.verdict).toBe("supported");
    expect(answer.cannotSay.join(" ")).not.toContain("juriidilist");
  });

  it("checks combined harvest and protection claims without calling it a violation", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ notices: 1, protectedAreas: 1 }),
      question: "Kas väide \"siin raiuti kaitsealal\" on tõendatud?"
    });

    expect(answer.verdict).toBe("partial");
    expect(answer.shortAnswer).toContain("osaliselt");
    expect(answer.cannotSay.join(" ")).toContain("ei tõenda üksi");
    expect(answer.cannotSay.join(" ")).not.toContain("ebaseaduslik");
  });

  it("checks ownership claims against cadastral ownership form", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ ownershipForm: "Eraomand" }),
      question: "see ala on riigiomand"
    });

    expect(answer.verdict).toBe("not_supported");
    expect(answer.shortAnswer).toContain("Eraomand");
    expect(answer.shortAnswer).toContain("mitte riigiomand");
  });

  it("answers area size questions directly", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ areaHa: 12.34 }),
      question: "kui suur see ala on"
    });

    expect(answer.verdict).toBe("supported");
    expect(answer.shortAnswer).toContain("12.34 ha");
    expect(answer.explanation).toContain("km²");
  });

  it("answers wood raw material counts from ELME instead of EELIS", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ protectedAreas: 24, woodRawMaterial: 14 }),
      question: "Palju on puidutooraine kattuvusi?"
    });

    expect(answer.verdict).toBe("supported");
    expect(answer.shortAnswer).toContain("14");
    expect(answer.shortAnswer.toLocaleLowerCase("et")).toContain("puidutooraine");
    expect(answer.evidenceIds).toContain("elme-context");
    expect(answer.evidenceIds).not.toContain("protection-summary");
  });

  it("summarizes likely situation without starting from generic area facts", async () => {
    const answer = await generateAreaQuestionAnswer({
      analysis: analysisWith({ stands: 12, areaHa: 9.68, protectedAreas: 1 }),
      question: "Võta kokku, mis siin tõenäoliselt toimunud on"
    });

    expect(answer.shortAnswer).toContain("ei kinnita");
    expect(answer.shortAnswer).not.toContain("pindala");
    expect(answer.explanation).toContain("eraldist");
    expect(answer.explanation).toContain("muutusetõend");
    expect(answer.evidenceIds).toContain("registry-stands");
  });
});
