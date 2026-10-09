import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type CatalogRecord = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const object = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

function loadFlexRecords(): CatalogRecord[] {
  const file = path.join(process.cwd(), "..", "catalog", "experiments.json");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8")) as CatalogRecord[];
  return catalog.filter((record) => text(record.investigation).includes("FLEX"));
}

function makeMetric(records: CatalogRecord[], key: string, label: string, unit: string) {
  return {
    label,
    unit,
    values: records.filter((record) => num(record[key]) != null).map((record) => ({
      experimentId: text(record.experiment_id),
      testId: text(record.test_id),
      sampleId: text(record.sample_id),
      fuel: text(record.fuel_material),
      value: num(record[key]),
      qualifier: text(object(record.reported_metric_qualifiers)[key]) || null,
      sourceRowNumber: num(record.source_row_number),
      sourceUrl: text(record.source_url),
      sourceTitle: text(record.source_title),
    })),
  };
}

export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("investigation")?.trim().toLowerCase();
  if (requested && requested !== "flex" && !requested.includes("flame extinguishment experiment")) {
    return NextResponse.json({ error: "unsupported_investigation", supported: ["FLEX"] }, { status: 400 });
  }

  const records = loadFlexRecords();
  const grouped = new Map<string, number>();
  for (const record of records) {
    const key = `${text(record.fuel_material)}\u0000${text(record.test_end)}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  const outcomeCountsByFuel = [...grouped.entries()].map(([key, count]) => {
    const [fuel, outcome] = key.split("\u0000");
    return { fuel, outcome, count };
  }).sort((a, b) => (a.fuel < b.fuel ? -1 : a.fuel > b.fuel ? 1 : 0) || (a.outcome < b.outcome ? -1 : a.outcome > b.outcome ? 1 : 0));

  const oxygenBurningRate = records.filter((record) => num(record.initial_oxygen_pct) != null && num(record.burning_rate_source_value) != null).map((record) => ({
    experimentId: text(record.experiment_id),
    testId: text(record.test_id),
    sampleId: text(record.sample_id),
    fuel: text(record.fuel_material),
    oxygenMoleFraction: num(record.initial_oxygen_mole_fraction),
    oxygenPct: num(record.initial_oxygen_pct),
    burningRateValue: num(record.burning_rate_source_value),
    burningRateUnit: text(object(record.reported_metric_units).burning_rate_source_value),
    sourceUrl: text(record.source_url),
    sourceTitle: text(record.source_title),
  }));

  return NextResponse.json({
    investigation: "FLEX",
    dataset: {
      title: "NASA PSI-69 Version 5 experimental table (FLEX)",
      sourceUrl: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69",
      sourceDoi: "10.60555/mbq8-0451",
      reportUrl: "https://ntrs.nasa.gov/citations/20150023456",
      sourceVersion: 5,
      recordCount: records.length,
      testNumberRange: "1–274",
      duplicateSampleIdentifiers: ["193F001"],
      scopeNote: "The downloadable PSI-69 Version 5 CSV contains 274 data rows. The PSI table view reports 275 entries, while NASA/TP-2015-216046 reports its first 284 tests; these scopes are kept separate.",
      metricNotes: [
        "Burning-rate values preserve the PSI CSV source value. Its header says mm; NASA/TP-2015-216046 labels the corresponding metric mm²/s. Confirm unit reconciliation before interpreting or comparing this axis.",
        "The PSI CSV composition header says CO; the NTRS report says CO₂. The catalog retains the PSI source column under a neutral name.",
        "Initial oxygen percent is derived as reported oxygen mole fraction × 100.",
        "These are reported test-level aggregates; no time-series measurements are supplied.",
      ],
    },
    outcomeCountsByFuel,
    oxygenBurningRate,
    metricSeries: {
      burningRate: makeMetric(records, "burning_rate_source_value", "PSI reported burning-rate value", "mm (PSI CSV header; NTRS report labels metric mm²/s)"),
      burnTime: makeMetric(records, "burn_time_s", "Burn time", "s"),
      initialDropletDiameter: makeMetric(records, "initial_droplet_diameter_mm", "Initial droplet diameter", "mm"),
      visibleFlameExtinctionDiameter: makeMetric(records, "visible_flame_extinction_diameter_mm", "Visible flame extinction diameter", "mm"),
    },
    records: records.map((record) => ({
      experimentId: text(record.experiment_id),
      testId: text(record.test_id),
      sampleId: text(record.sample_id),
      fuel: text(record.fuel_material),
      oxygenPct: num(record.initial_oxygen_pct),
      oxygenMoleFraction: num(record.initial_oxygen_mole_fraction),
      ambientPressureMmHg: num(record.ambient_pressure_mmhg),
      initialDropletDiameterMm: num(record.initial_droplet_diameter_mm),
      visibleFlameExtinctionDiameterMm: num(record.visible_flame_extinction_diameter_mm),
      burningRateValue: num(record.burning_rate_source_value),
      burningRateUnit: text(object(record.reported_metric_units).burning_rate_source_value),
      burnTimeS: num(record.burn_time_s),
      burnTimeQualifier: text(object(record.reported_metric_qualifiers).burn_time_s) || null,
      testEnd: text(record.test_end),
      measurementKind: "reported aggregate",
      measurements: Array.isArray(record.measurements) ? record.measurements : [],
      sourceRowNumber: num(record.source_row_number),
      sourceUrl: text(record.source_url),
      sourceTitle: text(record.source_title),
      sourceDoi: text(record.source_doi),
      sourceDocumentUrl: text(record.source_document_url),
    })),
  });
}
