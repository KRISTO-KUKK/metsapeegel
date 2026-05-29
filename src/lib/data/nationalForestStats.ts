export type NationalStatSource = {
  id: string;
  label: string;
  url: string;
  note: string;
};

export type NationalMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  sourceIds: string[];
};

export type NationalShare = {
  label: string;
  value: number;
  unit: "%" | "mln ha";
  detail?: string;
};

export const nationalForestStatSources: NationalStatSource[] = [
  {
    id: "smi-2024-fact-sheet",
    label: "Keskkonnaportaal: Eesti metsad faktileht",
    url: "https://keskkonnaportaal.ee/sites/default/files/Teemad/Mets/Faktileht_Eesti_metsad.pdf",
    note:
      "2024. aasta SMI koondvaade: metsamaa pindala, tagavara, omand, raiemaht ja vanuseline üldpilt."
  },
  {
    id: "smi-method",
    label: "Keskkonnaportaal: Metsastatistika, sh SMI",
    url: "https://keskkonnaportaal.ee/et/teemad/mets/metsastatistika-sh-smi",
    note:
      "Selgitab, et SMI on üleriigiline valikuuring ja sobib Eesti metsavarude üldistatud hindamiseks."
  },
  {
    id: "protected-forest-2023",
    label: "Keskkonnaagentuur: metsamaa ja kaitsealune metsamaa",
    url: "https://keskkonnaagentuur.ee/node/1539",
    note:
      "2023. aasta kaitsealuse metsamaa koondarvud SMI ja ETAK metoodika võrdlusega."
  },
  {
    id: "wood-resource",
    label: "Keskkonnaportaal: mets kui puiduressurss",
    url: "https://keskkonnaportaal.ee/et/mets-kui-puiduressurss",
    note:
      "Selgitab raiemahu ja netojuurdekasvu võrdluse tõlgendamise piire."
  }
];

export const nationalMetrics: NationalMetric[] = [
  {
    id: "forest-land-area",
    label: "Metsamaa pindala",
    value: "2,35 mln ha",
    detail:
      "SMI koondvaate järgi on Eesti metsamaa suurusjärgus 2,35 miljonit hektarit.",
    sourceIds: ["smi-2024-fact-sheet"]
  },
  {
    id: "forest-share",
    label: "Metsasus",
    value: "51,3%",
    detail:
      "2023. aasta SMI hinnangu järgi moodustab metsamaa 51,3% Eesti maismaast; hinnangul on statistiline viga.",
    sourceIds: ["protected-forest-2023", "smi-method"]
  },
  {
    id: "standing-stock",
    label: "Kasvava metsa tagavara",
    value: "452,8 mln m³",
    detail:
      "2024. aasta faktilehe järgi oli kasvava metsa tagavara 452,8 miljonit kuupmeetrit.",
    sourceIds: ["smi-2024-fact-sheet"]
  },
  {
    id: "harvest-volume",
    label: "Raiemaht",
    value: "11,7 mln m³",
    detail:
      "SMI 2023. aasta raiemahu hinnang sisaldab kolme raiehooaja mõõtmisi; viimasel kahel kümnendil on hinnang kõikunud 5,4-12,8 mln m³ vahel.",
    sourceIds: ["smi-2024-fact-sheet", "wood-resource"]
  },
  {
    id: "average-age",
    label: "Puistute keskmine vanus",
    value: "u 55 a",
    detail:
      "Puistute keskmine vanus on viimastel kümnenditel püsinud umbes 55 aasta tasemel; üle 100-aastaseid puistuid on suhteliselt vähem.",
    sourceIds: ["smi-2024-fact-sheet"]
  },
  {
    id: "protected-area",
    label: "Kaitsealune metsamaa",
    value: "467 003 ha",
    detail:
      "ETAK-põhise 2023. aasta hinnangu järgi on kaitsealuse metsamaa pindala 467 003 ha ehk 19,9% kogu metsamaast.",
    sourceIds: ["protected-forest-2023"]
  },
  {
    id: "strict-protection",
    label: "Range kaitse",
    value: "260 560 ha",
    detail:
      "ETAK-i järgi on range kaitse all 260 560 ha ehk 11,1% metsamaast; SMI metoodikas on võrreldav hinnang 272 487 ha ehk 11,7%.",
    sourceIds: ["protected-forest-2023"]
  },
  {
    id: "excluded-from-production",
    label: "Puiduvarumine välistatud",
    value: "18,1%",
    detail:
      "SMI järgi on koos muude piirangutega 18,1% metsamaast selline, kus metsa majandamine puidu varumise eesmärgil on välistatud.",
    sourceIds: ["protected-forest-2023"]
  }
];

export const ownershipShares: NationalShare[] = [
  { label: "RMK hallatav riigimets", value: 46, unit: "%", detail: "RMK" },
  { label: "Muu riigimaa", value: 4, unit: "%", detail: "riik" },
  { label: "Füüsiliste isikute maa", value: 27, unit: "%", detail: "era" },
  { label: "Juriidiliste isikute maa", value: 23, unit: "%", detail: "era" }
];

export const dominantSpeciesAreaShares: NationalShare[] = [
  { label: "Mänd", value: 35, unit: "%" },
  { label: "Kask", value: 27, unit: "%" },
  { label: "Kuusk", value: 18, unit: "%" },
  { label: "Haab", value: 8, unit: "%" },
  { label: "Hall lepp", value: 7, unit: "%" },
  { label: "Sanglepp", value: 4, unit: "%" },
  { label: "Teised", value: 1, unit: "%" }
];

export const dominantSpeciesStockShares: NationalShare[] = [
  { label: "Kask", value: 30, unit: "%" },
  { label: "Mänd", value: 30, unit: "%" },
  { label: "Kuusk", value: 18, unit: "%" },
  { label: "Hall lepp", value: 10, unit: "%" },
  { label: "Haab", value: 7, unit: "%" },
  { label: "Sanglepp", value: 4, unit: "%" },
  { label: "Teised", value: 1, unit: "%" }
];

export const managementRestrictionShares: NationalShare[] = [
  {
    label: "Majanduspiiranguta metsad",
    value: 1.65,
    unit: "mln ha"
  },
  {
    label: "Majanduspiiranguga metsad",
    value: 0.24,
    unit: "mln ha"
  },
  {
    label: "Mittemajandatavad metsad",
    value: 0.46,
    unit: "mln ha"
  }
];

export const nationalForestInsights = [
  "Ühe valitud ala metsaandmed ei ütle, kas Eesti metsaga tervikuna läheb hästi või halvasti. SMI on selleks õige üldistuskiht.",
  "Kaitseinfo tõlgendamisel on metoodika tähtis: ETAK sobib kaardipõhiseks kaitsealuse metsamaa hindamiseks, SMI sobib üle-Eestiliseks statistiliseks jaotuseks.",
  "Raiemahtu ei tasu võrrelda ainult ühe aasta juurdekasvuga; Keskkonnaportaal rõhutab, et vanuseline ja maakategooriate muutus mõjutab tõlgendust.",
  "Hackathoni demo jaoks on tugev narratiiv: Metsatark ühendab kliki tasandi tõendid Eesti üldpildiga ja ütleb, millal konkreetse ala põhjal ei tohi liiga suurt järeldust teha."
];
