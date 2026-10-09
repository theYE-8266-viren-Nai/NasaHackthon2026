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
  return text && !["none", "nan", "n/a"].includes(text.toLowerCase()) ? text : null;
}

function number(value) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
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
  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
    const test = clean(row["Test #"]) ?? "unknown";
    const sample = clean(row["Sample #"]) ?? "unknown";
    const id = test + "_" + sample;
    const supplemental = curatedById.get(id) ?? {};
    return {
      ...supplemental,
      experiment_id: id,
      test_id: test,
      sample_id: sample,
      investigation: supplemental.investigation ?? "Burning and Suppression of Solids-II (BASS-II)",
      date: clean(row.Date), gmt: clean(row.GMT), pi: clean(row.PI),
      fuel_material: clean(row["Fuel Sample Material"]),
      flow_restrictor: clean(row["Flow restrictor"]),
      flow_configuration: clean(row["Flow configuration"]),
      fan_display: clean(row["Fan display"]), air_display: clean(row["Air display"]),
      total_frames: number(row["Total Frames Shot"]),
      calibrated_initial_oxygen_pct: number(row["Calibrated  initial O2 % by vol "]),
      calibrated_final_oxygen_pct: number(row["Calibrated final O2 % by vol"]),
      initial_oxygen_pct: number(row["Initial O2 % by vol"]),
      final_oxygen_pct: number(row["Final O2 % by vol"]),
      initial_co2_pct: number(row["Initial CO2 % by vol"]),
      final_co2_pct: number(row["Final CO2 % by vol"]),
      initial_co_ppm: number(row["Initial CO (ppm)"]),
      final_co_ppm: number(row["Final CO (ppm)"]),
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
      if (bright > 105 && red >= green * 0.82 && green >= blue * 0.72) {
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
      method: "bright-warm-pixel segmentation with moving-window trend classification",
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
  const hasFrames = Number(analysis.frame_count ?? 0) > 0;
  const hasFlameSignal = hasFrames && analysis.state !== "undetected";
  const components = [
    { key: "flame_trend", label: "Flame trend", weight: 45, points: Object.hasOwn(statePoints, analysis.state) ? statePoints[analysis.state] : null, evidence: analysis.state ?? null },
    { key: "peak_flame_area", label: "Peak detected flame area", weight: 25, points: hasFlameSignal && peak > 0 ? Math.min(100, (peak / 0.05) * 100) : null, evidence: hasFlameSignal && peak > 0 ? peak : null },
    { key: "positive_area_growth", label: "Positive flame-area growth", weight: 20, points: hasFlameSignal && slope >= 0 ? Math.min(100, (slope / 0.01) * 100) : hasFlameSignal ? 0 : null, evidence: hasFlameSignal ? slope : null },
    { key: "final_co", label: "Final CO measurement", weight: 10, points: Number.isFinite(co) ? Math.min(100, (co / 100) * 100) : null, evidence: Number.isFinite(co) ? co : null },
  ].map((item) => ({ ...item, contribution: item.points == null ? null : Number((item.weight * item.points / 100).toFixed(2)) }));
  const availableWeight = components.reduce((sum, item) => sum + (item.points == null ? 0 : item.weight), 0);
  const weightedPoints = components.reduce((sum, item) => sum + (item.contribution ?? 0), 0);
  const score = availableWeight ? weightedPoints / availableWeight * 100 : null;
  const reasons = [];
  if (analysis.state === "growing") reasons.push("detected flame area is increasing");
  if (analysis.state === "stable") reasons.push("detected flame remains persistent");
  if (analysis.state === "shrinking" || analysis.state === "extinguished") reasons.push("detected flame trend is decreasing or extinguished");
  if (peak > 0.01) reasons.push("peak detected flame area exceeds 1% of the frame");
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
    method: "Available components are normalized to 0–100 and weighted: flame trend 45%, peak detected area 25%, positive area growth 20%, and final CO 10%. The score is renormalized over available components; evidence coverage is shown separately. Area thresholds are prototype settings, not validated safety limits.",
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
      method: "Available analysis components are weighted and renormalized; each ranked result lists its components and evidence coverage.",
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
