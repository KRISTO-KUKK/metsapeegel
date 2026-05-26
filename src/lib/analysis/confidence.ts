import type { SatelliteSignal } from "@/lib/data/DataProvider";
import type {
  AnalysisStatus,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea
} from "@/lib/types/forestry";

export const REFERENCE_YEAR = 2026;

type ConfidenceInput = {
  status: AnalysisStatus;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  satelliteSignal: SatelliteSignal | null;
  referenceYear?: number;
};

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isInventoryOutdated(
  stand: ForestStand,
  referenceYear = REFERENCE_YEAR
): boolean {
  return Boolean(
    stand.inventoryYear && referenceYear - stand.inventoryYear > 10
  );
}

export function calculateConfidence({
  status,
  stands,
  notices,
  changes,
  protectedAreas,
  satelliteSignal,
  referenceYear = REFERENCE_YEAR
}: ConfidenceInput): number {
  const hasRegistryData = stands.length > 0 || notices.length > 0;
  const hasChange = changes.length > 0;
  const hasNotice = notices.length > 0;
  const hasFreshInventory =
    stands.length > 0 &&
    stands.every((stand) => !isInventoryOutdated(stand, referenceYear));
  const hasHiddenProtection = protectedAreas.some(
    (area) => area.publicDetailLevel === "hidden"
  );
  const hasVisibleProtection = protectedAreas.some(
    (area) => area.publicDetailLevel !== "hidden"
  );

  let score = 50;

  if (hasRegistryData) score += 20;
  if (hasChange && hasNotice) score += 20;
  if (hasFreshInventory) score += 10;
  if (hasVisibleProtection) score += 10;
  if (satelliteSignal?.supportsChange && hasChange) score += 10;

  if (hasChange && !hasNotice) score -= 20;
  if (stands.some((stand) => isInventoryOutdated(stand, referenceYear))) {
    score -= 15;
  }
  if (hasHiddenProtection) score -= 10;
  if (hasNotice && !hasChange) score -= 10;
  if (status === "documented_harvest") score -= 10;
  if (stands.length === 0) score -= 15;

  return clampScore(score);
}
