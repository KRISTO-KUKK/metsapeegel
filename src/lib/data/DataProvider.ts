import type {
  Area,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea,
  SearchResult
} from "@/lib/types/forestry";
import type { Feature, Geometry } from "geojson";

export interface DataProvider {
  searchAreas(query: string): Promise<SearchResult[]>;
  getAreaById(areaId: string): Promise<Area | null>;
  getAreaGeometry(areaId: string): Promise<Feature<Geometry> | null>;
  getForestStands(
    areaGeometry: Geometry,
    areaId?: string,
    area?: Area
  ): Promise<ForestStand[]>;
  getForestNotices(
    areaGeometry: Geometry,
    areaId?: string,
    area?: Area
  ): Promise<ForestNotice[]>;
  getForestChanges(
    areaGeometry: Geometry,
    areaId?: string,
    area?: Area
  ): Promise<ForestChange[]>;
  getProtectedAreas(
    areaGeometry: Geometry,
    areaId?: string,
    area?: Area
  ): Promise<ProtectedArea[]>;
  getSatelliteSignal(areaId: string): Promise<SatelliteSignal | null>;
}

export type SatelliteSignal = {
  supportsChange: boolean;
  signal: string;
  year?: number;
};
