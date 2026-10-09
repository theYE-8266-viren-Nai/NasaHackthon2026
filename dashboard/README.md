# Flame in Freefall dashboard

Next.js + TypeScript dashboard for exploring NASA microgravity combustion records. The dashboard API reads the versioned source catalog at `../catalog/experiments.json`. The responsive Recharts research view filters by investigation, fuel, outcome, test, and reported metric; it keeps investigations separate and links plotted source records. `GET /api/visualizations?investigation=FLEX` also provides a chart-ready FLEX payload for API consumers. Ranking and frame analysis are delegated to the Node service in `../backend/server.mjs`.

## Run locally

From the repository root, install the root and dashboard dependencies, then run the two services in separate terminals:

~~~sh
npm install
npm --prefix dashboard install
npm run backend
npm --prefix dashboard run dev
~~~

Open `http://localhost:3000`. The Node service listens on port 8000. Set `ANALYSIS_BACKEND_URL` when its base URL differs from `http://localhost:8000`.

## AI summaries

`POST /api/ask` only includes the selected catalog records as model context. Without a key, the route returns a source-linked summary directly from the curated fields and marks it as non-generated. To enable model-generated explanations, set these variables in the server environment:

~~~sh
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
~~~

The key is read only by the server route. Responses link the NASA source documents and label incomplete evidence; generated text is not an operational fire-safety procedure.

## Demo flow

1. In **Research Charts**, select FLEX / PSI-69, filter by fuel or outcome, and choose a metric. Expand the source lists to trace bars to NASA test IDs. Review the oxygen/burning-rate scatter and its PSI CSV versus NTRS unit note.
2. Search for `Saffire-I` and select I-1 and I-2.
3. Open **Details** on each record to show flow configuration, reported measurements, missing values, provenance, and NASA source links.
4. Review the backend-ranked comparison. Explain that the score is a prototype research-review priority with evidence coverage, not a safety rating.
5. Ask what differs between the selected runs. The answer uses those catalog records and links their NASA sources.
6. Select an experiment and upload a local BASS-II video to view its frame-derived flame-area trend. Large NASA videos are excluded from Git; this repository checkout contains no video files, so prepare a NASA BASS-II video locally before this demo step.

## Deployment

The dashboard can be deployed as a Next.js app with the dashboard directory as the application root and the repository catalog included in the build. `ANALYSIS_BACKEND_URL` must point to a reachable deployment of the Node service; `localhost` is suitable only when both services run on the same machine. Set `OPENAI_API_KEY` only in server environment settings if generated answers are desired. Never expose it through a `NEXT_PUBLIC_` variable. Keep large videos and raw NASA datasets outside Git and upload them locally for the demo.
