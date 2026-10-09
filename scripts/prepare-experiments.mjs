import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(ROOT, "catalog", "experiments.json");
const outputPath = path.join(ROOT, "dashboard", "data", "experiments.json");

function availableMeasurements(experiment) {
  const items = [];
  if (experiment.initial_oxygen_pct != null || experiment.final_oxygen_pct != null || experiment.oxygen_condition_pct != null) items.push("oxygen");
  if (experiment.initial_co2_pct != null || experiment.final_co2_pct != null) items.push("carbon dioxide");
  if (experiment.initial_co_ppm != null || experiment.final_co_ppm != null) items.push("carbon monoxide");
  if (experiment.flame_spread_rate_mm_s != null) items.push("flame spread rate");
  if (experiment.burn_duration_s != null) items.push("burn duration");
  if (experiment.average_flame_power_w != null) items.push("average flame power");
  if (experiment.measurements?.length) items.push("flame time series");
  return items;
}

function conditionText(experiment) {
  const parts = [experiment.gravity_condition, experiment.flow_configuration ? experiment.flow_configuration.toLowerCase() + " flow" : null];
  if (experiment.airflow_speed_cm_s != null) parts.push("airflow " + experiment.airflow_speed_cm_s + " cm/s");
  if (experiment.flow_restrictor) parts.push(experiment.flow_restrictor + " flow restrictor");
  if (experiment.fan_display) parts.push("fan display " + experiment.fan_display);
  if (experiment.air_display) parts.push("air display " + experiment.air_display);
  if (experiment.sample_width_cm != null && experiment.sample_length_cm != null) parts.push(experiment.sample_width_cm + " × " + experiment.sample_length_cm + " cm sample");
  if (experiment.sample_thickness_mm != null) parts.push(experiment.sample_thickness_mm + " mm thick");
  return parts.filter(Boolean).join(" · ");
}

function toDashboardRecord(experiment) {
  return {
    id: experiment.experiment_id,
    investigation: experiment.investigation.includes("BASS-II") ? "BASS-II" : "SAFFIRE-I",
    title: experiment.experiment_id,
    material: experiment.fuel_material ?? null,
    condition: conditionText(experiment),
    gravity: experiment.gravity_condition ?? null,
    date: experiment.date ?? null,
    measurements: availableMeasurements(experiment),
    initialOxygenPct: experiment.initial_oxygen_pct ?? null,
    finalOxygenPct: experiment.final_oxygen_pct ?? null,
    oxygenConditionPct: experiment.oxygen_condition_pct ?? null,
    calibratedInitialOxygenPct: experiment.calibrated_initial_oxygen_pct ?? null,
    calibratedFinalOxygenPct: experiment.calibrated_final_oxygen_pct ?? null,
    initialCo2Pct: experiment.initial_co2_pct ?? null,
    finalCo2Pct: experiment.final_co2_pct ?? null,
    initialCoPpm: experiment.initial_co_ppm ?? null,
    finalCoPpm: experiment.final_co_ppm ?? null,
    flameSpreadRateMmS: experiment.flame_spread_rate_mm_s ?? null,
    burnDurationS: experiment.burn_duration_s ?? null,
    burnLengthCm: experiment.burn_length_cm ?? null,
    averageFlamePowerW: experiment.average_flame_power_w ?? null,
    averageFlamePowerUncertaintyW: experiment.average_flame_power_uncertainty_w ?? null,
    finding: experiment.observation ?? null,
    sourceUrl: experiment.source_url,
    sourceLabel: experiment.source_title,
    sourceDoi: experiment.source_doi ?? null,
    investigationUrl: experiment.investigation_url,
    provenance: experiment.data_provenance,
    timeSeries: experiment.measurements ?? [],
  };
}

const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!Array.isArray(catalog) || catalog.length === 0) throw new Error("Experiment catalog must be a non-empty JSON array.");

const ids = new Set();
for (const experiment of catalog) {
  if (!experiment.experiment_id || ids.has(experiment.experiment_id)) throw new Error("Every catalog record must have a unique experiment_id.");
  if (!experiment.source_url || !experiment.data_provenance) throw new Error("Every catalog record must include source_url and data_provenance: " + experiment.experiment_id);
  ids.add(experiment.experiment_id);
}

const dashboardData = catalog.map(toDashboardRecord);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2) + "\n");
process.stdout.write("Prepared " + dashboardData.length + " dashboard experiment records at dashboard/data/experiments.json\n");
