# Flame analysis Node.js backend

## Run

```powershell
npm install
npm run backend
```

Endpoints:

- `GET /api/health`
- `GET /api/experiments`
- `POST /api/analyze-frames`
- `POST /api/rank`

The frontend should decode the MP4 in the browser, sample frames to JPEG, and
send them to `/api/analyze-frames` as JSON. This avoids requiring FFmpeg or
native image binaries on the demo machine. Node.js uses the pure-JavaScript
`jpeg-js` decoder for sampled JPEG frames.

`GET /api/experiments` reads the tracked `catalog/experiments.json` demo records.
If the local ignored PSI-25 experimental table exists at
`data/PSI-25_Experimental table_BASS-II.csv`, it returns the full table and
enriches matching demo records with source notes. CSV-only records link to the
NASA PSI-25 investigation page. Numeric flame measurements are populated only
by `/api/analyze-frames`; the curated catalog does not invent time-series data.

Example request shape:

```json
{
  "experiment_id": "B1_147",
  "frames": [
    {"timestamp_s": 0, "image": "data:image/jpeg;base64,..."}
  ]
}
```

`/api/rank` accepts a list of completed analysis results and returns an
explainable research-review ranking. The response lists each component, its
weight, evidence value, contribution, and evidence coverage. Missing inputs
are omitted and the weights are renormalized across available components.
Area thresholds are prototype settings, so this is intentionally not a
certified spacecraft hazard score.
