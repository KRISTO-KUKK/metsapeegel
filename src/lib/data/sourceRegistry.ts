import type {
  AreaQueryFilterDefinition,
  AreaQueryFilterId,
  QueryableDataset
} from "@/lib/types/forestry";

export const queryableDatasets: QueryableDataset[] = [
  {
    id: "etak-forest-wfs",
    name: "ETAK metsaalad",
    provider: "Maa- ja Ruumiamet",
    accessMethod: "wfs",
    status: "loaded",
    scope: "map_view",
    url: "https://gsavalik.envir.ee/geoserver/etak/wfs",
    provides: ["metsaala geomeetria", "ETAK ID", "pindala"],
    filterFields: ["bbox", "tyyp_tekst=Mets"],
    limitations: [
      "Kaardivaate paring ei ole kogu Eesti eelindeks.",
      "ETAK kirjeldab topograafilist metsaobjekti, mitte raiet ega oiguslikku seisundit."
    ]
  },
  {
    id: "cadastre-wfs",
    name: "Katastriuksused",
    provider: "Maa- ja Ruumiamet",
    accessMethod: "wfs",
    status: "loaded",
    scope: "selected_area",
    url: "https://gsavalik.envir.ee/geoserver/kataster/wfs",
    provides: ["katastritunnus", "omandivorm", "aadress", "sihtotstarve"],
    filterFields: ["bbox", "tunnus"],
    limitations: [
      "Avalikus vaates kasutatakse omandivormi, mitte omaniku nime.",
      "Katastriuksuse geomeetria ei tahenda, et kogu kinnistu on mets."
    ]
  },
  {
    id: "metsaregister-wfs",
    name: "Metsaregister",
    provider: "Kliimaministeerium / Metsaregister",
    accessMethod: "wfs",
    status: "loaded",
    scope: "selected_area",
    url: "https://gsavalik.envir.ee/geoserver/metsaregister/wfs",
    provides: [
      "eraldised",
      "inventuuriaasta",
      "puuliik",
      "arenguklass",
      "metsateatised"
    ],
    filterFields: ["katastriNr", "inventoryYear", "noticeStatus"],
    limitations: [
      "Metsaregistri WFS-paring tootab katastritunnuse kaudu.",
      "Metsateatis ei toenda uksinda, et too toimus."
    ]
  },
  {
    id: "eelis-wfs",
    name: "EELIS kaitse- ja piirangukihid",
    provider: "Keskkonnaagentuur",
    accessMethod: "wfs",
    status: "loaded",
    scope: "spatial_overlap",
    url: "https://gsavalik.envir.ee/geoserver/eelis/ows",
    provides: ["kaitsealad", "Natura alad", "piirangud", "VEP", "elupaigad"],
    filterFields: ["bbox", "spatialOverlap", "overlapCount"],
    limitations: [
      "Kattuvuse puudumine tahendab ainult, et uhendatud avalikud kihid ei tagastanud kattuvust.",
      "Kattuvus ise ei ole loplik oiguslik otsus."
    ]
  },
  {
    id: "elme-wfs",
    name: "ELME looduse huvede kihid",
    provider: "Keskkonnaagentuur / Keskkonnaportaal",
    accessMethod: "wfs",
    status: "loaded",
    scope: "spatial_overlap",
    url: "https://elmegs.envir.ee/geoserver/elme/ows",
    provides: ["puidutooraine hinnang", "susinikuvaru", "looduse huvede kontekst"],
    filterFields: ["bbox", "category", "valueFields"],
    limitations: [
      "ELME on taustakontekst, mitte raie voi lubatavuse toend.",
      "Vaartusi tuleb tolgendada kihi metoodika piires."
    ]
  },
  {
    id: "forest-changes",
    name: "Metsamuutuste / LiDAR muutusetoend",
    provider: "Maa- ja Ruumiamet",
    accessMethod: "wms",
    status: "not_connected",
    scope: "spatial_overlap",
    url: "https://geoportaal.maaamet.ee/index.php?fatlayerid=metsamuutus_teemakaart&lang_id=1&page_id=966&plugin_act=getfatlayerid",
    provides: ["voimalik korguse voi taimkatte muutus"],
    filterFields: ["not_connected"],
    limitations: [
      "Avalikku WFS/GeoJSON allikat ei ole prototuubis uhendatud.",
      "Seetottu ei kinnita susteem praegu tegelikult toimunud raiet."
    ]
  },
  {
    id: "kaia",
    name: "KAIA avaandmete API",
    provider: "Keskkonnaportaal",
    accessMethod: "wfs",
    status: "not_connected",
    scope: "national_context",
    url: "https://avaandmed.keskkonnaportaal.ee/swagger/v1/swagger.json",
    provides: ["avaandmete failid"],
    filterFields: ["not_indexed"],
    limitations: ["Failide sisuline ruumiline indeks on jargmine too, mitte praegune toendikiht."]
  },
  {
    id: "smi-kese",
    name: "SMI ja KESE metsaseire",
    provider: "Keskkonnaagentuur",
    accessMethod: "derived",
    status: "not_connected",
    scope: "national_context",
    url: "https://keskkonnaportaal.ee/et/teemad/mets",
    provides: ["uleriigiline metsaseire", "trendikontekst"],
    filterFields: ["national_statistics"],
    limitations: ["Ei ole praegu uksiku klikitud metsaala ruumiline toend."]
  }
];

export const areaQueryFilters: AreaQueryFilterDefinition[] = [
  {
    id: "no_protection_overlap",
    label: "Alad ilma kaitsekattuvuseta",
    description:
      "Leiab praeguses kaardivaates ETAK metsaalad, millele uhendatud avalikud EELIS kihid ei tagasta kaitse-, Natura-, piirangu-, VEP- ega elupaigakattuvust.",
    requiredDatasets: ["etak-forest-wfs", "eelis-wfs"],
    parameters: [],
    caveat:
      "See ei ole oiguslik loppotsus ega ule-Eestiline taielik otsing; tulemus kehtib praeguse kaardivaate ja uhendatud avalike EELIS kihtide kohta."
  },
  {
    id: "protection_overlap",
    label: "Kaitsekattuvusega alad",
    description:
      "Leiab praeguses kaardivaates ETAK metsaalad, millele uhendatud avalikud EELIS kihid tagastavad kaitse-, Natura-, piirangu-, VEP- voi elupaigakattuvuse.",
    requiredDatasets: ["etak-forest-wfs", "eelis-wfs"],
    parameters: [],
    caveat:
      "Kattuvus on oluline kontekst, aga mitte loplik oiguslik otsus tegevuse lubatavuse kohta."
  },
  {
    id: "inventory_year",
    label: "Inventuuriaasta jargi alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille seotud Metsaregistri eraldistel on maaratud inventuuriaasta.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs", "metsaregister-wfs"],
    parameters: [
      {
        id: "year",
        label: "Inventuuriaasta",
        type: "year",
        required: true
      }
    ],
    caveat:
      "Metsaregistri paring soltub katastri seosest. Kui metsaala ei onnestu katastriga siduda, ei saa seda selle filtriga kinnitada."
  },
  {
    id: "inventory_before_year",
    label: "Vanema inventuuriga alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille seotud Metsaregistri eraldiste inventuuriaasta on enne etteantud aastat.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs", "metsaregister-wfs"],
    parameters: [
      {
        id: "beforeYear",
        label: "Enne aastat",
        type: "year",
        required: true
      }
    ],
    caveat:
      "See naitab registri inventuuri vanust, mitte automaatselt metsa tegelikku praegust seisundit."
  },
  {
    id: "ownership_form",
    label: "Omandivormi jargi alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille katastri avalik omandivorm vastab kasutaja kusitule.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs"],
    parameters: [
      {
        id: "ownershipForm",
        label: "Omandivorm",
        type: "ownership",
        required: true
      }
    ],
    caveat:
      "Avalikus vaates kasutatakse omandivormi, mitte omaniku nime ega isikuandmeid."
  },
  {
    id: "has_forest_notice",
    label: "Metsateatisega alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille kohta Metsaregistri avalik paring tagastab metsateatise.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs", "metsaregister-wfs"],
    parameters: [],
    caveat:
      "Metsateatis tahendab registrifakti kavandatud voi menetletud tegevuse kohta; see ei toenda uksinda, et too toimus."
  },
  {
    id: "no_forest_notice",
    label: "Metsateatiseta alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille kohta Metsaregistri avalik paring ei tagasta metsateatist.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs", "metsaregister-wfs"],
    parameters: [],
    caveat:
      "Teatise puudumine selles paringus ei toesta, et uhtegi menetlust pole kunagi olnud."
  },
  {
    id: "has_wood_raw_material",
    label: "Puidutooraine ELME kattuvusega alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, millele ELME puidutooraine kiht tagastab kattuvuse.",
    requiredDatasets: ["etak-forest-wfs", "elme-wfs"],
    parameters: [],
    caveat:
      "ELME on majanduslik ja okosusteemne kontekst, mitte raie ega lubatavuse toend."
  },
  {
    id: "has_carbon_storage",
    label: "Susiniku ELME kattuvusega alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, millele ELME susinikuvaru kiht tagastab kattuvuse.",
    requiredDatasets: ["etak-forest-wfs", "elme-wfs"],
    parameters: [],
    caveat:
      "Susinikuvaru kiht on kontekst, mitte automaatne kaitse- voi majandusotsus."
  },
  {
    id: "no_registry_stands",
    label: "Metsaregistri eraldisteta alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille seotud katastri kohta Metsaregister ei tagasta eraldisi.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs", "metsaregister-wfs"],
    parameters: [],
    caveat:
      "Eraldiste puudumine voib tahendada andmepiiri voi sidumise probleemi, mitte automaatselt seda, et ala pole mets."
  },
  {
    id: "area_larger_than",
    label: "Suuremad metsaalad",
    description:
      "Leiab praeguses kaardivaates ETAK metsaalad, mille pindala on suurem voi vordne kasutaja antud hektaritega.",
    requiredDatasets: ["etak-forest-wfs"],
    parameters: [
      {
        id: "minAreaHa",
        label: "Vahim pindala hektarites",
        type: "number",
        required: true
      }
    ],
    caveat:
      "Pindala tuleb valitud ETAK metsaala geomeetriast; see ei pruugi olla kogu kinnistu metsamaa pindala."
  },
  {
    id: "area_smaller_than",
    label: "Vaiksemad metsaalad",
    description:
      "Leiab praeguses kaardivaates ETAK metsaalad, mille pindala on vaiksem voi vordne kasutaja antud hektaritega.",
    requiredDatasets: ["etak-forest-wfs"],
    parameters: [
      {
        id: "maxAreaHa",
        label: "Suurim pindala hektarites",
        type: "number",
        required: true
      }
    ],
    caveat:
      "Pindala tuleb valitud ETAK metsaala geomeetriast; vordlus on kaardivaate eelvaliku piires."
  },
  {
    id: "many_registry_stands",
    label: "Paljude eraldistega alad",
    description:
      "Leiab praeguses kaardivaates metsaalad, mille seotud Metsaregistri eraldiste arv on suurem voi vordne kasutaja antud arvuga.",
    requiredDatasets: ["etak-forest-wfs", "cadastre-wfs", "metsaregister-wfs"],
    parameters: [
      {
        id: "minStands",
        label: "Vahim eraldiste arv",
        type: "number",
        required: true
      }
    ],
    caveat:
      "Eraldiste arv kirjeldab registri jaotust, mitte automaatselt raiet voi metsa kvaliteeti."
  }
];

export function getAreaQueryFilter(id: AreaQueryFilterId) {
  return areaQueryFilters.find((filter) => filter.id === id);
}

export function datasetsForFilter(filterId: AreaQueryFilterId) {
  const filter = getAreaQueryFilter(filterId);
  if (!filter) {
    return [];
  }

  const required = new Set(filter.requiredDatasets);
  return queryableDatasets.filter((dataset) => required.has(dataset.id));
}
