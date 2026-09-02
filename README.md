# MetsaTark

MetsaTark is a forestry data prototype built during a hackathon organised by Keskkonnaagentuur / the Estonian Environment Agency and Miltton. The application lets a user select a forest area on a map and ask questions about the public forestry data available for that area.

The goal is to make fragmented public data easier to understand. The app combines map selection, official geospatial layers, deterministic analysis rules and an optional AI wording layer. When the available data is incomplete, the interface is designed to say that clearly instead of inventing certainty.

[Screenshot: map view]
[Screenshot: selected forest area analysis]
[Screenshot: area question answering panel]

## Main Features

- Interactive map for selecting forest areas in Estonia.
- Public data lookups from Maa- ja Ruumiamet ETAK and cadastre services.
- Forestry context from Metsaregister layers where available.
- Protection and restriction context from EELIS and related public layers.
- Area analysis that separates confirmed evidence, likely interpretation and missing data.
- Question answering based on the selected area's data package.
- Optional OpenAI or local Ollama wording layer, with deterministic fallback output.
- `/audit` view for sampling real forest areas and checking rule-based classifications.
- `/api/health` endpoint for deployment health checks.

## Tech Stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- Tailwind CSS
- MapLibre GL
- Turf.js and GeoJSON data processing
- Vitest
- Docker-ready standalone Next.js build

## My Role

I worked as Team Lead and Lead Developer. I coordinated task distribution, helped make the technical decisions, and implemented roughly 75% of the final prototype. The project was built in a hackathon setting, so the focus was a working, explainable prototype rather than a production forestry information system.

## Running Locally

Requirements:

- Node.js 22.12 or newer
- npm

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000` by default.

Useful checks:

```bash
npm test
npm run build
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `AI_PROVIDER` | No | `openai`, `ollama` or empty for automatic selection. |
| `OPENAI_API_KEY` | No | Enables OpenAI-based wording and question answering. |
| `OPENAI_MODEL` | No | OpenAI model name. Defaults to `gpt-4.1-mini`. |
| `OLLAMA_BASE_URL` | No | Local Ollama server URL. Defaults to `http://localhost:11434` when Ollama is selected. |
| `OLLAMA_MODEL` | No | Ollama model name. Defaults to `llama3.1`. |
| `PORT` | No | Server port for production. Defaults to `3000`. |
| `METSATARK_BASE_PATH` | No | Optional base path for subfolder deployments. Leave empty for a normal domain or subdomain. |
| `NEXT_PUBLIC_METSATARK_BASE_PATH` | No | Public base path used by the client. Normally derived from `METSATARK_BASE_PATH`. |
| `METSAPEEGEL_LOG_FILE` | No | Optional server-side log file path. |

The project works without AI credentials. In that mode, it returns rule-based explanations from the connected data package.

## Deployment

The repository includes a `Dockerfile` for deployment on a Linux VPS through Coolify or a similar Docker-based host.

Recommended Coolify settings:

- Build pack: Dockerfile
- Dockerfile location: `/Dockerfile`
- Exposed port: `3000`
- Health check path: `/api/health`
- Set production environment variables in Coolify, not in the repository.

For a subdomain deployment, leave `METSATARK_BASE_PATH` and `NEXT_PUBLIC_METSATARK_BASE_PATH` empty. Use those only when the app is hosted under a subpath such as `/metsatark`.

Example production variables:

```bash
NODE_ENV=production
PORT=3000
OPENAI_MODEL=gpt-4.1-mini
```

Add `OPENAI_API_KEY` only if AI-assisted wording should be enabled in production.

## Data and Persistence

MetsaTark does not use a database. It queries public services and uses static county boundary data included in the repository. There is no application state that needs database persistence for deployment.

## Current Status

This is a polished hackathon prototype intended for portfolio review and further deployment experiments. It is not a legal, forestry management or official decision-making system. The app should be treated as an interface for exploring public data, with visible limitations when data is missing or uncertain.
