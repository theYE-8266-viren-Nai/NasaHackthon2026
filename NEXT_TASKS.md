# Next tasks after main sync

The original integration checklist is complete on the Agent B branch. The
items below document what was delivered and the optional next iteration.

## Agent A — data and analysis

1. [x] Review catalog/experiments.json against the NASA source documents and
   correct any field, unit, or provenance issues.
2. [x] Add a small Saffire-I record set from PSI-98 with only measurements NASA
   actually provides. Keep unavailable values as null.
3. [x] Connect the Node.js frame-analysis endpoint to the catalog experiment IDs.
4. [x] Return normalized analysis fields for flame area, trend, confidence, and
   limitations.
5. [x] Add one deterministic API fixture covering an experiment with missing
   measurements.

## Agent B — dashboard and product

1. [x] Finish the API-backed dashboard flow using /api/experiments.
2. [x] Replace the client-side comparison calculation with /api/rank and show
   the returned evidence components and warning.
3. [x] Add a comparison detail drawer with source URL, provenance, conditions, and
   missing-measurement labels.
4. [x] Add video selection and sampled-frame submission to /api/analyze.
5. [x] Add a server-side /api/ask route for grounded AI summaries with source
   links and an explicit incomplete-evidence response.
6. [x] Run npm run build, then prepare the demo flow and deployment settings.

## Integration contract

- Agent A owns catalog semantics, analysis fields, and scientific provenance.
- Agent B owns UI state, API consumption, citations, and presentation.
- Use agentb/<feature> and agenta/<feature> branches.
- Do not calculate a certified safety rating. Call it a prototype comparison
  score or research-review priority.
