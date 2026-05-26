# Metsapeegel – spec-sheet.md

## 0. Codexile antav roll

Sa oled senior full-stack arendaja ja tootedisaini partner. Ehita häkatoni prototüüp nimega **Metsapeegel**.

Eesmärk ei ole teha "veel ühte metsakaarti". Eesmärk on teha **tõlgendusvahend**, mis võtab eri allikatest pärit metsandusandmed, analüüsib neid koos ja näitab kasutajale inimkeeles:

1. **Mis valitud metsaalal tõenäoliselt toimus?**
2. **Mille põhjal me seda teame?**
3. **Kui kindlad me selles oleme?**
4. **Mis info on puudu või vajab kontrolli?**

Kaart on ainult üks kasutajaliidese osa. Peamine väärtus on andmete tõlgendus, sündmuslugu ja usaldusskoor.

---

## 1. Toote ühe lausega kirjeldus

**Metsapeegel on Eesti metsandusandmete tõlgenduskiht: kasutaja valib metsaala, süsteem ühendab registri-, kaugseire-, katastri- ja piiranguandmed ning annab lihtsa kokkuvõtte sellest, mis alal toimus ja kui usaldusväärne see järeldus on.**

---

## 2. Hackathoni narratiiv

Lahendus peab sobituma järgmiste väljakutsetega:

- **Uus toode või teenus metsanduslike avaandmete peal**
- **Metsainfo visualiseerimine ja populariseerimine**
- **Metsanduslik kaugseire**
- **Andmete vastutustundlik kasutamine / turvariskid**

Pitch'is rõhuta:

> "Praegu on Eestis metsandusandmeid palju, kuid inimene peab need ise eri kaartidelt ja registritest kokku tõlgendama. Metsapeegel teeb selle tõlgendamise tema eest."

---

## 3. Sihtrühmad

### 3.1 Tavakasutaja
Tahab teada:
- mis tema kodu lähedal metsatükiga toimub;
- kas seal on toimunud raie;
- kas see tundub tavaline või vajab selgitamist.

### 3.2 Ajakirjanik / kommunikatsiooniinimene
Tahab saada:
- lihtsat metsalugu;
- allikaid ja tõendeid;
- ilma eksitava või üledramatiseeritud järelduseta kokkuvõtet.

### 3.3 Keskkonnaagentuuri / riigiasutuse analüütik
Tahab leida:
- andmelünki;
- vastuolusid;
- alasid, kus kaugseire ja registriandmed ei klapi;
- juhtumeid, mida tasub kontrollida või paremini selgitada.

### 3.4 Metsaomanik
Tahab aru saada:
- mida registris tema metsa kohta näidatakse;
- kas andmed tunduvad vanad;
- kas tema alaga kattub teatis, muutus või piirang.

---

## 4. Lihtsad terminid kasutajaliideses

Kasuta kasutajaliideses spetsialistikeele asemel lihtsaid selgitusi.

### Metsateatis
Metsaomaniku ametlik teade riigile kavandatava raie või olulise metsakahjustuse kohta.

UI-s selgita:
> "Metsateatis tähendab, et selle ala kohta on riigile ametlikult teatatud kavandatavast raiest või metsakahjustusest."

### Kaugseire
Metsa jälgimine satelliidi, lennuki, lidari või drooni abil.

UI-s selgita:
> "Kaugseire tähendab, et metsa muutust hinnatakse ülevalt kogutud piltide või kõrgusandmete põhjal."

### Metsaeraldis
Registris eristatud väiksem metsaosa.

UI-s selgita:
> "Metsaeraldis on registris eraldi kirjeldatud metsatükk."

### Lageraie
Raieliik, mille korral ala võetakse suures osas lagedaks ja peab hiljem uuenema.

UI-s selgita:
> "Lageraie tähendab, et suurem osa puistust raiutakse maha ning ala peab hiljem uuesti metsastuma."

### Usaldusskoor
Meie arvutatud hinnang, kui hästi eri andmeallikad omavahel klapivad.

UI-s selgita:
> "Usaldusskoor näitab, kui hästi registri-, kaugseire- ja piiranguandmed omavahel kokku lähevad. See ei ole ametlik otsus."

---

## 5. Põhifunktsioonid

### 5.1 Avaleht
Avaleht peab avanema kohe Eesti kaardiga.

Nõuded:
- kogu ekraani kattev minimalistlik Eesti kaart;
- maakonnad eraldatud selgete, kuid elegantsete joontega;
- kaardil ei tohi olla Google Mapsi laadset liigset müra: poed, tanklad, restoranid, reklaamid, juhuslikud teed ei ole olulised;
- üleval fikseeritud otsinguriba;
- roheline, modernne visuaalne keel;
- pealkiri või logo: **Metsapeegel**;
- alapealkiri: **"Vaata, mis valitud metsaalal andmete põhjal toimus."**

### 5.2 Otsing
Otsinguriba placeholder:

> "Otsi aadressi, katastritunnuse, maakonna või näidisalaga..."

MVP-s peab otsing toetama:
- maakonna nime otsingut;
- mock-katastritunnuseid;
- mock-aadresse;
- näidisalade otsingut, nt "Näidis: dokumenteeritud raie", "Näidis: selgitamata muutus".

Pärisandmete faasis:
- katastritunnus;
- aadress;
- kaardilt ala valimine;
- hiljem vaba polügooni joonistamine.

### 5.3 Ala valimine
Kasutaja saab ala valida:
- otsingu kaudu;
- kaardil mock-parcelile klikates;
- maakonnale klikates üldise ülevaate vaatamiseks.

Pärast valikut:
- kaart zoomib valitud alale;
- paremale või vasakule avaneb detailpaneel;
- valitud ala piir joonistatakse selgelt välja;
- seotud metsamuutus, metsateatis, kaitseala jm kihid kuvatakse ainult vajadusel.

### 5.4 Detailpaneel
Detailpaneel on toote peamine osa.

Paneeli struktuur:

1. **Lühijäreldus**
2. **Usaldusskoor**
3. **Mis juhtus?**
4. **Mille põhjal?**
5. **Mis on puudu?**
6. **Ajajoon**
7. **Andmeallikad**
8. **Tehniline detail / JSON / raw facts**, collapsible

Näide:

> **Sellel alal on tõenäoliselt toimunud dokumenteeritud raie.**
>
> Kaugseire järgi on metsakõrgus vähenenud. Sama ala kohta on olemas metsateatis, seega muutus paistab olevat riigile teada. See ei tähenda automaatselt midagi kahtlast.
>
> **Usaldus: 82/100**
>
> Puuduv info: uuendamise kohta ei ole veel värsket infot.

---

## 6. Kasutajaliidese stiil

### 6.1 Üldine tunne
Modernne, rahulik, usaldusväärne, riigiteenuse ja kaasaegse startup-toote vahepealne.

Väldi:
- odavat "hacker green" stiili;
- liiga tumedat cyberpunk'i;
- Google Mapsi moodi baasikaarti;
- suurt hulka kihilüliteid;
- kasutajale arusaamatuid GIS-nuppe.

### 6.2 Värvipalett
Kasuta CSS custom property'idena:

```css
:root {
  --forest-950: #061A0D;
  --forest-900: #0B2F1A;
  --forest-800: #14532D;
  --forest-700: #166534;
  --forest-600: #15803D;
  --forest-500: #22C55E;
  --forest-300: #86EFAC;
  --sage-100: #DCFCE7;
  --sage-50: #F0FDF4;
  --moss: #4D7C0F;
  --amber: #F59E0B;
  --warning: #EF4444;
  --ink: #0F172A;
  --muted: #64748B;
  --panel: rgba(255, 255, 255, 0.88);
}
```

### 6.3 UI detailid
- otsinguriba on klaasjas/frosted panel;
- kaardil on pehme roheline gradient-taust;
- maakondade piirid on õhukesed ja elegantsed;
- hover-olekus maakond helendab kergelt;
- valitud ala on selgelt, aga mitte agressiivselt märgitud;
- detailpaneel on card-põhine;
- kasuta selgeid staatusmärke:
  - roheline: andmed klapivad;
  - kollane: info on puudulik või ebaselge;
  - punane: vastuolu või selgitamist vajav muutus;
  - sinine: kaitse/piirangu kontekst.

---

## 7. Kaardi nõuded

### 7.1 Ära kasuta Google Mapsi
Ära kasuta Google Mapsi, sest:
- visuaalne müra on suur;
- võtmed ja arveldus võivad segada;
- toode peab tunduma Keskkonnaagentuuri andmetoote, mitte üldise navigeerimiskaardina.

### 7.2 Soovitatud teek
Kasuta:

- **MapLibre GL JS** kaardi renderdamiseks;
- kohalikku või mock **GeoJSON**-i Eesti maakondade jaoks;
- kohalikku või mock **GeoJSON**-i näidiskatastriüksuste / metsaalade jaoks;
- vajadusel hiljem Maa- ja Ruumiameti WMS/WMTS teenuseid taustaks, aga mitte MVP põhivaates.

### 7.3 Kaardikihid MVP-s
MVP-s kuva:
- Eesti piir;
- maakonnad;
- valitud näidisalad;
- metsamuutuse polügoonid;
- metsateatise polügoonid / seotud alad;
- kaitseala kattuvus;
- valitud ala highlight.

Ära kuva vaikimisi:
- maanteid;
- poode;
- kohvikuid;
- juhuslikke kohanimesid;
- liiga detailset topograafiat.

---

## 8. Andmed: mida näitame ja kust need tulevad

### 8.1 MVP põhimõte
MVP peab töötama ka ilma ametlike API võtmete ja pärisandmete otseühenduseta.

Seega loo kaks kihti:

1. **Mock data layer** – töötab kohe.
2. **Adapter layer** – hiljem vahetatav pärisandmete vastu.

Koodis ei tohi äri- ja analüüsiloogika sõltuda sellest, kas andmed tulevad mock-failist või päris API-st.

### 8.2 Andmeallikate tabel

| Andmekategooria | Mida näitame | Päris allikas | MVP allikas |
|---|---|---|---|
| Katastriüksus | piir, katastritunnus, pindala, asukoht | Maakataster / katastri avaandmed | mock `parcels.geojson` |
| Maakonnad | Eesti maakonnad ja piirid | Maa- ja Ruumiamet / halduspiirid | mock `counties.geojson` |
| Metsaeraldised | registri metsaosad, puuliik, inventuuri aasta | Metsaregister | mock `forest_stands.geojson` |
| Metsateatised | ametlik teade raie/kahjustuse kohta | Metsaregister | mock `forest_notices.geojson` |
| Arhiveeritud teatised | vanemad teatised | Metsaregister | mock field `status: archived` |
| Metsamuutused | kaugseirega nähtud taimkatte/kõrguse muutus | Maa- ja Ruumiameti metsamuutuste andmed | mock `forest_changes.geojson` |
| Kaitsealad / piirangud | looduskaitse ja piirangute kattuvus | Keskkonnaportaal / EELIS / GeoServer | mock `protected_areas.geojson` |
| Satelliit | enne/pärast signaal, NDVI/NBR tulevikus | ESTHub / Sentinel | optional mock `satellite_signals.json` |

### 8.3 Pärisandmete plaan
Rakenda `DataProvider` liides.

```ts
interface DataProvider {
  searchAreas(query: string): Promise<SearchResult[]>;
  getAreaGeometry(areaId: string): Promise<GeoJSON.Feature>;
  getForestStands(areaGeometry: GeoJSON.Geometry): Promise<ForestStand[]>;
  getForestNotices(areaGeometry: GeoJSON.Geometry): Promise<ForestNotice[]>;
  getForestChanges(areaGeometry: GeoJSON.Geometry): Promise<ForestChange[]>;
  getProtectedAreas(areaGeometry: GeoJSON.Geometry): Promise<ProtectedArea[]>;
}
```

Alusta `MockDataProvider`-iga.

Hiljem lisa:
- `KatasterProvider`
- `MetsaregisterProvider`
- `MaaRuumiametProvider`
- `KeskkonnaportaalProvider`

---

## 9. Andmemudel

### 9.1 Area
```ts
type Area = {
  id: string;
  name: string;
  type: "parcel" | "county" | "custom";
  cadastralId?: string;
  county?: string;
  municipality?: string;
  areaHa: number;
  geometry: GeoJSON.Geometry;
};
```

### 9.2 ForestStand
```ts
type ForestStand = {
  id: string;
  areaId: string;
  mainSpecies?: string;
  developmentClass?: string;
  siteType?: string;
  inventoryYear?: number;
  areaHa: number;
  geometry: GeoJSON.Geometry;
};
```

### 9.3 ForestNotice
```ts
type ForestNotice = {
  id: string;
  areaId: string;
  type: "clearcut" | "thinning" | "sanitary" | "damage" | "unknown";
  status: "active" | "archived" | "unknown";
  submittedYear?: number;
  validUntilYear?: number;
  areaHa?: number;
  geometry?: GeoJSON.Geometry;
};
```

### 9.4 ForestChange
```ts
type ForestChange = {
  id: string;
  areaId: string;
  source: "lidar" | "satellite" | "manual" | "unknown";
  changeType: "height_decrease" | "vegetation_loss" | "possible_damage" | "unknown";
  detectedFromYear?: number;
  detectedToYear?: number;
  areaHa: number;
  confidence?: number;
  geometry: GeoJSON.Geometry;
};
```

### 9.5 ProtectedArea
```ts
type ProtectedArea = {
  id: string;
  name: string;
  type: "protected_area" | "natura" | "habitat" | "restriction" | "sensitive_hidden";
  publicDetailLevel: "full" | "generalized" | "hidden";
  overlapHa: number;
  geometry?: GeoJSON.Geometry;
};
```

### 9.6 AnalysisResult
```ts
type AnalysisResult = {
  area: Area;
  status:
    | "documented_harvest"
    | "unexplained_change"
    | "planned_activity"
    | "outdated_data"
    | "protected_context"
    | "no_major_change"
    | "insufficient_data";
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
```

---

## 10. Analüüsimootor

Analüüsimootor peab olema deterministlik ja testitav.

Failisoovitus:

```txt
src/lib/analysis/analyzeArea.ts
src/lib/analysis/rules.ts
src/lib/analysis/confidence.ts
src/lib/analysis/summaryTemplates.ts
```

### 10.1 Põhireegel
AI ei otsusta, mis juhtus. Reeglid otsustavad.

Põhimõte:

> Reeglid teevad järelduse. AI või mallid kirjutavad selle inimkeelde.

### 10.2 Reeglid

#### Reegel A: kaugseire muutus + metsateatis
Kui:
- `ForestChange` olemas;
- `ForestNotice` olemas;
- nende ruumiline kattuvus on piisav või mock-data `areaId` kattub;

siis:
- status = `documented_harvest`
- järeldus = "tõenäoliselt dokumenteeritud raie või muu ametlikult teada olev metsamuutus"
- confidence +25

#### Reegel B: kaugseire muutus, aga metsateatist ei ole
Kui:
- `ForestChange` olemas;
- `ForestNotice` puudub;

siis:
- status = `unexplained_change`
- järeldus = "selgitamist vajav metsamuutus"
- hoiatus: "See ei tähenda automaatselt rikkumist."
- confidence keskmine, mitte kõrge

#### Reegel C: metsateatis olemas, aga muutust pole
Kui:
- `ForestNotice` olemas;
- `ForestChange` puudub;

siis:
- status = `planned_activity`
- järeldus = "registris on teatis, kuid kaugseire ei näita veel selget muutust"
- võimalik selgitus: tegevus võib olla planeeritud, hiljutine või kaugseirega mitte tuvastatav

#### Reegel D: inventuuriandmed vanad
Kui:
- `inventoryYear` on rohkem kui 10 aastat vana;

siis:
- lisa `missingInfo`: "Metsainventuuri andmed võivad olla aegunud."
- confidence -15

#### Reegel E: kaitseala kattuvus
Kui:
- `ProtectedArea` kattub valitud alaga;

siis:
- lisa evidence või warning:
  - "Ala kattub kaitse- või piirangualaga."
- ära anna juriidilist otsust
- ära näita tundlikke detaile, kui `publicDetailLevel` on `hidden`

#### Reegel F: kõik klapib
Kui:
- registriandmed olemas;
- kaugseire ei näita suurt muutust;
- teatisi pole;
- andmed pole aegunud;

siis:
- status = `no_major_change`
- järeldus = "andmete põhjal ei paista hiljutist suurt metsamuutust"

### 10.3 Usaldusskoor
Lihtne MVP valem:

```txt
start = 50

+20 kui registriandmed olemas
+20 kui kaugseire ja teatis klapivad
+10 kui inventuur <= 10 aastat vana
+10 kui kaitsepiirangute info on kontrollitud
+10 kui satelliidi mock-signaal toetab lidar-muutust

-20 kui kaugseire näitab muutust, aga selgitavat registrisündmust ei ole
-15 kui inventuur > 10 aastat vana
-10 kui kaitse/piiranguinfo on varjatud või puudulik
-10 kui allikates on vastuolu

clamp 0..100
```

UI-s ära nimeta seda ametlikuks hinnanguks. Kasuta teksti:

> "See on Metsapeegli arvutuslik usaldusskoor, mitte ametlik otsus."

---

## 11. Inimkeelne kokkuvõte

### 11.1 Vaikimisi: mallid
Rakendus peab töötama ilma OpenAI API võtmeta.

Kui `OPENAI_API_KEY` puudub:
- kasuta programmeeritud malltekste;
- ära näita errorit;
- ära vaja serveripoolset AI teenust.

Näide mallist:

```ts
if (status === "documented_harvest") {
  return `Sellel alal on tõenäoliselt toimunud dokumenteeritud raie või muu ametlikult teada olev metsamuutus. Kaugseire näitab metsakõrguse või taimkatte olulist vähenemist ning sama ala kohta on olemas metsateatis. See ei tähenda automaatselt midagi kahtlast.`;
}
```

### 11.2 Optional: OpenAI kokkuvõte
Kui `OPENAI_API_KEY` on olemas, võib teha serveripoolse endpoint'i:

```txt
POST /api/generate-summary
```

Sisendiks anna ainult struktureeritud faktid:

```json
{
  "status": "documented_harvest",
  "confidenceScore": 82,
  "facts": [
    "Kaugseire näitab taimkatte kõrguse vähenemist.",
    "Sama alaga kattub metsateatis.",
    "Kaitseala kattuvust ei leitud.",
    "Inventuuriandmed on 8 aastat vanad."
  ],
  "missingInfo": [
    "Metsauuenduse värske info puudub."
  ]
}
```

### 11.3 AI prompt
Kui kasutad OpenAI API-t, kasuta seda system prompt'i:

```txt
You are a cautious Estonian public-sector data explainer.
Write in Estonian.
Explain forestry data to a non-expert user.
Use only the provided facts.
Do not invent facts.
Do not accuse anyone of illegal activity.
Do not give legal advice.
Always mention uncertainty when the evidence is incomplete.
Prefer simple wording.
Keep the summary under 120 words.
```

User prompt:

```txt
Kirjuta kasutajale lihtne kokkuvõte nende faktide põhjal:

{{facts_json}}
```

### 11.4 AI piirangud
AI ei tohi:
- otsustada, kas raie oli ebaseaduslik;
- välja mõelda puuduvat infot;
- kuvada tundlikke liigiandmeid;
- anda juriidilist nõu;
- väita kindlalt midagi, mida andmed ei tõenda.

---

## 12. Tehnoloogiline soovitus

### 12.1 Stack
Soovitatud:
- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **MapLibre GL JS**
- **Turf.js** ruumiliste kattuvuste arvutamiseks
- **Zod** andmete valideerimiseks
- **Vitest** analüüsireeglite testimiseks

### 12.2 Miks
- Next.js sobib kiireks prototüübiks;
- TypeScript aitab andmemudelid selgelt hoida;
- Tailwindiga saab kiirelt modernse UI;
- MapLibre ei vaja Google Mapsi;
- Turf.js sobib polügoonide kattuvuseks;
- analüüsimootor peab olema testitav.

### 12.3 Failistruktuur
```txt
/
  README.md
  spec-sheet.md
  package.json
  src/
    app/
      page.tsx
      api/
        search/route.ts
        analyze/[areaId]/route.ts
        generate-summary/route.ts
    components/
      MapView.tsx
      SearchBar.tsx
      AnalysisPanel.tsx
      ConfidenceScore.tsx
      Timeline.tsx
      EvidenceList.tsx
      SourceBadges.tsx
      StatusBadge.tsx
    data/
      mock/
        counties.geojson
        parcels.geojson
        forest_stands.geojson
        forest_notices.geojson
        forest_changes.geojson
        protected_areas.geojson
        satellite_signals.json
    lib/
      analysis/
        analyzeArea.ts
        rules.ts
        confidence.ts
        summaryTemplates.ts
      data/
        DataProvider.ts
        MockDataProvider.ts
      geo/
        overlap.ts
        centroid.ts
      types/
        forestry.ts
    styles/
      globals.css
  tests/
    analyzeArea.test.ts
```

---

## 13. Mock demo stsenaariumid

Loo vähemalt 4 näidisala.

### 13.1 Näidis 1: dokumenteeritud raie
Otsingus nimi:

> "Näidis: dokumenteeritud raie"

Andmed:
- metsaeraldis olemas;
- metsateatis olemas;
- kaugseire muutus olemas;
- kaitseala kattuvust pole;
- inventuur 8 aastat vana.

Tulemus:
- status `documented_harvest`
- confidence 80–90
- kokkuvõte ütleb, et muutus paistab ametlikult teada olevat.

### 13.2 Näidis 2: selgitamata muutus
Otsingus nimi:

> "Näidis: selgitamist vajav muutus"

Andmed:
- kaugseire muutus olemas;
- metsateatist ei ole;
- inventuur 12 aastat vana.

Tulemus:
- status `unexplained_change`
- confidence 40–60
- tekst rõhutab, et see ei tähenda automaatselt rikkumist, vaid vajab selgitamist.

### 13.3 Näidis 3: teatis olemas, muutust veel pole
Otsingus nimi:

> "Näidis: planeeritud tegevus"

Andmed:
- metsateatis olemas;
- kaugseire muutust pole;
- inventuur värske.

Tulemus:
- status `planned_activity`
- confidence 65–75
- tekst ütleb, et registris on tegevus, aga kaugseire ei kinnita veel muutust.

### 13.4 Näidis 4: kaitsekontekst
Otsingus nimi:

> "Näidis: kaitseala kattuvus"

Andmed:
- valitud ala kattub kaitseala mock-polügooniga;
- kaugseire muutus võib olla väike või puududa.

Tulemus:
- status `protected_context`
- tekst ütleb, et ala kattub kaitse- või piirangualaga;
- UI ei anna juriidilist hinnangut.

---

## 14. Kasutajateekond

### 14.1 Esimene vaade
Kasutaja avab lehe.

Ta näeb:
- ilus roheline Eesti kaart;
- maakonnapiirid;
- top search bar;
- väike tekst:
  > "Otsi metsaala ja vaata, mida eri andmeallikad selle kohta koos näitavad."

### 14.2 Otsib ala
Kasutaja kirjutab:

> "Näidis: dokumenteeritud raie"

Autocomplete näitab sobivat tulemust.

### 14.3 Valib ala
Kaart zoomib alale.

Detailpaneel avaneb:

```txt
Sellel alal on tõenäoliselt toimunud dokumenteeritud raie.

Kaugseire näitab metsakõrguse olulist vähenemist. Sama ala kohta on olemas metsateatis. See tähendab, et muutus oli tõenäoliselt riigile teada. See ei tähenda automaatselt midagi kahtlast.

Usaldus: 84/100

Puuduv info:
- Uuendamise kohta ei ole veel värsket infot.
```

### 14.4 Vaadatakse tõendeid
Kasutaja näeb:
- kaugseire muutuse polügoon;
- metsateatise polügoon;
- metsaeraldise info;
- allikate list;
- ajajoon.

---

## 15. API endpoint'id

### 15.1 Search
```txt
GET /api/search?q=<query>
```

Tagastab:

```ts
type SearchResult = {
  id: string;
  label: string;
  type: "parcel" | "county" | "demo";
  subtitle?: string;
  center: [number, number];
};
```

### 15.2 Analyze
```txt
GET /api/analyze/:areaId
```

Tagastab `AnalysisResult`.

### 15.3 Optional AI summary
```txt
POST /api/generate-summary
```

Kui API key puudub, tagasta templated summary ja `mode: "template"`.

---

## 16. Olulised ohutus- ja usaldusnõuded

### 16.1 Ära süüdista
Ära kasuta sõnu:
- "ebaseaduslik";
- "rikkumine";
- "varjatud";
- "kuritegu";

välja arvatud juhul, kui ametlik allikas seda selgelt ütleb.

Kasuta:
- "selgitamist vajav";
- "andmete põhjal ebaselge";
- "täiendavat kontrolli vajav";
- "ei tähenda automaatselt rikkumist".

### 16.2 Ära näita tundlikke detaile
Kui andmekihis on `publicDetailLevel: "hidden"`:
- ära kuva täpset geomeetriat;
- kuva üldine teade:
  > "Alal võib olla looduskaitseline tundlikkus. Detailset infot ei kuvata avalikus vaates."

### 16.3 Selgita usaldust
Iga kokkuvõtte juures peab olema:
- allikate list;
- "see ei ole ametlik otsus" märkus;
- puuduv info.

---

## 17. Acceptance criteria

### 17.1 UI
- Avalehel avaneb Eesti kaart.
- Maakonnad on eraldatud.
- Otsing on üleval ja modernne.
- Värvipalett on roheline.
- Kaart ei näe välja nagu Google Maps.
- Detailpaneel avaneb ala valimisel.
- Mobiilivaade on vähemalt kasutatav.

### 17.2 Andmed
- Mock data töötab ilma väliste võtmeteta.
- Search leiab vähemalt 4 demoala.
- Analyze endpoint tagastab `AnalysisResult`.
- Detailpaneel näitab:
  - järeldust;
  - usaldusskoori;
  - tõendeid;
  - puuduolevat infot;
  - ajajoont;
  - allikaid.

### 17.3 Analüüs
- Reeglid eristavad vähemalt:
  - documented_harvest;
  - unexplained_change;
  - planned_activity;
  - protected_context;
  - no_major_change / insufficient_data.
- Usaldusskoor muutub vastavalt andmetele.
- Testid katavad põhireegleid.

### 17.4 AI
- Rakendus töötab ilma OpenAI API key'ta.
- Kui `OPENAI_API_KEY` puudub, kasutatakse malltekste.
- Kui key olemas, võib kasutada AI-d ainult sõnastamiseks, mitte faktide loomiseks.

---

## 18. Esimene arendusetapp Codexile

Tee kõigepealt töötav MVP, mitte täiuslik GIS-süsteem.

### Step 1
Scaffold Next.js + TypeScript + Tailwind app.

### Step 2
Lisa MapLibre kaart, mis kuvab kohalikku `counties.geojson` faili.

### Step 3
Lisa roheline modernne UI:
- full-screen map;
- top search bar;
- right-side analysis panel.

### Step 4
Lisa mock data:
- counties;
- parcels;
- forest notices;
- forest changes;
- protected areas.

### Step 5
Tee `MockDataProvider`.

### Step 6
Tee `analyzeArea(areaId)` funktsioon.

### Step 7
Tee search ja analyze API endpoint'id.

### Step 8
Ühenda UI API-dega.

### Step 9
Lisa 4 demo stsenaariumi.

### Step 10
Lisa tests for analysis rules.

---

## 19. Esimene prompt Codexile

Kopeeri see Codexi esimese tööjuhisena:

```txt
Build the Metsapeegel MVP according to spec-sheet.md.

Important:
- This is not a generic map app. It is a forestry data interpretation tool.
- The app must work without external API keys.
- Do not use Google Maps.
- Use Next.js, TypeScript, Tailwind and MapLibre GL JS.
- Use mock GeoJSON data first.
- Show Estonia with county borders on a clean green map.
- Add a top search bar and a side analysis panel.
- Implement deterministic analysis rules before any AI summary.
- If OPENAI_API_KEY is missing, use template summaries.
- The UI language must be Estonian.
- Avoid legal accusations. Say "selgitamist vajav muutus", not "illegal logging".
- Produce clean, maintainable code with typed data models and tests.
```

---

## 20. Demo pitch tekst

Kui prototüüp on valmis, pitch'i nii:

> "Metsapeegel ei ole järjekordne metsakaart. See on tõlgendusvahend. Kasutaja valib metsaala ja süsteem ütleb lihtsas keeles, mis seal andmete põhjal toimus, millele see järeldus tugineb ja kui usaldusväärsed andmed on. Nii muutuvad metsaregistri, kaugseire ja kaitsekihtide tehnilised andmed kasutatavaks nii kodanikule, ajakirjanikule kui ka Keskkonnaagentuuri analüütikule."

---

## 21. Pärisandmete allikate märkmed

Pärisandmete integratsioon ei pea MVP-s valmis olema, kuid kood peab selleks valmis olema.

Võimalikud allikad:
- Maakataster: katastriüksuste piirid ja andmed.
- Maa- ja Ruumiamet: halduspiirid, aluskaardid, ortofotod, WMS/WFS/WCS teenused.
- Metsaregister / Metsaportaal: metsaeraldised, metsateatised, arhiveeritud metsateatised, ekspertiisid.
- Maa- ja Ruumiamet / metsamuutused: lidar-põhised metsamuutuste kihid.
- Keskkonnaportaal / EELIS GeoServer: kaitsealad, Natura, piirangud ja avalikud keskkonnakihid.
- ESTHub / Sentinel: valikuline värskem satelliidisignaal.

Rakenda need hiljem provider'itena, mitte UI-sse kõvasti sisse kodeeritult.
