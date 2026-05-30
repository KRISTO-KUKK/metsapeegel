# Metsapeegel

Metsapeegel is a hackathon MVP for checking forestry claims against Estonian public official services. It does not ship fabricated forestry facts or fabricated analysis layers.

The app works without external API keys. Rules make the conclusion; the AI layer is isolated as wording support for grounded answers.

## Data

- County boundaries: Administrative and settlement units, Estonian Land and Spatial Development Board 01.05.2026, simplified for web display.
- Selectable forest areas: public Maa- ja Ruumiamet ETAK `e_305_puittaimestik_a` WFS features where `tyyp_tekst = Mets`.
- Map click lookup: clicking the map calls the public ETAK WFS around the clicked point and selects a real polygon only when that point is inside a `Mets` feature. County polygons are visual only.
- Cadastral context: public Maa- ja Ruumiamet cadastre WFS adds cadastral ID, address context, land use, forest area, and ownership form. Private owner names are not included.
- Registry context: public Metsaregister WFS layers provide forest stands and forest notices by cadastral ID.
- Protection context: public EELIS WFS layers provide protection, Natura, restriction, valuable habitat, and habitat overlaps.
- Map context: Maa- ja Ruumiamet WMS basemap, forest-cover layer, ETAK forest layer, county boundaries, and cadastral-boundary layer.
- Remote sensing: no fabricated remote-sensing layer is used. Until a real public change-detection source is connected, the app reports that this part is unavailable.

## AI Layer

- Default mode: deterministic template text, no external calls.
- OpenAI mode: set `OPENAI_API_KEY`; optional `OPENAI_MODEL`, default `gpt-4.1-mini`.
- Local model mode: set `AI_PROVIDER=ollama`, optional `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.
- AI never decides facts, legality, risk scores, or verdicts. It only rewrites the deterministic evidence package into clearer Estonian.
- Area Q&A is available at `/api/ask`; it takes the current area analysis plus a user question and returns a structured answer with verdict, evidence, limits, map hints, and sources.
- The data analyzer is available at `/audit`; it samples real ETAK forest areas and shows how the rules classify them.

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```
