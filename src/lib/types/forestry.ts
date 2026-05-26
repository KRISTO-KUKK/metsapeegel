import type { Feature, Geometry } from "geojson";

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

export type AnalysisResult = {
  area: Area;
  status: AnalysisStatus;
  confidenceScore: number;
  headline: string;
  summary: string;
  whatHappened: string[];
  evidence: EvidenceItem[];
  missingInfo: string[];
  timeline: TimelineEvent[];
  warnings: string[];
  sources: DataSourceRef[];
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
