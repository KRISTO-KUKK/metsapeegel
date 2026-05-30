export type ForestLawTopicId =
  | "protected_area_impact"
  | "nature_compensation"
  | "species_and_habitats"
  | "forest_notice_and_harvest"
  | "tree_age_and_harvest_age"
  | "owner_duties";

export type ForestLawSourceRef = {
  id: string;
  title: string;
  url: string;
  note: string;
};

export type ForestLawTopic = {
  id: ForestLawTopicId;
  title: string;
  practicalMeaning: string[];
  whatToCheck: string[];
  doNotOverstate: string[];
  sourceIds: string[];
};

export const forestLawSources: ForestLawSourceRef[] = [
  {
    id: "looduskaitseseadus",
    title: "Looduskaitseseadus",
    url: "https://www.riigiteataja.ee/akt/112072025017",
    note:
      "Kaitsealade vööndid: § 30 sihtkaitsevöönd, § 31 piiranguvöönd, § 32 hoiuala."
  },
  {
    id: "metsaseadus",
    title: "Metsaseadus",
    url: "https://www.riigiteataja.ee/akt/112052026019",
    note:
      "Metsa majandamise, raiete ja metsateatise üldraam; § 41 käsitleb metsateatist ja Keskkonnaameti kontrolli."
  },
  {
    id: "metsa_majandamise_eeskiri",
    title: "Metsa majandamise eeskiri",
    url: "https://www.riigiteataja.ee/akt/113062025014",
    note:
      "Raie, raievanuse, hooldusraie, sanitaarraie, uuendamise ja metsakaitse tapsustatud nouded."
  },
  {
    id: "keskkonnaamet_kaitse_planeerimine",
    title: "Keskkonnaamet: looduskaitse planeerimine",
    url:
      "https://www.keskkonnaamet.ee/elusloodus-looduskaitse/looduskaitse/looduskaitse-planeerimine",
    note:
      "Kaitse-eeskiri maarab konkreetse ala lubatud, keelatud ja vajalikud tegevused."
  },
  {
    id: "keskkonnaamet_tegevused_kaitstavatel_aladel",
    title: "Keskkonnaamet: tegevused kaitstavatel aladel",
    url:
      "https://keskkonnaamet.ee/elusloodus-looduskaitse/tegevused-kaitstavatel-aladel/muud-luba-vajavad-tegevused",
    note:
      "Kaitstaval loodusobjektil tuleb enne tegevust selgitada piirangud ja vajadusel kysida valitseja nousolekut."
  },
  {
    id: "keskkonnaamet_liigielupaigad",
    title: "Keskkonnaamet: kaitsealuste liikide elupaigad",
    url:
      "https://keskkonnaamet.ee/keskkonnateadlikkus-avalikustamised/inventuurid-ja-ekspertiisid/kaitsealuste-liikide-elupaigad",
    note:
      "Liigi leiukoha piirangud soltuvad liigist, tegevusest ja olemasolevast kaitsekorrast; osa andmeid ei ole avalikud."
  },
  {
    id: "kik_erametsa_hyvitis",
    title: "KIK/Erametsakeskus: Natura 2000 ja looduskaitseliste piirangute toetus",
    url: "https://www.eramets.ee/toetused/natura-metsa-toetus/",
    note:
      "Erametsaomanikule moeldud huvitised Natura 2000 ja muude looduskaitseliste piirangute korral."
  }
];

export const forestLawTopics: ForestLawTopic[] = [
  {
    id: "protected_area_impact",
    title: "Kaitseala, Natura, VEP voi elupaiga praktiline moju",
    practicalMeaning: [
      "Kaitsekattuvus tahendab, et metsa majandamist ei saa vaadata ainult tavalise tulundusmetsa reeglina.",
      "Looduskaitseseaduse § 30 järgi on sihtkaitsevööndis majandustegevus ja loodusvarade kasutamine üldjuhul keelatud, kui kaitse-eeskiri ei luba erandit.",
      "Looduskaitseseaduse § 31 järgi on piiranguvööndis majandustegevus üldjuhul lubatud kitsendustega; sama paragrahv nimetab uuendusraie ja mitmed muud tegevused keelatuks juhul, kui kaitse-eeskiri ei sätesta teisiti.",
      "Hoiualal ja Natura/elupaikade puhul on keskne küsimus, kas kavandatav tegevus võib kahjustada kaitstava väärtuse seisundit.",
      "Konkreetse tegevuse lubatavus tuleb siduda täpselt selle ala kaitse-eeskirja, vööndi ja kavandatud tegevusega; EELIS kattuvus üksi ei ole luba ega keeld."
    ],
    whatToCheck: [
      "Millises vööndis valitud geomeetria asub: loodusreservaat, sihtkaitsevöönd, piiranguvöönd, hoiuala, püsielupaik või ainult Natura/elupaiga kattuvus.",
      "Kas valitud andmepakis on ainult EELIS kattuvus või ka konkreetne kaitse-eeskirja/vööndi info.",
      "Kas kavandatav tegevus on uuendusraie, harvendusraie, sanitaarraie, ehitus, kuivendus, maavara kaevandamine, sõidukiga liikumine või muu tegevus, sest piirangud erinevad."
    ],
    doNotOverstate: [
      "Ara ytle lihtsalt EELIS kattuvuse pohjal, et raie on keelatud voi lubatud.",
      "Ara nimeta tegevust rikkumiseks ilma menetluse, loa, teatise, voondi ja eeskirja kontrollita.",
      "Ara vaita, et Natura, VEP või elupaigakood üksi annab lõpliku otsuse."
    ],
    sourceIds: [
      "looduskaitseseadus",
      "keskkonnaamet_kaitse_planeerimine",
      "keskkonnaamet_tegevused_kaitstavatel_aladel"
    ]
  },
  {
    id: "nature_compensation",
    title: "Looduskaitseliste piirangute huvitised ja maksusoodustus",
    practicalMeaning: [
      "Eraomaniku jaoks voib looduskaitseline piirang tahendada, et osa saamata jaavast tulust on toetuse voi huvitise kaudu kompenseeritav.",
      "Toetus ei ole automaatne: abikolblikkus soltub omandist, ala liigist, voondist, toetusoiguslikust kaardist, taotluse tahtajast ja konkreetsetest tingimustest.",
      "Sihtkaitsevoondi maal kehtib tavaliselt tugevam maksusoodustus; piiranguvoondis ja hoiualal voib kehtida osaline maamaksusoodustus.",
      "Kaitsealuse maa riigile myymine voi omandamine on eraldi rada juhul, kui kaitsekord piirab sihtotstarbelist kasutust oluliselt."
    ],
    whatToCheck: [
      "Kas omandivorm on eraomand ja kas ala on toetusoiguslikul erametsatoetuste kaardil.",
      "Kas kattuvus on Natura 2000 alal, sihtkaitsevoondis, piiranguvoondis, hoiualal, pysielupaigas voi projekteeritaval alal.",
      "Kas taotlusperiood on avatud ja kas ala vastab miinimumpindala ning muudele tingimustele."
    ],
    doNotOverstate: [
      "Ara luba kasutajale huvitist ainult EELIS kattuvuse pohjal.",
      "Ara arvuta toetussummat, kui andmepakis pole toetusoigusliku ala staatust ja taotluse tingimusi.",
      "Ara kasuta ELME majandusvaartust huvitise suuruse asendajana."
    ],
    sourceIds: [
      "keskkonnaamet_kaitse_planeerimine",
      "keskkonnaamet_liigielupaigad",
      "kik_erametsa_hyvitis"
    ]
  },
  {
    id: "species_and_habitats",
    title: "Liigid, elupaigad ja mitteavalik info",
    practicalMeaning: [
      "Kaitsealuse liigi leiukoht voib kaasa tuua tegevuspiiranguid, kuid piirangu sisu soltub liigist, tegevusest ja kaitsekorrast.",
      "I ja II kaitsekategooria liikide asukohaandmed ei pruugi olla avalikus vaates detailselt nahtavad.",
      "Liigi voi elupaiga info on andmepakis oluline riskikontekst, mitte automaatne otsus, et igasugune tegevus on keelatud."
    ],
    whatToCheck: [
      "Kas andmepakis on avalik EELIS kattuvus voi ainult markus, et tundlik info ei ole avalik.",
      "Kas tegevus voib kahjustada konkreetse liigi elupaika voi Natura elupaigatyybi seisundit.",
      "Kas Keskkonnaameti nousolek, lisahindamine voi spetsialisti kontroll on vajalik."
    ],
    doNotOverstate: [
      "Ara avalda voi oleta mitteavalikke liigiasukohti.",
      "Ara eelda, et liigi leiukoht automaatselt moodustab kaitseala, v.a erijuhud, mida peab eraldi kontrollima.",
      "Ara tee liigikaitselist lopphinnangut ilma liigi, kaitsekategooria ja tegevuse andmeteta."
    ],
    sourceIds: ["keskkonnaamet_liigielupaigad", "looduskaitseseadus"]
  },
  {
    id: "forest_notice_and_harvest",
    title: "Metsateatis, raieoigus ja tegelikult toimunud raie",
    practicalMeaning: [
      "Metsateatis on metsaregistri/menetluse signaal kavandatud voi registreeritud tegevuse kohta.",
      "Raie tegelik toimumine vajab lisaks registriteatisele muutusetoendit, valitoendit voi muud kontrollitavat fakti.",
      "Metsaseaduse § 41 järgi esitab metsaomanik Keskkonnaametile metsateatise kavandatavate raiete kohta, välja arvatud valgustusraie, ja oluliste metsakahjustuste kohta.",
      "Metsaseaduse § 41 järgi kontrollib Keskkonnaamet nõuetekohase metsateatise alusel kavandatud raiete vastavust õigusaktide nõuetele; lubav märge ei tõenda üksi, et raie on juba toimunud.",
      "Vaiksemahuline raie voib teatud juhul olla lubatud metsateatist esitamata, aga ainult selles metsaosas oigusaktiga lubatud raie korras ja mahupiirangu sees."
    ],
    whatToCheck: [
      "Kas andmepakis on aktiivne voi arhiveeritud metsateatis ning milline on selle raieliik ja staatus.",
      "Kas sama geomeetriaga kattub kaugseire/LiDAR muutusetoend.",
      "Kas alal on kaitsekord, mis muudab tavalist raieprotsessi."
    ],
    doNotOverstate: [
      "Ara ytle metsateatise pohjal, et raie toimus.",
      "Ara ytle muutusetoendi pohjal, et tegevus oli seaduslik.",
      "Ara ytle teatise puudumise pohjal, et midagi pole kunagi tehtud."
    ],
    sourceIds: ["metsaseadus", "metsa_majandamise_eeskiri"]
  },
  {
    id: "tree_age_and_harvest_age",
    title: "Puistu vanus, raievanus ja raiekupsus",
    practicalMeaning: [
      "Inventuuriaasta ei ole puude vanus; see naitab, millal puistut kirjeldati.",
      "Metsa majandamise eeskirja § 3 järgi on lageraie vanusepoolne alus puistu koosseisuga kaalutud esimese rinde keskmise vanuse võrdlus keskmise raievanusega.",
      "Turberaie vanusepoolne sobivus sõltub samuti puistu koosseisu ja raievanuse loogikast; puuliik, boniteet, rindelisus ja muud takseerandmed on olulised.",
      "Sanitaarraiet voib teha mis tahes vanusega puistus, kuid ainult sanitaarraie tingimustele vastavate puude kohta ja muude piirangute sees.",
      "Kui puistu keskmine vanus on raievanusest suurem, ei tahenda see yksinda, et raie on lubatud; kaitsekord, metsateatis, keskkonnanouded ja muud andmed tuleb ikkagi kontrollida."
    ],
    whatToCheck: [
      "Kas Metsaregistri eraldisel on keskmine vanus, keskmine raievanus, peapuuliik, boniteet, arenguklass ja pindala.",
      "Kas alal on kaitse- voi piirangukattuvus, mis voib raievanuse reeglist rangem olla.",
      "Kas on kehtiv metsateatis voi muu menetluse info, kui kysimus puudutab konkreetset raiet."
    ],
    doNotOverstate: [
      "Ara loe inventuuriaastat puude vanuseks.",
      "Ara anna raiet lubavat otsust ainult vanuse vordluse pohjal.",
      "Ara arvuta raievanust, kui puuduvad puistu elemendid, puuliigid, boniteet voi vastavad takseerandmed."
    ],
    sourceIds: ["metsa_majandamise_eeskiri", "metsaseadus"]
  },
  {
    id: "owner_duties",
    title: "Metsaomaniku uldised kohustused",
    practicalMeaning: [
      "Metsa majandamine peab hoidma metsa kui okosysteemi, metsamulda, veereziimi, uuenemist ja elustiku mitmekesisust.",
      "Kui tegevus voib mojutada kaitstavat loodusobjekti, tuleb kontrollida, kas Keskkonnaameti nousolek voi muu menetlus on vajalik.",
      "Metsatark saab naidata, millised andmed viitavad riskile, aga ametlikku luba voi keeldu annab vastav menetlus."
    ],
    whatToCheck: [
      "Metsateatis ja selle staatus.",
      "Kaitse-eeskiri ja voond.",
      "Puistu takseerandmed, raieliik ja kavandatud tegevuse kirjeldus."
    ],
    doNotOverstate: [
      "Ara tee ametlikku haldusotsust.",
      "Ara asenda Keskkonnaameti voi metsakonsulendi hinnangut.",
      "Ara varja andmepuudust, kui moistlik jareldus vajab puuduvaid andmeid."
    ],
    sourceIds: [
      "metsaseadus",
      "metsa_majandamise_eeskiri",
      "keskkonnaamet_tegevused_kaitstavatel_aladel"
    ]
  }
];

const topicTriggers: Record<ForestLawTopicId, string[]> = {
  protected_area_impact: [
    "kaitse",
    "kaitseala",
    "natura",
    "vep",
    "elupaik",
    "piirang",
    "kattuv",
    "kattuvad",
    "hõlmab",
    "hõlmavad",
    "sihtkaitse",
    "piiranguvoond",
    "kuidas mojutab",
    "kuidas mõjutab",
    "mida tohib",
    "mida ei tohi"
  ],
  nature_compensation: [
    "huvitis",
    "hüvitis",
    "kompensatsioon",
    "toetus",
    "saamata jaanud tulu",
    "saamata jäänud tulu",
    "maamaks",
    "riigile myyk",
    "riigile müük",
    "tasuta",
    "saab selle eest"
  ],
  species_and_habitats: [
    "liik",
    "elupaik",
    "kasvukoht",
    "lendorav",
    "kotkas",
    "must-toonekurg",
    "i kaitsekategooria",
    "ii kaitsekategooria"
  ],
  forest_notice_and_harvest: [
    "metsateatis",
    "teatis",
    "raie",
    "raiuda",
    "raiuti",
    "raieoigus",
    "raieõigus",
    "lageraie",
    "harvendus",
    "sanitaar"
  ],
  tree_age_and_harvest_age: [
    "puude vanus",
    "puistu vanus",
    "keskmine vanus",
    "raievanus",
    "raiekups",
    "raieküps",
    "kups",
    "küps",
    "vanuse",
    "vanus lubab",
    "kui vana"
  ],
  owner_duties: [
    "omanik",
    "kohustus",
    "vastutus",
    "seaduslik",
    "ebaseadus",
    "lubatud",
    "keelatud",
    "nousolek",
    "nõusolek"
  ]
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("et");
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function forestLawTopicsForQuestion(question: string) {
  const normalized = normalize(question);
  const matched = forestLawTopics.filter((topic) =>
    includesAny(normalized, topicTriggers[topic.id])
  );

  if (matched.length > 0) {
    return matched;
  }

  if (
    includesAny(normalized, [
      "seadus",
      "oigus",
      "õigus",
      "reegel",
      "tohib",
      "ei tohi"
    ])
  ) {
    return forestLawTopics.filter((topic) =>
      ["protected_area_impact", "forest_notice_and_harvest", "owner_duties"].includes(topic.id)
    );
  }

  return [];
}
