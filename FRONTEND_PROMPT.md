# Frontend generation prompt

Build a polished Next.js + TypeScript dashboard for the Flame in Freefall
prototype. Use Ant Design components and Recharts.
Keep AI calls in server-side Next.js route handlers so API keys never reach the
browser. Deployability on Vercel is a requirement.

Purpose: analyze BASS-II microgravity flame videos by combining video frames
with NASA experiment metadata.

Data and analysis contract:

- Load curated experiment data from `/data/experiments.json` or an equivalent
  typed data module.
- Expose equivalent Next.js routes such as `/api/experiments`,
  `/api/analyze`, `/api/rank`, and `/api/ask`.
- The existing local Node.js analysis prototype may be called during
  development, but the final dashboard must have a clear server-side route
  boundary and must not depend on browser-side secrets.

The POST body is:

```json
{
  "experiment_id": "B1_147",
  "frames": [
    {"timestamp_s": 0.0, "image": "data:image/jpeg;base64,..."}
  ]
}
```

Build these UI sections:

1. Header: “Flame in Freefall” and subtitle “AI-assisted microgravity flame analysis”.
2. Experiment selector populated from `/api/experiments`. Show B1_147 and B3_148 first.
3. Video picker for local MP4 files. Do not upload the full video to the backend.
4. Video preview with a canvas overlay showing the detected flame bounding box.
5. “Analyze” button. Use an HTML video element and canvas to sample at most 60
   frames across the video. Convert each sampled canvas frame to JPEG using
   `canvas.toDataURL("image/jpeg", 0.7)`, then POST the frames to the backend.
6. Metadata cards: fuel material, initial oxygen, final oxygen, airflow/fan
   settings, test ID, sample ID, and number of frames.
7. Results cards: flame state, confidence, peak flame-area fraction, and area
   slope per second.
8. Chart: plot `frames[].timestamp_s` against `frames[].area_fraction`.
9. Frame timeline: show each frame as growing, stable, shrinking, or undetected.
10. Insight panel showing `analysis.summary` and a clearly visible label:
    “Prototype result — not a validated fire-safety prediction.”
11. Portfolio view titled “NASA finding review queue”. After analyzing B1 and
    B3, send the two complete responses as:
    `{ "results": [{ "experiment_id": "B1_147", "experiment": ..., "analysis": ... }] }`
    to `/api/rank`. Display the ranked cards, score, reasons, and the server
    warning. Call the score “review priority”, never “risk probability”.
12. Summary cards: experiments reviewed, highest-priority experiment, and
    a short explanation of the ranking method.
13. Error and loading states. If the backend is unavailable, show:
    “Start the analysis backend at http://localhost:8000.”

Visual style:

- Dark navy background, warm orange flame accent, white cards.
- Scientific dashboard appearance, clear typography, accessible contrast.
- Responsive layout for laptop presentation.
- Avoid fake values. Every displayed result must come from the API response.

Important behavior:

- Keep the selected experiment metadata separate from the uploaded video.
- Match B1_147 to the B1/sample 147 video and B3_148 to B3/sample 148.
- Limit the request to 60–120 sampled frames so the prototype remains fast.
- Display the analysis method and limitations returned by the API.
- The dashboard’s story is: summarize the evidence, rank what deserves expert
  attention, and interpret why. Do not claim that the prototype certifies a
  material, predicts all spacecraft fires, or replaces NASA safety analysis.
- Include NASA source URLs or DOI references beside each finding and in the
  AI answer panel.
