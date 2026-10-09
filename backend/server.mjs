import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(ROOT, "data", "PSI-25_Experimental table_BASS-II.csv");
const CURATED_PATH = path.join(ROOT, "catalog", "experiments.json");

function clean(value) {
  const text = String(value ?? "").trim();
  return text && !["-", "--", "---", "n/a", "na", "nan", "none", "null", "not available", "not reported", "unknown"].includes(text.toLowerCase()) ? text : null;
}

function number(value) {
  const text = clean(value)?.replace(/[−–]/g, "-").replace(/,/g, "");
  if (!text) return null;
  const match = text.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:\s*[a-zA-Z%µμ/².^_-]*)?$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedHeader(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function column(row, ...aliases) {
  const requested = new Set(aliases.map(normalizedHeader));
  const key = Object.keys(row).find((header) => requested.has(normalizedHeader(header)));
  return key == null ? null : clean(row[key]);
}

function isoDate(value) {
  const text = clean(value);
  if (!text) return null;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return us ? us[3] + "-" + us[1].padStart(2, "0") + "-" + us[2].padStart(2, "0") : text;
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

function loadExperiments() {
  const curated = JSON.parse(fs.readFileSync(CURATED_PATH, "utf8"));
  if (!fs.existsSync(CSV_PATH)) return curated;

  const lines = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift());
  const curatedById = new Map(curated.map((item) => [item.experiment_id, item]));
  const parsed = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
    const test = column(row, "Test #", "Test") ?? "unknown";
    const sample = column(row, "Sample #", "Sample") ?? "unknown";
    const id = test + "_" + sample;
    const supplemental = curatedById.get(id) ?? {};
    return {
      ...supplemental,
      experiment_id: id,
      test_id: test,
      sample_id: sample,
      investigation: supplemental.investigation ?? "Burning and Suppression of Solids-II (BASS-II)",
      date: isoDate(column(row, "Date")), gmt: column(row, "GMT"), pi: column(row, "PI"),
      fuel_material: column(row, "Fuel Sample Material", "Material"),
      flow_restrictor: column(row, "Flow restrictor"),
      flow_configuration: column(row, "Flow configuration", "Flow direction"),
      airflow_speed_cm_s: number(column(row, "Airflow speed (cm/s)", "Flow speed (cm/s)")),
      fan_display: column(row, "Fan display"), air_display: column(row, "Air display"),
      total_frames: number(column(row, "Total Frames Shot")),
      calibrated_initial_oxygen_pct: number(column(row, "Calibrated initial O2 % by vol")),
      calibrated_final_oxygen_pct: number(column(row, "Calibrated final O2 % by vol")),
      initial_oxygen_pct: number(column(row, "Initial O2 % by vol")),
      final_oxygen_pct: number(column(row, "Final O2 % by vol")),
      initial_co2_pct: number(column(row, "Initial CO2 % by vol")),
      final_co2_pct: number(column(row, "Final CO2 % by vol")),
      initial_co_ppm: number(column(row, "Initial CO (ppm)")),
      final_co_ppm: number(column(row, "Final CO (ppm)")),
      flame_spread_rate_mm_s: number(column(row, "Flame spread rate (mm/s)", "Spread rate (mm/s)")),
      burn_duration_s: number(column(row, "Burn duration (s)")),
    };
  }).map((experiment) => {
    const source = curatedById.get(experiment.experiment_id);
    return source ? { ...experiment, observation: source.observation, measurements: source.measurements, source_url: source.source_url, source_title: source.source_title, investigation_url: source.investigation_url, source_doi: source.source_doi, data_provenance: source.data_provenance } : {
      ...experiment,
      source_url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
      source_title: "NASA Physical Sciences Informatics: BASS-II (PSI-25)",
      investigation_url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
      data_provenance: "Experiment metadata loaded from the local PSI-25 BASS-II experimental table.",
    };
  });
  const csvIds = new Set(parsed.map((experiment) => experiment.experiment_id));
  return [...parsed, ...curated.filter((experiment) => !csvIds.has(experiment.experiment_id))];
}

function flexVisualizationData() {
  const records = loadExperiments().filter((item) => item.investigation?.includes("FLEX"));
  const outcomes = new Map();
  for (const record of records) {
    const key = record.fuel_material + "\u0000" + record.test_end;
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  }
  const outcomeCountsByFuel = [...outcomes.entries()].map(([key, count]) => {
    const [fuel, outcome] = key.split("\u0000");
    return { fuel, outcome, count };
  }).sort((a, b) => (a.fuel < b.fuel ? -1 : a.fuel > b.fuel ? 1 : 0) || (a.outcome < b.outcome ? -1 : a.outcome > b.outcome ? 1 : 0));

  const metric = (key, label, unit) => ({
    label,
    unit,
    values: records.filter((record) => record[key] != null).map((record) => ({
      experimentId: record.experiment_id,
      testId: record.test_id,
      sampleId: record.sample_id,
      fuel: record.fuel_material,
      value: record[key],
      qualifier: record.reported_metric_qualifiers?.[key] ?? null,
      sourceRowNumber: record.source_row_number,
      sourceUrl: record.source_url,
      sourceTitle: record.source_title,
    })),
  });

  const oxygenBurningRate = records.filter((record) => record.initial_oxygen_pct != null && record.burning_rate_source_value != null).map((record) => ({
    experimentId: record.experiment_id,
    testId: record.test_id,
    sampleId: record.sample_id,
    fuel: record.fuel_material,
    oxygenMoleFraction: record.initial_oxygen_mole_fraction,
    oxygenPct: record.initial_oxygen_pct,
    burningRateValue: record.burning_rate_source_value,
    burningRateUnit: record.reported_metric_units?.burning_rate_source_value,
    sourceUrl: record.source_url,
    sourceTitle: record.source_title,
  }));

  return {
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
      scopeNote: "This curated dataset follows the 274 data rows in the downloadable PSI-69 Version 5 experimental table. The PSI table view reports 275 entries, while NASA/TP-2015-216046 reports the first 284 tests; these scopes are not merged.",
      metricNotes: [
        "Burning-rate values preserve the PSI CSV source value. Its header says mm; NASA/TP-2015-216046 labels the corresponding metric mm²/s. Confirm the unit reconciliation before interpreting or comparing the axis.",
        "The PSI CSV composition header says CO; the NTRS report says CO₂. This catalog preserves the source column under a neutral name.",
        "Initial oxygen percent is derived as reported oxygen mole fraction × 100.",
        "These are reported test-level aggregates. No time-series measurements are supplied.",
      ],
    },
    outcomeCountsByFuel,
    oxygenBurningRate,
    metricSeries: {
      burningRate: metric("burning_rate_source_value", "PSI reported burning-rate value", "mm (PSI CSV header; NTRS report labels metric mm²/s)"),
      burnTime: metric("burn_time_s", "Burn time", "s"),
      initialDropletDiameter: metric("initial_droplet_diameter_mm", "Initial droplet diameter", "mm"),
      visibleFlameExtinctionDiameter: metric("visible_flame_extinction_diameter_mm", "Visible flame extinction diameter", "mm"),
    },
    records: records.map((record) => ({
      experimentId: record.experiment_id,
      testId: record.test_id,
      sampleId: record.sample_id,
      fuel: record.fuel_material,
      date: record.date,
      ambientPressureMmHg: record.ambient_pressure_mmhg,
      oxygenMoleFraction: record.initial_oxygen_mole_fraction,
      oxygenPct: record.initial_oxygen_pct,
      nitrogenMoleFraction: record.initial_nitrogen_mole_fraction,
      coColumnMoleFraction: record.initial_co_column_mole_fraction,
      heliumMoleFraction: record.initial_helium_mole_fraction,
      initialDropletDiameterMm: record.initial_droplet_diameter_mm,
      visibleFlameExtinctionDiameterMm: record.visible_flame_extinction_diameter_mm,
      burningRateValue: record.burning_rate_source_value,
      burningRateUnit: record.reported_metric_units?.burning_rate_source_value,
      burnTimeS: record.burn_time_s,
      burnTimeQualifier: record.reported_metric_qualifiers?.burn_time_s ?? null,
      testEnd: record.test_end,
      measurementKind: "reported aggregate",
      measurements: [],
      sourceRowNumber: record.source_row_number,
      sourceUrl: record.source_url,
      sourceTitle: record.source_title,
      sourceDoi: record.source_doi,
      sourceDocumentUrl: record.source_document_url,
    })),
  };
}

function findExperiment(id) {
  return loadExperiments().find((item) => item.experiment_id === id) ?? null;
}

async function segmentFlame(dataUrl) {
  const input = Buffer.from(dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl, "base64");
  const decoded = jpeg.decode(input, { useTArray: true });
  const data = decoded.data;
  const info = { width: decoded.width, height: decoded.height, channels: 4 };
  let area = 0; let minX = info.width; let minY = info.height;
  let maxX = -1; let maxY = -1; let sumX = 0; let sumY = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset]; const green = data[offset + 1]; const blue = data[offset + 2];
      const bright = (red + green + blue) / 3;
      const warmFlame = bright > 105 && red >= green * 0.82 && green >= blue * 0.72;
      const blueFlame = blue > 105 && blue >= red * 1.15 && blue >= green * 1.05;
      if (warmFlame || blueFlame) {
        area += 1; sumX += x; sumY += y;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  const detected = area > 0;
  return {
    area_px: area,
    area_fraction: Number((area / (info.width * info.height)).toFixed(6)),
    bbox: detected ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    centroid: detected ? { x: Number((sumX / area).toFixed(2)), y: Number((sumY / area).toFixed(2)) } : null,
  };
}

function classify(areas, times) {
  if (areas.length < 2 || Math.max(...areas) <= 0) return ["undetected", 0];
  const window = Math.min(5, areas.length);
  const start = areas.slice(0, window).reduce((a, b) => a + b, 0) / window;
  const end = areas.slice(-window).reduce((a, b) => a + b, 0) / window;
  const slope = (end - start) / Math.max(times.at(-1) - times[0], 1e-6);
  const normalized = slope / Math.max(...areas, 1e-6);
  if (normalized > 0.015) return ["growing", Math.min(0.99, 0.55 + normalized * 8)];
  if (normalized < -0.015) return ["shrinking", Math.min(0.99, 0.55 + Math.abs(normalized) * 8)];
  return ["stable", 0.6];
}

function makeSummary(experiment, state) {
  if (state === "undetected") return "No flame pixels were detected. Check the frame crop, lighting, or video selection before drawing a safety conclusion.";
  const material = experiment?.fuel_material ?? "the tested material";
  const oxygen = experiment?.initial_oxygen_pct == null ? "" : " at approximately " + experiment.initial_oxygen_pct + "% initial oxygen";
  if (state === "growing") return "The detected flame is growing on " + material + oxygen + ". Flag this run for continued observation and suppression analysis.";
  if (state === "shrinking") return "The detected flame is shrinking on " + material + oxygen + ". Continue monitoring until extinction is confirmed.";
  return "The detected flame is approximately stable on " + material + oxygen + ". Treat persistence as an active fire condition.";
}

async function analyze(payload) {
  const frames = (payload.frames ?? []).slice(0, 240);
  if (!frames.length) throw new Error("frames must contain at least one sampled JPEG frame");
  const experiment = payload.experiment_id ? findExperiment(payload.experiment_id) : null;
  const results = [];
  for (let i = 0; i < frames.length; i += 1) {
    results.push({ index: i, timestamp_s: Number(frames[i].timestamp_s ?? i), ...(await segmentFlame(frames[i].image)) });
  }
  const areas = results.map((item) => item.area_fraction);
  const times = results.map((item) => item.timestamp_s);
  const [state, confidence] = classify(areas, times);
  const slope = areas.length > 1 ? (areas.at(-1) - areas[0]) / Math.max(times.at(-1) - times[0], 1e-6) : 0;
  return {
    experiment,
    analysis: {
      frame_count: results.length, state, confidence: Number(confidence.toFixed(3)),
      peak_area_fraction: Math.max(...areas), area_slope_per_second: Number(slope.toFixed(6)),
      summary: makeSummary(experiment, state),
      method: "bright warm- or blue-pixel segmentation with moving-window trend classification; confidence is a heuristic trend score, not a calibrated probability",
      confidence_note: "Heuristic trend score for this sampled video only; it is not a calibrated probability or a fire-safety confidence estimate.",
      limitations: ["Prototype heuristic; not a validated fire-safety predictor.", "Camera exposure, background color, and crop affect segmentation.", "Results should be checked against the original experiment documentation."],
    },
    frames: results,
  };
}

function reviewPriority(experiment, analysis) {
  const statePoints = { growing: 100, stable: 55, shrinking: 20, extinguished: 0 };
  const peak = Number(analysis.peak_area_fraction ?? 0);
  const slope = Number(analysis.area_slope_per_second ?? 0);
  const co = experiment?.final_co_ppm == null ? null : Number(experiment.final_co_ppm);
  const spreadRate = experiment?.flame_spread_rate_mm_s == null ? null : Number(experiment.flame_spread_rate_mm_s);
  const hasFrames = Number(analysis.frame_count ?? 0) > 0;
  const hasFlameSignal = hasFrames && analysis.state !== "undetected";
  const components = [
    { key: "flame_trend", label: "Flame trend", weight: 40, points: Object.hasOwn(statePoints, analysis.state) ? statePoints[analysis.state] : null, evidence: analysis.state ?? null },
    { key: "peak_flame_area", label: "Peak detected flame area", weight: 20, points: hasFlameSignal && peak > 0 ? Math.min(100, (peak / 0.05) * 100) : null, evidence: hasFlameSignal && peak > 0 ? peak : null },
    { key: "positive_area_growth", label: "Positive flame-area growth", weight: 20, points: hasFlameSignal && slope >= 0 ? Math.min(100, (slope / 0.01) * 100) : hasFlameSignal ? 0 : null, evidence: hasFlameSignal ? slope : null },
    { key: "reported_spread_rate", label: "Reported flame spread rate (mm/s)", weight: 10, points: Number.isFinite(spreadRate) ? Math.max(0, Math.min(100, (spreadRate / 5) * 100)) : null, evidence: Number.isFinite(spreadRate) ? spreadRate : null },
    { key: "final_co", label: "Final CO measurement", weight: 10, points: Number.isFinite(co) ? Math.max(0, Math.min(100, (co / 100) * 100)) : null, evidence: Number.isFinite(co) ? co : null },
  ].map((item) => ({ ...item, contribution: item.points == null ? null : Number((item.weight * item.points / 100).toFixed(2)) }));
  const availableWeight = components.reduce((sum, item) => sum + (item.points == null ? 0 : item.weight), 0);
  const weightedPoints = components.reduce((sum, item) => sum + (item.contribution ?? 0), 0);
  const score = availableWeight ? weightedPoints / availableWeight * 100 : null;
  const reasons = [];
  if (analysis.state === "growing") reasons.push("detected flame area is increasing");
  if (analysis.state === "stable") reasons.push("detected flame remains persistent");
  if (analysis.state === "shrinking" || analysis.state === "extinguished") reasons.push("detected flame trend is decreasing or extinguished");
  if (peak > 0.01) reasons.push("peak detected flame area exceeds 1% of the frame");
  if (Number.isFinite(spreadRate)) reasons.push("NASA-reported average flame spread rate is " + spreadRate + " mm/s");
  if (Number.isFinite(co) && co > 50) reasons.push("final CO measurement exceeds 50 ppm");
  const omitted = components.filter((item) => item.points == null).map((item) => item.label);
  if (omitted.length) reasons.push("not scored because evidence is unavailable: " + omitted.join(", "));
  if (!reasons.length) reasons.push("no usable flame trend, area, or CO evidence");
  const coverage = Number((availableWeight / 100 * 100).toFixed(0));
  const label = availableWeight < 50 ? "limited evidence" : score >= 60 ? "high review priority" : "review priority";
  return {
    score: score == null ? null : Number(score.toFixed(1)),
    label,
    coverage_pct: coverage,
    components,
    reasons,
    method: "Available components are normalized to 0–100 and weighted: flame trend 40%, peak detected area 20%, positive area growth 20%, reported flame spread rate 10%, and final CO 10%. The score is renormalized over available components; evidence coverage is shown separately. Area and spread-rate thresholds are prototype settings, not validated safety limits.",
  };
}

function rank(payload) {
  const ranked = (payload.results ?? []).map((item) => {
    const experiment = item.experiment ?? findExperiment(item.experiment_id);
    return { experiment_id: item.experiment_id ?? experiment?.experiment_id, experiment, analysis: item.analysis ?? {}, priority: reviewPriority(experiment, item.analysis ?? {}) };
  }).sort((a, b) => (b.priority.score ?? -1) - (a.priority.score ?? -1) || b.priority.coverage_pct - a.priority.coverage_pct);
  return {
    summary: {
      experiments_reviewed: ranked.length,
      highest_priority: ranked[0]?.experiment_id ?? null,
      method: "Available analysis components, including source-reported flame spread rates, are weighted and renormalized; each ranked result lists its components and evidence coverage.",
      warning: "This prototype ranks experiments for research review. It is not a validated spacecraft hazard score, and scores with limited evidence should not be compared as complete assessments.",
    },
    ranked,
  };
}

function send(response, status, body) {
  const raw = JSON.stringify(body);
  response.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw), "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" });
  response.end(raw);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") return send(response, 204, {});
    if (request.method === "GET" && request.url === "/api/health") return send(response, 200, { ok: true, service: "flame-analysis", runtime: "node", version: "0.2.0" });
    if (request.method === "GET" && request.url === "/api/experiments") return send(response, 200, { experiments: loadExperiments() });
    if (request.method === "GET" && request.url?.split("?", 1)[0] === "/api/visualizations") {
      const requested = new URL(request.url, "http://localhost").searchParams.get("investigation")?.trim().toLowerCase();
      if (requested && requested !== "flex" && !requested.includes("flame extinguishment experiment")) {
        return send(response, 400, { error: "unsupported_investigation", supported: ["FLEX"] });
      }
      return send(response, 200, flexVisualizationData());
    }
    if (request.method === "POST" && ["/api/analyze-frames", "/api/rank"].includes(request.url)) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      return send(response, 200, request.url === "/api/rank" ? rank(payload) : await analyze(payload));
    }
    return send(response, 404, { error: "not_found" });
  } catch (error) {
    return send(response, 400, { error: error.message });
  }
});

const port = Number(process.env.PORT ?? 8000);
server.listen(port, "0.0.0.0", () => console.log("Flame analysis Node.js backend listening on http://localhost:" + port));
