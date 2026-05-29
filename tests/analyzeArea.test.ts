import { describe, expect, it } from "vitest";
import { analyzeArea } from "@/lib/analysis/analyzeArea";
import type { DataProvider, SatelliteSignal } from "@/lib/data/DataProvider";
import type {
  Area,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea,
  SearchResult
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

const area: Area = {
  id: "area-real-provider-test",
  name: "Test forest",
  type: "forest",
  cadastralId: "29202:005:0601",
  areaHa: 1,
  geometry
};

const freshStand: ForestStand = {
  id: "stand-1",
  areaId: area.id,
  mainSpecies: "kuusk",
  developmentClass: "noorendik",
  inventoryYear: 2024,
  areaHa: 1,
  geometry
};

const oldStand: ForestStand = {
  ...freshStand,
  id: "stand-old",
  inventoryYear: 2010
};

const notice: ForestNotice = {
  id: "notice-1",
  areaId: area.id,
  type: "clearcut",
  status: "active",
  workTypeLabel: "lageraie",
  validUntilYear: 2026
};

const change: ForestChange = {
  id: "change-1",
  areaId: area.id,
  source: "lidar",
  changeType: "height_decrease",
  detectedFromYear: 2024,
  detectedToYear: 2025,
  areaHa: 1,
  confidence: 0.8,
  geometry
};

function providerFor({
  stands = [],
  notices = [],
  changes = [],
  protectedAreas = [],
  satelliteSignal = null
}: {
  stands?: ForestStand[];
  notices?: ForestNotice[];
  changes?: ForestChange[];
  protectedAreas?: ProtectedArea[];
  satelliteSignal?: SatelliteSignal | null;
}): DataProvider {
  return {
    async searchAreas(): Promise<SearchResult[]> {
      return [];
    },
    async getAreaById(areaId: string) {
      return areaId === area.id ? area : null;
    },
    async getAreaGeometry(areaId: string) {
      return areaId === area.id
        ? {
            type: "Feature" as const,
            properties: {},
            geometry
          }
        : null;
    },
    async getForestStands() {
      return stands;
    },
    async getForestNotices() {
      return notices;
    },
    async getForestChanges() {
      return changes;
    },
    async getProtectedAreas() {
      return protectedAreas;
    },
    async getEcosystemBenefits() {
      return [];
    },
    async getSatelliteSignal() {
      return satelliteSignal;
    }
  };
}

describe("analyzeArea", () => {
  it("recognizes documented harvest when change and notice match", async () => {
    const result = await analyzeArea(
      area.id,
      providerFor({ stands: [freshStand], notices: [notice], changes: [change] })
    );

    expect(result.status).toBe("documented_harvest");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(result.confidenceScore).toBeLessThanOrEqual(90);
    expect(result.missingInfo).toContain(
      "Metsauuenduse kohta ei ole selles prototüübis värsket infot."
    );
    expect(result.publicAudit.publicUserSees.join(" ")).toContain(
      "Metsaregistris on 1 metsateatis"
    );
    expect(result.aiNarrative.mode).toBe("template");
  });

  it("keeps unexplained change cautious when no notice exists", async () => {
    const result = await analyzeArea(
      area.id,
      providerFor({ stands: [freshStand], changes: [change] })
    );

    expect(result.status).toBe("unexplained_change");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(40);
    expect(result.confidenceScore).toBeLessThanOrEqual(60);
    expect(result.warnings.join(" ")).toContain(
      "See ei tähenda automaatselt rikkumist"
    );
    expect(result.publicAudit.possibleMisreadings.join(" ")).toContain(
      "andmesignaal"
    );
  });

  it("recognizes planned activity when notice exists without remote change", async () => {
    const result = await analyzeArea(
      area.id,
      providerFor({ stands: [freshStand], notices: [notice] })
    );

    expect(result.status).toBe("planned_activity");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(65);
    expect(result.confidenceScore).toBeLessThanOrEqual(75);
    expect(result.publicAudit.disclosureRecommendation.level).toBe(
      "explain_publicly"
    );
  });

  it("shows protected context without exposing hidden detail", async () => {
    const result = await analyzeArea(
      area.id,
      providerFor({
        stands: [oldStand],
        protectedAreas: [
          {
            id: "protected-hidden",
            name: "Tundliku loodusväärtuse üldistus",
            type: "sensitive_hidden",
            publicDetailLevel: "hidden",
            overlapHa: 1
          }
        ]
      })
    );

    expect(result.status).toBe("protected_context");
    expect(result.warnings.join(" ")).toContain("Detailset infot ei kuvata");
    expect(result.publicAudit.riskLevel).toBe("high");
    expect(JSON.stringify(result.rawFacts)).not.toContain(
      "Tundliku loodusväärtuse üldistus"
    );
  });

  it("recognizes stable forest when no major event layers are present", async () => {
    const result = await analyzeArea(
      area.id,
      providerFor({ stands: [freshStand] })
    );

    expect(result.status).toBe("no_major_change");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(75);
    expect(result.publicAudit.disclosureRecommendation.level).toBe("public_ok");
  });
});
