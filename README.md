# Flame in Freefall

Flame in Freefall is a prototype dashboard for finding, comparing, and
understanding NASA microgravity fire experiments. It is designed to turn
scattered combustion observations into traceable research-review insights for
human space exploration.

## MVP scope

- Search and filter a curated experiment catalog.
- Open an experiment detail view with NASA source links.
- Compare only measurements that are actually available.
- Show missing measurements explicitly instead of filling them with estimates.
- Calculate an explainable prototype comparison score.
- Generate evidence-grounded summaries and decision-support guidance.

The comparison score is not an official NASA safety rating. It prioritizes
experiments for review and shows the measurements that contributed to the
result. AI explanations must identify incomplete evidence and cite the NASA
records or documents they use.

## Project structure

```text
.
├── AGENTS.md                 # Team rules, architecture, and workload split
├── FRONTEND_PROMPT.md        # Dashboard-generation specification
├── README.md                 # Project overview and development guide
├── catalog/
│   └── experiments.json      # Small, source-traceable demo catalog
├── scripts/
│   └── prepare-experiments.mjs # Build dashboard data from the catalog
├── fixtures/
│   └── rank-missing-measurements.json # Missing-data ranking request example
├── backend/
│   ├── server.mjs            # Local Node.js flame-frame analysis and ranking API
│   └── README.md             # Backend endpoints and request format
├── data/                     # Local NASA CSV files; ignored by Git
├── videos/                   # Local NASA MP4 files; ignored by Git
└── dashboard/
    ├── data/experiments.json # Generated dashboard view of the catalog
    └── app/                  # Next.js dashboard
```

The `data/` and `videos/` directories intentionally remain on the developer
machine and are excluded from the repository because the research media makes
the push unnecessarily large. Use NASA's Physical Sciences Informatics
repository to restore them:

- [Saffire-I / PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98)
- [BASS-II / PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)

The tracked catalog contains BASS-II tests B1_147 and B3_148 transcribed from
NASA/TM-20210011385, Appendix A, Table A.1. It is the fallback for
GET /api/experiments when the local PSI-25 CSV is not present. If the CSV is
available, the backend returns its rows plus any catalog records not in the
CSV. The catalog includes Saffire-I tests I-1 and I-2 with NASA-reported
aggregate flame spread rates and burn durations. No frame-derived flame time
series is included until source frames are available for analysis.

Run `npm run prepare:data` to generate the dashboard's normalized JSON view.
Aggregate metrics remain separate from time-series samples.

## Backend prototype

The local backend uses Node.js and accepts sampled JPEG frames from the browser.
This avoids requiring FFmpeg for the demo.

```powershell
npm install
npm run backend
```

Available endpoints:

- `GET /api/health`
- `GET /api/experiments`
- `POST /api/analyze-frames`
- `POST /api/rank`

## Frontend direction

The target dashboard is a Next.js + TypeScript app using Ant Design, Recharts,
server-side AI routes, and curated JSON data. The frontend should keep API
keys on the server and show NASA source links beside every substantive
finding.

## Demo narrative

1. Select a NASA experiment.
2. Inspect material, atmosphere, flow, and available measurements.
3. Compare selected experiments using evidence-only charts.
4. Review the transparent prototype comparison score.
5. Ask for a grounded explanation and follow the source links.
