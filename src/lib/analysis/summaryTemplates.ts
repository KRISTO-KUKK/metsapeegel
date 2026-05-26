import type { AnalysisStatus } from "@/lib/types/forestry";

export function headlineForStatus(status: AnalysisStatus): string {
  switch (status) {
    case "documented_harvest":
      return "Sellel alal on tõenäoliselt toimunud dokumenteeritud raie.";
    case "unexplained_change":
      return "Sellel alal paistab selgitamist vajav metsamuutus.";
    case "planned_activity":
      return "Registris on teatis, kuid päris kaugseire muutuse teenus pole ühendatud.";
    case "outdated_data":
      return "Selle ala registriandmed võivad olla aegunud.";
    case "protected_context":
      return "Ala kattub kaitse- või piirangukontekstiga.";
    case "no_major_change":
      return "Ühendatud pärisandmete põhjal ei paista hiljutist suurt metsamuutust.";
    case "insufficient_data":
      return "Selle ala kohta pole kindlaks järelduseks piisavalt avalikke andmeid.";
  }
}

export function summaryForStatus(status: AnalysisStatus): string {
  switch (status) {
    case "documented_harvest":
      return "Kaugseire näitab metsakõrguse või taimkatte olulist vähenemist ning sama alaga kattub metsateatis. See viitab ametlikult teada olevale metsamuutusele, kuid ei ole ametlik otsus.";
    case "unexplained_change":
      return "Kaugseire näitab taimkatte või kõrguse vähenemist, kuid Metsaregistri avalikust päringust ei leitud sama ala kohta selgitavat metsateatist. See on kontrolli vajav andmesignaal, mitte süüdistus.";
    case "planned_activity":
      return "Metsaregistri avalikus päringus on olemas metsateatis. Kuna päris kaugseire muutuse kiht ei ole ühendatud, ei väida Metsapeegel selle põhjal, kas töö on juba toimunud.";
    case "outdated_data":
      return "Metsaeraldiste info on vana ning seetõttu ei saa praeguse seisu kohta tugevat järeldust teha. Värskem inventuur või kaugseire aitaks kindlust suurendada.";
    case "protected_context":
      return "Valitud ala kattub kaitse- või piiranguandmetega. Metsapeegel kuvab seda kontekstina ega anna juriidilist hinnangut tegevuse lubatavusele.";
    case "no_major_change":
      return "Metsaregistrist leiti registriinfo ning ühendatud avalikud teenused ei näita suurt hiljutist muutust. See ei välista väiksemaid või väga värskeid muutusi.";
    case "insufficient_data":
      return "Avalikest päristeenustest jäi selle ala kohta liiga vähe infot. Järeldust tuleks käsitleda esialgse signaalina.";
  }
}
