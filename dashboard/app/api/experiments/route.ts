import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type CatalogRecord = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

function loadCatalog(): CatalogRecord[] {
  const file = path.join(process.cwd(), "..", "catalog", "experiments.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as CatalogRecord[];
}

function normalize(record: CatalogRecord) {
  const id = text(record.experiment_id);
  const available: string[] = [];
  if (num(record.initial_oxygen_pct) != null || num(record.final_oxygen_pct) != null || num(record.oxygen_condition_pct) != null) available.push("oxygen");
  if (num(record.initial_co2_pct) != null || num(record.final_co2_pct) != null) available.push("carbon dioxide");
  if (num(record.initial_co_ppm) != null || num(record.final_co_ppm) != null) available.push("carbon monoxide");
  if (num(record.flame_spread_rate_mm_s) != null) available.push("flame spread rate");
  if (num(record.burn_duration_s) != null) available.push("burn duration");
  if (num(record.burn_length_cm) != null) available.push("burn length");
  if (num(record.average_flame_power_w) != null) available.push("average flame power");
  return {
    id,
    investigation: text(record.investigation),
    title: id,
    material: text(record.fuel_material) || "Unknown material",
    condition: [record.gravity_condition, record.flow_configuration && `${record.flow_configuration} flow`, record.airflow_speed_cm_s != null && `airflow ${record.airflow_speed_cm_s} cm/s`, record.flow_restrictor && `${record.flow_restrictor} flow restrictor`, record.fan_display && `fan display ${record.fan_display}`].filter(Boolean).join(" · "),
    gravity: text(record.gravity_condition) || "not reported",
    date: record.date ?? null,
    measurements: available,
    initialOxygenPct: num(record.initial_oxygen_pct),
    finalOxygenPct: num(record.final_oxygen_pct),
    oxygenConditionPct: num(record.oxygen_condition_pct),
    calibratedInitialOxygenPct: num(record.calibrated_initial_oxygen_pct),
    calibratedFinalOxygenPct: num(record.calibrated_final_oxygen_pct),
    initialCo2Pct: num(record.initial_co2_pct),
    finalCo2Pct: num(record.final_co2_pct),
    initialCoPpm: num(record.initial_co_ppm),
    finalCoPpm: num(record.final_co_ppm),
    airflowSpeedCmS: num(record.airflow_speed_cm_s),
    flameSpreadRateMmS: num(record.flame_spread_rate_mm_s),
    burnDurationS: num(record.burn_duration_s),
    burnLengthCm: num(record.burn_length_cm),
    averageFlamePowerW: num(record.average_flame_power_w),
    averageFlamePowerUncertaintyW: num(record.average_flame_power_uncertainty_w),
    finding: text(record.observation) || text(record.data_provenance) || "No narrative observation is available in the curated record.",
    sourceUrl: text(record.source_url),
    sourceLabel: text(record.source_title) || "NASA source document",
    sourceDoi: record.source_doi ?? null,
    provenance: text(record.data_provenance),
    missingMeasurements: [
      ["initial oxygen", record.initial_oxygen_pct], ["final oxygen", record.final_oxygen_pct],
      ["flame spread rate", record.flame_spread_rate_mm_s], ["burn duration", record.burn_duration_s],
      ["burn length", record.burn_length_cm], ["average flame power", record.average_flame_power_w],
      ["airflow speed", record.airflow_speed_cm_s], ["initial CO2", record.initial_co2_pct],
      ["final CO2", record.final_co2_pct], ["initial CO", record.initial_co_ppm], ["final CO", record.final_co_ppm]
    ].filter(([, value]) => value == null).map(([label]) => label),
    measurementsSeries: Array.isArray(record.measurements) ? record.measurements : []
  };
}

export function GET() {
  return NextResponse.json({ experiments: loadCatalog().map(normalize), source: "catalog/experiments.json" });
}
