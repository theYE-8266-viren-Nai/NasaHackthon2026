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
- `GET /api/visualizations?investigation=FLEX`
- `POST /api/analyze-frames`
- `POST /api/rank`

## Frontend direction

The target dashboard is a Next.js + TypeScript app using Ant Design, Recharts,
server-side AI routes, and curated JSON data. The frontend should keep API
keys on the server and show NASA source links beside every substantive
finding.

## Next tasks: NASA data visualizations

Build the next dashboard iteration around source-traceable NASA combustion
measurements. Start with the existing BASS-II and Saffire-I records, and add
FLEX as the first quantitative dataset for cross-record visualizations where
the measurements are compatible.

NASA sources for this work:

- [FLEX / PSI-69 dataset](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69)
- [FLEX NTRS report 20150023456](https://ntrs.nasa.gov/citations/20150023456)
- [ACME mission](https://science.nasa.gov/mission/acme/)
- [Burning Rate Emulator (BRE)](https://science.nasa.gov/biological-physical/investigations/bre/)

The current PSI-69 table and the cited NTRS report describe different test
counts and may represent different data scopes or versions. Verify the source
scope before combining or comparing their records.

The curated FLEX subset follows the 274 rows in the downloadable PSI-69
Version 5 CSV (test numbers 1–274); NASA's report describes its first 284
tests. The current PSI table view reports 275 entries, so the differing scopes
are documented and kept separate. The CSV's burning-rate heading is `mm`,
while the NTRS report labels that metric `mm²/s`; the catalog preserves the
source value and flags the unit discrepancy. NASA's [BRE data access
page](https://gipoc.grc.nasa.gov/wp/fcf-cir/acme/burning-rate-emulator-bre-operations/)
requires authorized access, so BRE is linked as research context and has no
chartable records in this public subset.

### Agent 1 — Data and backend

- Curate public, source-verifiable FLEX records with stable experiment and
  test IDs, original units, explicit missing values, and NASA source links.
- Preserve the distinction between reported aggregate metrics and actual
  time-series measurements; provide normalized, chart-ready data through the
  existing Node.js backend/API contract.
- Verify whether public ACME BRE test data is available. If it cannot be
  verified from an accessible NASA source, include BRE as linked research
  context only; do not use restricted data or create measurements.
- Validate source metadata, units, and missing-value handling for the curated
  subset. Keep BASS-II, Saffire-I, and FLEX measurements separate where their
  definitions or units are incompatible.

### Agent 2 — Dashboard and charts

- Add interactive Recharts views with investigation and metric selection,
  useful filters, readable tooltips, and nearby NASA source references.
- Visualize FLEX outcome counts by fuel, oxygen versus reported burning rate
  when both values exist, and selectable summaries of reported metrics such as
  burning rate, burn time, and flame extinction diameter.
- Keep investigations separate when measurements are incompatible. Use line
  charts only for actual time-series data, and label frame-derived series as
  video analysis rather than NASA-reported measurements.
- Provide clear loading, empty, missing-data, and error states; make charts
  usable on mobile screens.

### Shared evidence and safety requirements

- Ground AI explanations in the selected NASA records or documents and show
  citations and limitations with each substantive result.
- Exclude missing values from calculations and identify them in the interface.
- Label prototype ranking as “review priority”; it is not a NASA-approved
  hazard rating or a substitute for spacecraft fire-safety analysis.

### Acceptance criteria

- Every plotted value can be traced to a NASA record with its ID, unit, and
  source.
- Incompatible datasets are not pooled, and reported aggregates are not
  presented as time-series samples.
- Charts clearly distinguish reported measurements from frame-derived data
  and explain when evidence is missing or unavailable.
- AI explanations cite the selected evidence and state when it is insufficient.

## Demo narrative

1. Select a NASA experiment.
2. Inspect material, atmosphere, flow, and available measurements.
3. Compare selected experiments using evidence-only charts.
4. Review the transparent prototype comparison score.
5. Ask for a grounded explanation and follow the source links.
