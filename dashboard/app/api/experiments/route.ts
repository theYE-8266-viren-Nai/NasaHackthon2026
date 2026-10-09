import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type CatalogRecord = Record<string, unknown>;

function loadCatalog(): CatalogRecord[] {
  const file = path.join(process.cwd(), "..", "catalog", "experiments.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as CatalogRecord[];
}

function normalize(record: CatalogRecord) {
  const measurements = [
    record.initial_oxygen_pct != null && record.final_oxygen_pct != null ? "oxygen" : null,
    record.initial_co2_pct != null && record.final_co2_pct != null ? "carbon dioxide" : null,
    record.initial_co_ppm != null && record.final_co_ppm != null ? "carbon monoxide" : null
  ].filter(Boolean);
  return {
    id: record.experiment_id,
    investigation: "BASS-II",
    title: record.fuel_material ?? record.experiment_id,
    material: record.fuel_material ?? "Unknown material",
    condition: [record.flow_configuration, record.flow_restrictor, record.fan_display ? "fan " + record.fan_display : null].filter(Boolean).join(" · "),
    gravity: "Microgravity",
    measurements,
    initialOxygenPct: record.initial_oxygen_pct ?? null,
    finalOxygenPct: record.final_oxygen_pct ?? null,
    initialCoPpm: record.initial_co_ppm ?? null,
    finalCoPpm: record.final_co_ppm ?? null,
    flameSpreadRate: null,
    finding: record.observation ?? record.data_provenance ?? "No narrative observation is available in the curated record.",
    sourceUrl: record.investigation_url ?? record.source_url,
    sourceLabel: record.source_title ?? "NASA Physical Sciences Informatics",
    sourceDoi: record.source_doi ?? null
  };
}

export function GET() {
  return NextResponse.json({ experiments: loadCatalog().map(normalize), source: "catalog/experiments.json" });
}
