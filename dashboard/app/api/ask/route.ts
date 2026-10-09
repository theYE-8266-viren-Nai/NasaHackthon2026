import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type RecordItem = Record<string, unknown>;
function catalog(): RecordItem[] {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "catalog", "experiments.json"), "utf8")) as RecordItem[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { question?: string; experimentIds?: string[] };
    const question = (body.question ?? "").trim();
    if (!question) return NextResponse.json({ error: "Enter a question about the selected NASA experiments." }, { status: 400 });
    const ids = new Set(body.experimentIds ?? []);
    const records = catalog().filter((item) => ids.has(String(item.experiment_id)));
    if (!records.length) return NextResponse.json({ error: "Select at least one experiment so the answer can be grounded in its evidence." }, { status: 400 });
    const sources = records.map((item) => ({
      experimentId: item.experiment_id, investigation: item.investigation, material: item.fuel_material,
      condition: [item.gravity_condition, item.flow_configuration, item.airflow_speed_cm_s != null ? `${item.airflow_speed_cm_s} cm/s airflow` : null].filter(Boolean).join(", "),
      reported: Object.fromEntries(["initial_oxygen_pct", "final_oxygen_pct", "oxygen_condition_pct", "initial_co_ppm", "final_co_ppm", "flame_spread_rate_mm_s", "burn_duration_s", "burn_length_cm", "average_flame_power_w", "average_flame_power_uncertainty_w"].map((key) => [key, key === "initial_oxygen_pct" && item.initial_oxygen_mole_fraction != null ? null : item[key] ?? null])),
      derivedMetrics: item.initial_oxygen_mole_fraction != null && typeof item.initial_oxygen_pct === "number" ? { initial_oxygen_pct: item.initial_oxygen_pct } : {},
      derivedMetricMethods: (item.initial_oxygen_mole_fraction != null ? { initial_oxygen_pct: "reported initial oxygen mole fraction × 100" } : {}) as Record<string, string>,
      reportedMetrics: item.reported_metrics ?? {},
      reportedMetricUnits: (item.reported_metric_units ?? {}) as Record<string, string>,
      reportedMetricQualifiers: (item.reported_metric_qualifiers ?? {}) as Record<string, string>,
      observation: item.observation ?? null, provenance: item.data_provenance ?? null,
      sourceUrl: item.source_url, sourceTitle: item.source_title, sourceDocumentUrl: item.source_document_url ?? null,
      sourceRowNumber: item.source_row_number ?? null, sourceDataVersion: item.source_data_version ?? null
    }));
    const missing = sources.some((item) => Object.values(item.reported).some((value) => value == null) || Object.values(item.reportedMetrics).some((value) => value == null));
    const incompleteEvidence = missing || sources.some((item) => !item.observation);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const summaries = sources.map((item) => {
        const fields = { ...item.reported, ...item.reportedMetrics };
        const measured = Object.entries(fields).filter(([, value]) => value != null).map(([key, value]) => {
          const unit = item.reportedMetricUnits[key]; const qualifier = item.reportedMetricQualifiers[key];
          return `${key.replaceAll("_", " ")}: ${qualifier ? `${qualifier}; ` : ""}${value}${unit ? ` ${unit}` : ""}`;
        }).join("; ") || "no numeric measurements are available";
        const derived = Object.entries(item.derivedMetrics).map(([key, value]) => `${key.replaceAll("_", " ")} derived as ${value} (${item.derivedMetricMethods[key]})`).join("; ");
        return `${item.experimentId} (${item.investigation}) reports ${measured}.${derived ? ` Derived values: ${derived}.` : ""} ${item.observation ?? item.provenance ?? "The catalog has no observation text for this run."}`;
      });
      return NextResponse.json({ answer: `${summaries.join("\n\n")}\n\nThis is a source-grounded catalog summary, not a generated safety procedure. ${incompleteEvidence ? "Evidence is incomplete; missing measurements are not inferred." : "The selected catalog fields are populated, but remain a small research subset."}`, generated: false, incompleteEvidence, sources: sources.map(({ experimentId, sourceUrl, sourceTitle, sourceDocumentUrl }) => ({ experimentId, sourceUrl, sourceTitle, sourceDocumentUrl })) });
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini", input: [
        { role: "system", content: "Answer using only the provided NASA experiment records. Separate reported measurements from interpretation. Preserve reported units and qualifiers, and explicitly surface source-label discrepancies described in provenance. Do not infer missing values, resolve conflicting units by guessing, claim causation, invent citations, or give operational fire-safety instructions. State when evidence is incomplete. Cite records by experiment ID; source links are supplied separately." },
        { role: "user", content: `Question: ${question}\n\nNASA catalog records (JSON):\n${JSON.stringify(sources)}` }
      ] })
    });
    const result = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: result.error?.message ?? "AI summary provider returned an error." }, { status: 502 });
    const answer = (result.output ?? []).flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
    return NextResponse.json({ answer, generated: true, incompleteEvidence, sources: sources.map(({ experimentId, sourceUrl, sourceTitle, sourceDocumentUrl }) => ({ experimentId, sourceUrl, sourceTitle, sourceDocumentUrl })) });
  } catch {
    return NextResponse.json({ error: "Could not prepare a grounded answer from the selected catalog records." }, { status: 500 });
  }
}
