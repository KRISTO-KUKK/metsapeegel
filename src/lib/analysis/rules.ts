import type {
  AnalysisStatus,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea
} from "@/lib/types/forestry";
import { isInventoryOutdated, REFERENCE_YEAR } from "@/lib/analysis/confidence";

type RuleInput = {
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
  referenceYear?: number;
};

export function determineStatus({
  stands,
  notices,
  changes,
  protectedAreas
}: RuleInput): AnalysisStatus {
  const hasChange = changes.length > 0;
  const hasNotice = notices.length > 0;
  const hasProtectedContext = protectedAreas.length > 0;

  if (hasProtectedContext && !hasChange && !hasNotice) {
    return "protected_context";
  }

  if (hasChange && hasNotice) {
    return "documented_harvest";
  }

  if (hasChange && !hasNotice) {
    return "unexplained_change";
  }

  if (hasNotice && !hasChange) {
    return "planned_activity";
  }

  if (
    stands.length > 0 &&
    stands.every((stand) => isInventoryOutdated(stand))
  ) {
    return "outdated_data";
  }

  if (stands.length > 0) {
    return "no_major_change";
  }

  return "insufficient_data";
}

export function getMissingInfo({
  stands,
  notices,
  changes,
  protectedAreas,
  referenceYear = REFERENCE_YEAR
}: RuleInput): string[] {
  const missing = new Set<string>();

  if (stands.length === 0) {
    missing.add("Metsaregistri avalikust päringust ei leitud metsaeraldise infot.");
  }

  if (stands.some((stand) => isInventoryOutdated(stand, referenceYear))) {
    missing.add("Metsainventuuri andmed võivad olla aegunud.");
  }

  if (changes.length > 0 && notices.length === 0) {
    missing.add("Metsaregistri avalikus päringus puudub registrisündmus, mis muutust selgitaks.");
  }

  if (notices.length > 0 && changes.length === 0) {
    missing.add("Päris kaugseire muutuse teenus pole veel ühendatud; kaart ei väida muutust ilma allikata.");
  }

  if (changes.length > 0 && notices.length > 0) {
    missing.add("Metsauuenduse kohta ei ole selles prototüübis värsket infot.");
  }

  if (protectedAreas.some((area) => area.publicDetailLevel === "hidden")) {
    missing.add(
      "Osa looduskaitselist infot on avalikus vaates üldistatud või peidetud."
    );
  }

  if (missing.size === 0) {
    missing.add("Värskem satelliidi või lidari kontroll kasvataks kindlust.");
  }

  return Array.from(missing);
}

export function getWarnings(
  status: AnalysisStatus,
  protectedAreas: ProtectedArea[]
) {
  const warnings = new Set<string>();

  if (status === "unexplained_change") {
    warnings.add(
      "See ei tähenda automaatselt rikkumist. Andmed näitavad ainult, et muutuse selgitus vajab kontrolli."
    );
  }

  if (protectedAreas.length > 0) {
    warnings.add(
      "Kaitse- või piiranguinfo annab konteksti, mitte juriidilist hinnangut."
    );
  }

  if (protectedAreas.some((area) => area.publicDetailLevel === "hidden")) {
    warnings.add(
      "Alal võib olla looduskaitseline tundlikkus. Detailset infot ei kuvata avalikus vaates."
    );
  }

  if (status === "insufficient_data") {
    warnings.add("Järeldus on nõrk, sest avalikest päristeenustest jäi infot väheks.");
  }

  return Array.from(warnings);
}
