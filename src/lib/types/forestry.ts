import type { Feature, FeatureCollection, Geometry } from "geojson";

export type Area = {
  id: string;
  name: string;
  type: "forest" | "parcel" | "county" | "custom";
  cadastralId?: string;
  county?: string;
  municipality?: string;
  address?: string;
  landUse?: string;
  ownershipForm?: string;
  forestHa?: number;
  etakId?: number;
  etakFeatureId?: string;
  etakType?: string;
  etakModifiedAt?: string;
  etakGeometryModifiedAt?: string;
  dataSource?: string;
  areaHa: number;
  geometry: Geometry;
};

export type ForestStand = {
  id: string;
  areaId: string;
  standNumber?: number | string;
  mainSpecies?: string;
  developmentClass?: string;
  siteType?: string;
  inventoryYear?: number;
  registryStage?: string;
  areaHa: number;
  geometry: Geometry;
};

export type ForestNotice = {
  id: string;
  areaId: string;
  type: "clearcut" | "thinning" | "sanitary" | "damage" | "unknown";
  status: "active" | "archived" | "unknown";
  registryNumber?: string;
  workTypeLabel?: string;
  statusLabel?: string;
  standNumber?: number | string;
  submittedYear?: number;
  validUntilYear?: number;
  areaHa?: number;
  geometry?: Geometry;
};

export type ForestChange = {
  id: string;
  areaId: string;
  source: "lidar" | "satellite" | "manual" | "unknown";
  changeType:
    | "height_decrease"
    | "vegetation_loss"
    | "possible_damage"
    | "unknown";
  detectedFromYear?: number;
  detectedToYear?: number;
  areaHa: number;
  confidence?: number;
  geometry: Geometry;
};

export type ProtectedArea = {
  id: string;
  areaId?: string;
  name: string;
  type:
    | "protected_area"
    | "natura"
    | "habitat"
    | "restriction"
    | "sensitive_hidden";
  publicDetailLevel: "full" | "generalized" | "hidden";
  overlapHa: number;
  geometry?: Geometry;
};

export type AnalysisStatus =
  | "documented_harvest"
  | "unexplained_change"
  | "planned_activity"
  | "outdated_data"
  | "protected_context"
  | "no_major_change"
  | "insufficient_data";

export type EvidenceKind =
  | "cadastre"
  | "ecosystem"
  | "registry"
  | "remote_sensing"
  | "protection"
  | "satellite";

export type EvidenceTone = "success" | "warning" | "danger" | "info";

export type EvidenceItem = {
  id: string;
  kind: EvidenceKind;
  tone: EvidenceTone;
  title: string;
  description: string;
  year?: number;
  confidence?: number;
};

export type TimelineEvent = {
  id: string;
  year?: number;
  label: string;
  detail: string;
  tone: EvidenceTone;
};

export type DataSourceRef = {
  id: string;
  name: string;
  type: "future_api" | "official_rest" | "official_wfs" | "official_wms";
  detail: string;
};

export type SourceStatus =
  | "loaded"
  | "missing"
  | "error"
  | "not_public"
  | "not_connected";

export type EvidenceSource = {
  id: string;
  name: string;
  provider: string;
  url?: string;
  retrievedAt?: string;
  dataDate?: string;
  status: SourceStatus;
  warning?: string;
};

export type StructuredEvidenceItem = {
  id: string;
  sourceId: string;
  label: string;
  value: string | number | boolean | null;
  unit?: string;
  confidence?: "high" | "medium" | "low";
  explanation?: string;
};

export type SpatialOverlap = {
  id: string;
  sourceId: string;
  layerName: string;
  overlapAreaHa?: number;
  overlapPercentOfSelectedArea?: number;
  properties: Record<string, unknown>;
};

export type EcosystemBenefitCategory =
  | "wood_raw_material"
  | "carbon_storage"
  | "wood_context";

export type EcosystemBenefit = SpatialOverlap & {
  category: EcosystemBenefitCategory;
  title: string;
  valueLabel?: string;
  dataYear?: number;
};

export type DerivedFinding = {
  id: string;
  title: string;
  severity: "info" | "attention" | "warning";
  claim: string;
  evidenceItemIds: string[];
  caveat: string;
};

export type MissingEvidence = {
  id: string;
  label: string;
  whyItMatters: string;
};

export type DataPriority =
  | "critical"
  | "high"
  | "medium"
  | "context"
  | "background";

export type PrioritizedInsight = {
  id: string;
  priority: DataPriority;
  title: string;
  summary: string;
  sourceIds: string[];
  visibleByDefault: boolean;
  reason: string;
  caveat?: string;
};

export type PriorityBlockTone =
  | "base"
  | "attention"
  | "registry"
  | "nature"
  | "gaps";

export type PriorityBlock = {
  id: string;
  title: string;
  subtitle: string;
  tone: PriorityBlockTone;
  rank: number;
  items: string[];
  sourceIds: string[];
  caveat?: string;
};

export type DataCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  scope:
    | "selected_area"
    | "spatial_context"
    | "national_context"
    | "api_catalog";
  priority: DataPriority;
  status: SourceStatus;
  url?: string;
  description: string;
  aiUse: string;
  userVisibility: "always" | "when_relevant" | "advanced";
  limitation?: string;
};

export type ForestAreaEvidencePackage = {
  selectedArea: {
    selectionType:
      | "etak_forest"
      | "cadastre"
      | "drawn_area"
      | "forest_registry_stand";
    geometryId?: string;
    geometrySource: string;
    areaHa?: number;
    county?: string;
    municipality?: string;
    cadastralIds: string[];
  };
  etak: {
    forestObjectId?: string;
    objectType?: string;
    areaHa?: number;
    sourceStatus: SourceStatus;
  };
  cadastre: {
    cadastralIds: string[];
    ownershipForm?: string;
    parcels: StructuredEvidenceItem[];
    sourceStatus: SourceStatus;
  };
  forestRegistry: {
    stands: SpatialOverlap[];
    notices: SpatialOverlap[];
    archivedNotices: SpatialOverlap[];
    forestProtectionExpertises: SpatialOverlap[];
    regenerationExpertises: SpatialOverlap[];
    sourceStatus: SourceStatus;
  };
  eelis: {
    protectedAreaOverlaps: SpatialOverlap[];
    naturaOverlaps: SpatialOverlap[];
    restrictionOverlaps: SpatialOverlap[];
    hiddenSensitiveDataNote?: string;
    sourceStatus: SourceStatus;
  };
  forestChanges: {
    lidarChangeOverlaps: SpatialOverlap[];
    hasChangeEvidence: boolean;
    sourceStatus: SourceStatus;
  };
  ecosystemBenefits: {
    woodRawMaterialOverlaps: EcosystemBenefit[];
    carbonStorageOverlaps: EcosystemBenefit[];
    otherOverlaps: EcosystemBenefit[];
    sourceStatus: SourceStatus;
  };
  mapContext: {
    countyBoundarySourceStatus: SourceStatus;
    basemapSourceStatus: SourceStatus;
  };
  priorityBlocks: PriorityBlock[];
  prioritizedInsights: PrioritizedInsight[];
  dataCatalog: DataCatalogEntry[];
  derivedFindings: DerivedFinding[];
  missingEvidence: MissingEvidence[];
  sources: EvidenceSource[];
};

export type PublicRiskLevel = "low" | "medium" | "high";

export type DisclosureLevel =
  | "public_ok"
  | "explain_publicly"
  | "generalize"
  | "authenticated";

export type PublicAudit = {
  targetUser: string;
  riskScore: number;
  riskLevel: PublicRiskLevel;
  publicSummary: string;
  publicUserSees: string[];
  possibleMisreadings: string[];
  riskFactors: string[];
  disclosureRecommendation: {
    level: DisclosureLevel;
    label: string;
    rationale: string;
    suggestedUiText: string[];
  };
  aiBrief: string[];
};

export type AiNarrative = {
  mode: "template" | "openai" | "ollama";
  status: "generated" | "ready" | "fallback";
  provider: string;
  model?: string;
  summary: string;
  note?: string;
};

export type AnswerVerdict =
  | "supported"
  | "partial"
  | "not_supported"
  | "unknown";

export type AreaAnswerEvidence = {
  id: string;
  label: string;
  detail: string;
  source: string;
  sourceId?: string;
  tone: EvidenceTone;
  year?: number;
};

export type NormalizedEvidenceTone =
  | "positive"
  | "attention"
  | "limit"
  | "neutral";

export type NormalizedEvidenceItem = {
  id: string;
  sourceId: string;
  label: string;
  summary: string;
  status: SourceStatus;
  tone: NormalizedEvidenceTone;
  targetId?: string;
};

export type NormalizedKeyFinding = {
  id: string;
  title: string;
  summary: string;
  tone: NormalizedEvidenceTone;
  evidenceIds: string[];
};

export type NormalizedProtectionGroup = {
  id: string;
  type: "protected_area" | "natura" | "vep" | "habitat" | "restriction";
  label: string;
  count: number;
  overlapHa?: number;
  codes?: string[];
  evidenceIds: string[];
};

export type NormalizedRegistrySummary = {
  standsCount: number;
  activeNoticesCount: number;
  archivedNoticesCount: number;
  noticeTypes: string[];
  dominantSpecies: string[];
  developmentClasses: string[];
  inventoryYears: number[];
  oldestInventoryYear?: number;
  newestInventoryYear?: number;
  veryOldInventory: boolean;
  inventorySummary: string;
};

export type NormalizedEcosystemContext = {
  sourceStatus: SourceStatus;
  summary: string;
  woodRawMaterialCount: number;
  carbonStorageCount: number;
  otherCount: number;
  woodEurPerHaMin?: number;
  woodEurPerHaMax?: number;
  woodTotalEur?: number;
  carbonTonPerHaMin?: number;
  carbonTonPerHaMax?: number;
};

export type NormalizedSourceStatus = {
  id: string;
  name: string;
  provider?: string;
  url?: string;
  status: SourceStatus;
  summary: string;
  targetId?: string;
};

export type NormalizedDataCompleteness = {
  score: number;
  label: string;
  reasons: string[];
  meaning: string;
};

export type NormalizedInterpretationBlock = {
  id: string;
  title: string;
  summary: string;
  tone: NormalizedEvidenceTone;
  evidenceIds: string[];
  metrics?: Array<{
    label: string;
    value: string;
  }>;
};

export type NormalizedInterpretation = {
  primaryTakeaway: string;
  activity: NormalizedInterpretationBlock;
  standStructure: NormalizedInterpretationBlock;
  nature: NormalizedInterpretationBlock;
  dataGaps: NormalizedInterpretationBlock;
};

export type NormalizedTimelineItem = {
  id: string;
  year?: number;
  label: string;
  detail: string;
  tone: EvidenceTone;
  evidenceIds: string[];
};

export type NormalizedSelectedAreaEvidence = {
  area: {
    title: string;
    subtitle: string;
    areaHa: number;
    cadastralId?: string;
    ownershipForm?: string;
    landUse?: string;
    etakId?: number;
    type: Area["type"];
  };
  quickAnswer: string[];
  keyFindings: NormalizedKeyFinding[];
  criticalGaps: NormalizedKeyFinding[];
  cannotClaim: NormalizedKeyFinding[];
  evidenceItems: NormalizedEvidenceItem[];
  sourceStatus: NormalizedSourceStatus[];
  protectionSummary: NormalizedProtectionGroup[];
  registrySummary: NormalizedRegistrySummary;
  ecosystemContext: NormalizedEcosystemContext;
  dataCompleteness: NormalizedDataCompleteness;
  interpretation: NormalizedInterpretation;
  timeline: NormalizedTimelineItem[];
  aiContext: {
    answerRules: string[];
    evidenceRequired: string[];
  };
};

export type AreaQuestionAnswer = {
  mode: "template" | "openai" | "ollama";
  status: "generated" | "ready" | "fallback";
  provider: string;
  model?: string;
  question: string;
  verdict: AnswerVerdict;
  verdictLabel: string;
  confidence: number;
  shortAnswer: string;
  explanation: string;
  canSay: string[];
  cannotSay: string[];
  evidence: AreaAnswerEvidence[];
  evidenceIds: string[];
  mapAction?: AreaMapAction;
  mapHints: string[];
  followUps: string[];
  sources: DataSourceRef[];
  note?: string;
};

export type AnalysisResult = {
  area: Area;
  status: AnalysisStatus;
  confidenceScore: number;
  headline: string;
  summary: string;
  publicAudit: PublicAudit;
  aiNarrative: AiNarrative;
  whatHappened: string[];
  evidence: EvidenceItem[];
  missingInfo: string[];
  timeline: TimelineEvent[];
  warnings: string[];
  sources: DataSourceRef[];
  evidencePackage: ForestAreaEvidencePackage;
  normalizedEvidence: NormalizedSelectedAreaEvidence;
  rawFacts: Record<string, unknown>;
};

export type SearchResult = {
  id: string;
  label: string;
  type: "forest" | "parcel" | "county";
  subtitle?: string;
  center: [number, number];
};

export type AreaFeature = Feature<Geometry, Area & Record<string, unknown>>;

export type DataAccessMethod =
  | "wfs"
  | "wms"
  | "rest"
  | "static_geojson"
  | "derived";

export type QueryableDataset = {
  id: string;
  name: string;
  provider: string;
  accessMethod: DataAccessMethod;
  status: SourceStatus;
  scope:
    | "map_view"
    | "selected_area"
    | "spatial_overlap"
    | "national_context";
  url?: string;
  provides: string[];
  filterFields: string[];
  limitations: string[];
};

export type AreaQueryFilterId =
  | "no_protection_overlap"
  | "protection_overlap"
  | "inventory_year"
  | "inventory_before_year"
  | "ownership_form"
  | "has_forest_notice"
  | "no_forest_notice"
  | "has_wood_raw_material"
  | "has_carbon_storage"
  | "no_registry_stands"
  | "area_larger_than"
  | "area_smaller_than"
  | "many_registry_stands";

export type AreaQueryFilterDefinition = {
  id: AreaQueryFilterId;
  label: string;
  description: string;
  requiredDatasets: string[];
  parameters: Array<{
    id:
      | "year"
      | "beforeYear"
      | "ownershipForm"
      | "minAreaHa"
      | "maxAreaHa"
      | "minStands";
    label: string;
    type: "year" | "ownership" | "number";
    required: boolean;
  }>;
  caveat: string;
};

export type AreaMapAction = {
  type: "highlight_area_query";
  filterId: AreaQueryFilterId;
  label: string;
  year?: number;
  beforeYear?: number;
  ownershipForm?: string;
  minAreaHa?: number;
  maxAreaHa?: number;
  minStands?: number;
  scope: "current_map_view";
  explanation: string;
};

export type AreaQueryFeatureProperties = {
  areaId: string;
  label: string;
  filterId: AreaQueryFilterId;
  matchReason: string;
  areaHa?: number;
  cadastralId?: string;
  ownershipForm?: string;
  inventoryYears?: number[];
  protectionOverlapCount?: number;
  registryStandsCount?: number;
  forestNoticesCount?: number;
  ecosystemOverlapCount?: number;
  averageStandAreaHa?: number;
  standsPer100Ha?: number;
  checkedSources: string[];
};

export type AreaQueryFeature = Feature<
  Geometry,
  AreaQueryFeatureProperties & Record<string, unknown>
>;

export type AreaQueryResponse = FeatureCollection<
  Geometry,
  AreaQueryFeatureProperties & Record<string, unknown>
> & {
  query: {
    filterId: AreaQueryFilterId;
    label: string;
    bbox: [number, number, number, number];
    inspectedCount: number;
    matchedCount: number;
    limit: number;
    scope: "current_map_view";
    year?: number;
    beforeYear?: number;
    ownershipForm?: string;
    minAreaHa?: number;
    maxAreaHa?: number;
    minStands?: number;
  };
  datasets: QueryableDataset[];
  filter: AreaQueryFilterDefinition;
  caveats: string[];
};
