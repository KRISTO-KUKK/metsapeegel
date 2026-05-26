# Metsapeegel

Metsapeegel is a hackathon MVP for interpreting Estonian forestry data from public official services. It does not ship fabricated forestry facts or fabricated analysis layers.

The app works without external API keys. Rules make the conclusion; optional AI wording can be added later without changing the analysis engine.

## Data

- County boundaries: Administrative and settlement units, Estonian Land and Spatial Development Board 01.05.2026, simplified for web display.
- Selectable forest areas: public Maa- ja Ruumiamet ETAK `e_305_puittaimestik_a` WFS features where `tyyp_tekst = Mets`.
- Map click lookup: clicking the map calls the public ETAK WFS around the clicked point and selects a real polygon only when that point is inside a `Mets` feature. County polygons are visual only.
- Cadastral context: public Maa- ja Ruumiamet cadastre WFS adds cadastral ID, address context, land use, forest area, and ownership form. Private owner names are not included.
- Registry context: public Metsaregister REST endpoints provide forest stands and forest notices by cadastral ID.
- Protection context: public EELIS WFS layers provide protection, Natura, restriction, valuable habitat, and habitat overlaps.
- Map context: Maa- ja Ruumiamet WMS basemap, forest-cover layer, ETAK forest layer, county boundaries, and cadastral-boundary layer.
- Remote sensing: no fabricated remote-sensing layer is used. Until a real public change-detection source is connected, the app reports that this part is unavailable.

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```
