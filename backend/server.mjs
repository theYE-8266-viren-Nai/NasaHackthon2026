import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(ROOT, "data", "PSI-25_Experimental table_BASS-II.csv");

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
  const lines = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
    const test = clean(row["Test #"]) ?? "unknown";
    const sample = clean(row["Sample #"]) ?? "unknown";
    return {
      experiment_id: test + "_" + sample,
      test_id: test,
      sample_id: sample,
      date: clean(row.Date), gmt: clean(row.GMT), pi: clean(row.PI),
      fuel_material: clean(row["Fuel Sample Material"]),
      flow_restrictor: clean(row["Flow restrictor"]),
      fan_display: clean(row["Fan display"]), air_display: clean(row["Air display"]),
      total_frames: number(row["Total Frames Shot"]),
      initial_oxygen_pct: number(row["Calibrated  initial O2 % by vol "]),
      final_oxygen_pct: number(row["Calibrated final O2 % by vol"]),
      initial_co2_pct: number(row["Initial CO2 % by vol"]),
      final_co2_pct: number(row["Final CO2 % by vol"]),
      initial_co_ppm: number(row["Initial CO (ppm)"]),
      final_co_ppm: number(row["Final CO (ppm)"]),
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
  const statePoints = { growing: 45, stable: 25, shrinking: 10, undetected: 0 };
  const peak = Number(analysis.peak_area_fraction ?? 0);
  const slope = Number(analysis.area_slope_per_second ?? 0);
  const co = Number(experiment?.final_co_ppm ?? 0);
  const score = Math.min(100, (statePoints[analysis.state] ?? 0) + Math.min(25, peak * 2500) + Math.min(20, Math.max(0, slope) * 2500) + Math.min(10, co / 100));
  const reasons = [];
  if (analysis.state === "growing") reasons.push("flame area is increasing");
  if (analysis.state === "stable") reasons.push("flame remains persistent");
  if (peak > 0.01) reasons.push("large peak detected flame area");
  if (co > 50) reasons.push("elevated final CO in the experiment table");
  return { score: Number(score.toFixed(1)), reasons: reasons.length ? reasons : ["insufficient detected flame signal"], label: score >= 60 ? "high review priority" : "review priority" };
}

function rank(payload) {
  const ranked = (payload.results ?? []).map((item) => {
    const experiment = item.experiment ?? findExperiment(item.experiment_id);
    return { experiment_id: item.experiment_id ?? experiment?.experiment_id, experiment, analysis: item.analysis ?? {}, priority: reviewPriority(experiment, item.analysis ?? {}) };
  }).sort((a, b) => b.priority.score - a.priority.score);
  return {
    summary: {
      experiments_reviewed: ranked.length,
      highest_priority: ranked[0]?.experiment_id ?? null,
      method: "explainable research-review priority from detected flame trend, peak area, CO metadata, and persistence",
      warning: "This ranking prioritizes experiments for investigation. It is not a validated spacecraft hazard score.",
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
