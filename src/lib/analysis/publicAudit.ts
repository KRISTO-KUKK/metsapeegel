import { isInventoryOutdated } from "@/lib/analysis/confidence";
import type {
  Area,
  DisclosureLevel,
  ForestChange,
  ForestNotice,
  ForestStand,
  ProtectedArea,
  PublicAudit,
  PublicRiskLevel
} from "@/lib/types/forestry";

type PublicAuditInput = {
  area: Area;
  stands: ForestStand[];
  notices: ForestNotice[];
  changes: ForestChange[];
  protectedAreas: ProtectedArea[];
};

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function isPrivateOwnership(area: Area): boolean {
  return area.ownershipForm?.toLocaleLowerCase("et").includes("era") ?? false;
}

function riskLevel(score: number): PublicRiskLevel {
  if (score >= 65) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function recommendationFor({
  score,
  area,
  notices,
  protectedAreas,
  changes,
  oldInventory
}: PublicAuditInput & {
  score: number;
  oldInventory: boolean;
}): {
  level: DisclosureLevel;
  label: string;
  rationale: string;
  suggestedUiText: string[];
} {
  const hiddenProtection = protectedAreas.some(
    (item) => item.publicDetailLevel === "hidden"
  );
  const hasPrivateContext = isPrivateOwnership(area);
  const hasNotice = notices.length > 0;
  const hasProtectedContext = protectedAreas.length > 0;

  if (hiddenProtection) {
    return {
      level: "authenticated",
      label: "Näita täpseid detaile ainult kontrollitud vaates",
      rationale:
        "Avalikus vaates võib tundliku looduskaitselise info täpne kuvamine olla liiga detailne.",
      suggestedUiText: [
        "Alal võib olla looduskaitseline tundlikkus; avalikus vaates kuvatakse üldistatud selgitus.",
        "Täpsem info on mõeldud pädevale või autenditud kasutajale."
      ]
    };
  }

  if (score >= 65 || (hasPrivateContext && hasNotice && hasProtectedContext)) {
    return {
      level: "generalize",
      label: "Üldista või näita ainult tugeva kontekstiga",
      rationale:
        "See andmekombinatsioon võib ilma kontekstita tekitada liiga kindla või tundliku järelduse.",
      suggestedUiText: [
        "Metsateatis ei tõenda üksi, et töö on juba tehtud.",
        "Kaitseinfo on kontekst, mitte juriidiline otsus tegevuse lubatavuse kohta.",
        "Kaardil tuleb tõendid ja piirangud kuvada koos, mitte kutsuda kasutajat tegema õiguslikke järeldusi."
      ]
    };
  }

  if (score >= 30 || hasNotice || hasProtectedContext || oldInventory) {
    return {
      level: "explain_publicly",
      label: "Avalik, aga vajab automaatset selgitust",
      rationale:
        "Andmed on avalikud, kuid nende tähendus vajab lihtsat tõlgendust.",
      suggestedUiText: [
        hasNotice
          ? "Metsateatis tähendab kavandatud või menetletud tegevust; see ei tähenda automaatselt, et raie on toimunud."
          : "Avalik info ei näita kõiki metsas toimunud muutusi.",
        changes.length === 0
          ? "Kui muutuse kinnitavat kihti ei ole ühendatud, ei saa toimunud raiet ainult selle vaate põhjal väita."
          : "Kaugseire signaal on andmesignaal, mitte ametlik otsus.",
        hasProtectedContext
          ? "Kaitse- või piiranguinfo annab konteksti, mitte lõpliku lubatavuse hinnangu."
          : "Järeldust tuleb lugeda koos puuduvate andmete loeteluga."
      ]
    };
  }

  return {
    level: "public_ok",
    label: "Avalik kuvamine on madala riskiga",
    rationale:
      "Valitud avalikud andmed ei paista üksi andvat tugevat eksitavat ega tundlikku järeldust.",
    suggestedUiText: [
      "See on avalike andmete põhjal koostatud selgitus, mitte ametlik otsus."
    ]
  };
}

export function buildPublicAudit(input: PublicAuditInput): PublicAudit {
  const { area, stands, notices, changes, protectedAreas } = input;
  const oldInventory = stands.some((stand) => isInventoryOutdated(stand));
  const privateOwnership = isPrivateOwnership(area);
  const protectedNames = unique(protectedAreas.map((item) => item.name));
  const noticeTypes = unique(
    notices.map((notice) => notice.workTypeLabel ?? notice.type)
  );

  const publicUserSees = unique([
    area.etakId
      ? `ETAK metsaala ${area.etakId}, ligikaudu ${area.areaHa} ha.`
      : `Valitud metsaala, ligikaudu ${area.areaHa} ha.`,
    area.cadastralId
      ? `Katastritunnus ${area.cadastralId}${area.address ? ` ja aadress "${area.address}"` : ""}.`
      : null,
    area.ownershipForm ? `Omandivorm: ${area.ownershipForm}.` : null,
    stands.length > 0
      ? `Metsaregistris on ${stands.length} eraldist, sh puuliigi ja inventuuri andmed.`
      : "Metsaregistri eraldise infot ei leitud.",
    notices.length > 0
      ? `Metsaregistris on ${notices.length} metsateatis(t): ${noticeTypes.join(", ")}.`
      : "Avalikust Metsaregistri päringust ei leitud metsateatist.",
    protectedAreas.length > 0
      ? `EELISes on kattuv kaitse- või piiranguinfo: ${protectedNames.slice(0, 3).join(", ")}.`
      : "EELISest ei leitud kattuvat kaitse- või piiranguinfot.",
    changes.length > 0
      ? `Kaugseire muutuse signaale on ${changes.length}.`
      : "Päris kaugseire muutuse kiht ei ole selles vaates kinnituseks ühendatud."
  ]);

  const possibleMisreadings = unique([
    notices.length > 0
      ? "Kasutaja võib arvata, et metsateatis tähendab juba toimunud raiet, kuigi see võib olla kavandatud või menetletud tegevus."
      : null,
    notices.length > 0 && changes.length === 0
      ? "Ilma muutuse kinnitava kihita ei saa selle vaate põhjal öelda, kas töö on juba toimunud."
      : null,
    changes.length > 0 && notices.length === 0
      ? "Kaugseire andmesignaali võib pidada rikkumise tõendiks, kuigi selgitav registriinfo võib puududa või olla teises allikas."
      : null,
    protectedAreas.length > 0
      ? "Kaitse- või piiranguala kattuvust võib ekslikult pidada automaatseks keeluks või rikkumise tunnuseks."
      : null,
    oldInventory
      ? "Vana inventuuriandmestik võib jätta mulje täpsemast hetkeseisust, kui andmed tegelikult lubavad."
      : null,
    privateOwnership && (notices.length > 0 || protectedAreas.length > 0)
      ? "Eraomandi info koos teatiste või kaitsekontekstiga võib tunduda konkreetsem, kui avalik vaade tegelikult tõestab."
      : null
  ]);

  const riskFactors = unique([
    privateOwnership && (notices.length > 0 || protectedAreas.length > 0)
      ? "Eraomandi info on koos teatiste või kaitsekontekstiga."
      : null,
    notices.length > 0
      ? "Metsateatised on avaliku kasutaja jaoks kergesti üle tõlgendatavad."
      : null,
    protectedAreas.length > 0
      ? "Kaitse- või piiranguinfo vajab õigusliku tähenduse selgitust."
      : null,
    changes.length > 0 && notices.length === 0
      ? "Kaugseire muutuse signaal ilma sama vaate metsateatiseta."
      : null,
    protectedAreas.some((item) => item.publicDetailLevel === "hidden")
      ? "Osa looduskaitselisest infost on tundlik või üldistatud."
      : null,
    oldInventory ? "Inventuuriandmed võivad olla aegunud." : null,
    notices.length > 0 && changes.length === 0
      ? "Toimumise kinnitamiseks puudub sama vaate kaugseire muutuse kinnitus."
      : null,
    stands.length === 0 ? "Metsaregistri eraldiste infot ei leitud." : null
  ]);

  let score = 5;
  if (notices.length > 0) score += 25;
  if (notices.length > 0 && changes.length === 0) score += 5;
  if (changes.length > 0 && notices.length === 0) score += 40;
  if (changes.length > 0 && notices.length > 0) score += 15;
  if (protectedAreas.length > 0) score += 25;
  if (privateOwnership && notices.length > 0) score += 10;
  if (privateOwnership && protectedAreas.length > 0) score += 10;
  if (stands.length === 0) score += 10;
  if (protectedAreas.some((item) => item.publicDetailLevel === "hidden")) {
    score += 60;
  }
  if (oldInventory) score += 15;
  score = Math.max(0, Math.min(100, score));

  const recommendation = recommendationFor({
    ...input,
    score,
    oldInventory
  });
  const level = riskLevel(score);

  return {
    targetUser: "Metsapeegli kasutaja, kes kontrollib metsaandmete põhjal tehtud väidet",
    riskScore: score,
    riskLevel: level,
    publicSummary:
      level === "high"
        ? "Selle ala kohta ei tohiks teha liiga kindlat järeldust ilma tugeva konteksti ja allikateta."
        : level === "medium"
          ? "Selle ala kohta saab näidata avalikke andmeid, kuid kasutaja vajab automaatset selgitust."
          : "Selle ala avalikud andmed ei tekita praegu tugevat valejärelduse signaali.",
    publicUserSees,
    possibleMisreadings:
      possibleMisreadings.length > 0
        ? possibleMisreadings
        : ["Suurt tüüpilist valejärelduse riski ei paista, kui allikad ja piirangud on selgelt välja toodud."],
    riskFactors:
      riskFactors.length > 0
        ? riskFactors
        : ["Avalikus vaates ei paista tugevat tundlikku või eksitavat andmekombinatsiooni."],
    disclosureRecommendation: recommendation,
    aiBrief: [
      `Tõlgendusrisk: ${level}, skoor ${score}/100.`,
      `Soovitus: ${recommendation.label}.`,
      ...publicUserSees,
      ...possibleMisreadings
    ]
  };
}
