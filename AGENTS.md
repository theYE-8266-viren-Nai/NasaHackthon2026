# Flame in Freefall: agent and team rules

## Challenge objective

Build an interactive, AI-assisted dashboard that summarizes, ranks, and
interprets NASA microgravity combustion findings for fire-safety insight in
human space exploration.

The dashboard must distinguish measured evidence from interpretation. Numeric
sorting and ranking should be deterministic and explainable. AI should explain
selected findings, answer questions using retrieved NASA documents, and cite
the source experiment or document.

## Recommended architecture

- Dashboard: Next.js + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Charts: Recharts
- Data preparation: Node.js/TypeScript with curated JSON or CSV
- Curated data: versioned JSON or CSV in the repository
- AI summaries: server-side LLM request with retrieval or selected source
  context
- Deployment: Vercel

Do not add a separate database or FastAPI service for the hackathon MVP unless
the team explicitly agrees. The Node.js backend in `backend/server.mjs` keeps
the analysis contract local and easy to integrate with Next.js.

## Two-person workload split

### Agent A: data and analysis owner

- Curate the initial NASA experiment subset.
- Maintain the Node.js/TypeScript preparation and analysis code.
- Normalize experiment IDs, units, missing values, and source links.
- Produce `experiments.json` and any chart-ready time-series files.
- Maintain the flame-feature extraction and deterministic review-priority logic.
- Define the API/data contract for the dashboard.
- Verify every insight against source metadata.

### Agent B: product and dashboard owner

- Create the Next.js + TypeScript application.
- Build the dashboard layout, experiment selector, comparison view, charts,
  ranking cards, and source-reference panel.
- Implement server-side API routes for AI summaries and retrieval.
- Keep API keys out of browser code.
- Add loading, empty, error, and citation states.
- Test the app with the prepared JSON and the real BASS-II videos.
- Prepare the final demo flow and deployment.

### Shared responsibilities

- Agree on the data contract before parallel implementation.
- Review one another's work at the halfway point and before the demo.
- Prefer a small working subset over an incomplete all-NASA catalog.
- Do not present prototype review priority as a validated hazard probability.

## Branching rule

- Agent A works from `agenta` and creates feature branches as
  `agenta/<feature>`.
- Agent B works from `agentb` and creates feature branches as
  `agentb/<feature>`.
- Do not commit feature work directly to `main`.
- Pull or rebase from the relevant agent base branch before opening a merge.

## Data contract

Each experiment should have a stable ID and source provenance:

```ts
type Experiment = {
  experimentId: string;
  testId: string;
  sampleId: string;
  investigation: string;
  fuelMaterial?: string;
  gravityCondition?: string;
  initialOxygenPct?: number;
  finalOxygenPct?: number;
  airflow?: string;
  videoPath?: string;
  sourceUrl: string;
  sourceDoi?: string;
  measurements?: Array<{
    timeS: number;
    flameArea?: number;
    spreadRate?: number;
    state?: "growing" | "stable" | "shrinking" | "extinguished" | "undetected";
  }>;
};
```

## AI and safety rules

- Use code for calculations, filtering, sorting, and ranking.
- Use AI for summarization, question answering, comparison, and explanation.
- Ground AI responses in selected NASA records or documents.
- Show source links near every substantive insight.
- Mark missing data and uncertainty explicitly.
- Never claim that the prototype certifies a material or replaces spacecraft
  fire-safety analysis.
- Avoid unsupported causal claims. Say “the data shows” or “the prototype
  flags for review” where appropriate.

## Five-hour execution order

1. Hour 1: freeze the experiment subset, data contract, and demo story.
2. Hour 2: finish the curated JSON and deterministic analysis outputs.
3. Hour 3: integrate the dashboard, charts, and ranking view.
4. Hour 4: add grounded AI explanations and source references.
5. Hour 5: test the full demo, fix visible failures, and prepare the pitch.

## Definition of done

The demo is complete when a user can select an experiment, inspect its source
metadata, view a flame trend, compare or rank selected findings, ask for an
evidence-grounded explanation, and see the source and limitations for each
result.
