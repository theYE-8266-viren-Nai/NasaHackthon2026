import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function loadCatalog() {
  const file = path.join(process.cwd(), "..", "catalog", "experiments.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
}

function sourceFor(record: Record<string, unknown>) {
  return {
    title: record.source_title ?? record.experiment_id,
    url: record.source_url ?? record.investigation_url
  };
}

export async function POST(request: Request) {
  const body = await request.json() as { question?: string; experimentIds?: string[] };
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const selected = loadCatalog().filter((record) => !body.experimentIds?.length || body.experimentIds.includes(String(record.experiment_id)));
  const sources = selected.map(sourceFor).filter((source) => source.url);
  const context = selected.map((record) => JSON.stringify({
    experiment_id: record.experiment_id,
    material: record.fuel_material,
    condition: record.flow_configuration,
    observation: record.observation,
    oxygen: [record.initial_oxygen_pct, record.final_oxygen_pct],
    carbon_monoxide_ppm: [record.initial_co_ppm, record.final_co_ppm],
    provenance: record.data_provenance
  })).join("\n");

  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          { role: "system", content: "You are a cautious combustion research assistant. Answer only from the provided NASA-derived context. State when evidence is missing. Do not give certified spacecraft safety procedures. Keep the answer concise and include source identifiers." },
          { role: "user", content: "Question: " + question + "\nNASA-derived context:\n" + context }
        ]
      }),
      cache: "no-store"
    });
    if (response.ok) {
      const payload = await response.json() as { output_text?: string };
      return NextResponse.json({ answer: payload.output_text ?? "The model returned no text.", sources, grounded: true });
    }
  }

  const fallback = selected.length
    ? "Grounded prototype summary: " + selected.map((record) => String(record.observation ?? "This record has no narrative observation.")).join(" ") + " The available record does not establish a universal safety rule, and missing measurements should be collected before drawing a stronger conclusion."
    : "No matching NASA-derived records were selected. Try asking about a catalog experiment or include an experiment ID.";
  return NextResponse.json({ answer: fallback, sources, grounded: true, mode: "deterministic-fallback", note: "Set OPENAI_API_KEY to enable model-generated synthesis." });
}
