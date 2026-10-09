"""Flame-in-freefall analysis backend.

Runs with the bundled Python runtime. The browser extracts video frames and
sends sampled JPEG frames to this service; this service performs the numerical
analysis and returns a frontend-friendly JSON result.
"""

from __future__ import annotations

import base64
import csv
import io
import json
import math
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "PSI-25_Experimental table_BASS-II.csv"


def clean(value: Any) -> Any:
    if value is None:
        return None
    value = str(value).strip()
    return value if value and value.lower() not in {"none", "nan", "n/a"} else None


def number(value: Any) -> float | None:
    value = clean(value)
    if value is None:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", value)
    return float(match.group()) if match else None


def load_experiments() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            test = clean(row.get("Test #")) or "unknown"
            sample = clean(row.get("Sample #")) or "unknown"
            records.append(
                {
                    "experiment_id": f"{test}_{sample}",
                    "test_id": test,
                    "sample_id": sample,
                    "date": clean(row.get("Date")),
                    "gmt": clean(row.get("GMT")),
                    "pi": clean(row.get("PI")),
                    "fuel_material": clean(row.get("Fuel Sample Material")),
                    "flow_restrictor": clean(row.get("Flow restrictor")),
                    "fan_display": clean(row.get("Fan display")),
                    "air_display": clean(row.get("Air display")),
                    "total_frames": number(row.get("Total Frames Shot")),
                    "initial_oxygen_pct": number(row.get("Calibrated  initial O2 % by vol ")),
                    "final_oxygen_pct": number(row.get("Calibrated final O2 % by vol")),
                    "initial_co2_pct": number(row.get("Initial CO2 % by vol")),
                    "final_co2_pct": number(row.get("Final CO2 % by vol")),
                    "initial_co_ppm": number(row.get("Initial CO (ppm)")),
                    "final_co_ppm": number(row.get("Final CO (ppm)")),
                }
            )
    return records


def find_experiment(experiment_id: str) -> dict[str, Any] | None:
    return next((item for item in load_experiments() if item["experiment_id"] == experiment_id), None)


def decode_image(data_url: str) -> np.ndarray:
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    raw = base64.b64decode(encoded)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.asarray(image)


def segment_flame(image: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    """Segment bright warm flame pixels using an explainable color heuristic."""
    rgb = image.astype(np.float32)
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    brightness = (red + green + blue) / 3.0
    warm = (red >= green * 0.82) & (green >= blue * 0.72)
    mask = (brightness > 105) & warm

    # Reject tiny isolated noise without requiring OpenCV.
    if mask.shape[0] > 2 and mask.shape[1] > 2:
        mask_u8 = mask.astype(np.uint8)
        neighbors = np.zeros_like(mask_u8, dtype=np.uint8)
        neighbors[1:-1, 1:-1] = (
            mask_u8[:-2, :-2] + mask_u8[:-2, 1:-1] + mask_u8[:-2, 2:]
            + mask_u8[1:-1, :-2] + mask_u8[1:-1, 2:]
            + mask_u8[2:, :-2] + mask_u8[2:, 1:-1] + mask_u8[2:, 2:]
        )
        mask &= neighbors >= 2

    ys, xs = np.where(mask)
    total = int(mask.sum())
    height, width = mask.shape
    if total == 0:
        return mask, {
            "area_px": 0,
            "area_fraction": 0.0,
            "bbox": None,
            "centroid": None,
        }
    bbox = {"x": int(xs.min()), "y": int(ys.min()), "width": int(xs.max() - xs.min() + 1), "height": int(ys.max() - ys.min() + 1)}
    return mask, {
        "area_px": total,
        "area_fraction": round(total / float(width * height), 6),
        "bbox": bbox,
        "centroid": {"x": round(float(xs.mean()), 2), "y": round(float(ys.mean()), 2)},
    }


def classify(area_fractions: list[float], timestamps: list[float]) -> tuple[str, float]:
    if len(area_fractions) < 2 or max(area_fractions) <= 0:
        return "undetected", 0.0
    window = min(5, len(area_fractions))
    start = float(np.mean(area_fractions[:window]))
    end = float(np.mean(area_fractions[-window:]))
    duration = max(timestamps[-1] - timestamps[0], 1e-6)
    slope = (end - start) / duration
    scale = max(max(area_fractions), 1e-6)
    normalized = slope / scale
    if normalized > 0.015:
        return "growing", min(0.99, 0.55 + normalized * 8)
    if normalized < -0.015:
        return "shrinking", min(0.99, 0.55 + abs(normalized) * 8)
    return "stable", 0.60


def safety_summary(experiment: dict[str, Any] | None, state: str, peak: float, slope: float) -> str:
    if state == "undetected":
        return "No flame pixels were detected. Check the crop, lighting, or video frame selection before drawing a safety conclusion."
    material = experiment.get("fuel_material", "the tested material") if experiment else "the tested material"
    oxygen = experiment.get("initial_oxygen_pct") if experiment else None
    oxygen_text = f" at approximately {oxygen:g}% initial oxygen" if oxygen is not None else ""
    if state == "growing":
        return f"The detected flame is growing on {material}{oxygen_text}. Flag this run for continued observation and suppression analysis."
    if state == "shrinking":
        return f"The detected flame is shrinking on {material}{oxygen_text}. Continue monitoring until extinction is confirmed."
    return f"The detected flame is approximately stable on {material}{oxygen_text}. Treat persistence as an active fire condition."


def review_priority(experiment: dict[str, Any] | None, analysis: dict[str, Any]) -> dict[str, Any]:
    """Rank experiments for human review, not for operational fire decisions."""
    state = analysis.get("state", "undetected")
    peak = float(analysis.get("peak_area_fraction") or 0)
    slope = float(analysis.get("area_slope_per_second") or 0)
    final_co = float((experiment or {}).get("final_co_ppm") or 0)
    state_points = {"growing": 45, "stable": 25, "shrinking": 10, "undetected": 0}.get(state, 0)
    score = min(100.0, state_points + min(25.0, peak * 2500.0) + min(20.0, max(0.0, slope) * 2500.0) + min(10.0, final_co / 100.0))
    reasons = []
    if state == "growing":
        reasons.append("flame area is increasing")
    if state == "stable":
        reasons.append("flame remains persistent")
    if peak > 0.01:
        reasons.append("large peak detected flame area")
    if final_co > 50:
        reasons.append("elevated final CO in the experiment table")
    return {"score": round(score, 1), "reasons": reasons or ["insufficient detected flame signal"], "label": "high review priority" if score >= 60 else "review priority"}


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    experiment_id = str(payload.get("experiment_id", ""))
    frames = payload.get("frames") or []
    if not frames:
        raise ValueError("frames must contain at least one sampled JPEG frame")
    if len(frames) > 240:
        frames = frames[:240]
    experiment = find_experiment(experiment_id) if experiment_id else None
    results = []
    areas = []
    times = []
    for index, frame in enumerate(frames):
        timestamp = float(frame.get("timestamp_s", index))
        image = decode_image(frame["image"])
        _, features = segment_flame(image)
        times.append(timestamp)
        areas.append(features["area_fraction"])
        results.append({"index": index, "timestamp_s": timestamp, **features})
    state, confidence = classify(areas, times)
    slope = (areas[-1] - areas[0]) / max(times[-1] - times[0], 1e-6) if len(areas) > 1 else 0.0
    peak = max(areas) if areas else 0.0
    return {
        "experiment": experiment,
        "analysis": {
            "frame_count": len(results),
            "state": state,
            "confidence": round(confidence, 3),
            "peak_area_fraction": round(peak, 6),
            "area_slope_per_second": round(slope, 6),
            "summary": safety_summary(experiment, state, peak, slope),
            "method": "bright-warm-pixel segmentation with moving-window trend classification",
            "limitations": [
                "Prototype heuristic; not a validated fire-safety predictor.",
                "Camera exposure, background color, and crop affect segmentation.",
                "Results should be checked against the original experiment documentation.",
            ],
        },
        "frames": results,
    }


def rank_results(payload: dict[str, Any]) -> dict[str, Any]:
    ranked = []
    for item in payload.get("results") or []:
        experiment = item.get("experiment") or find_experiment(str(item.get("experiment_id", "")))
        analysis = item.get("analysis") or {}
        priority = review_priority(experiment, analysis)
        ranked.append({"experiment_id": item.get("experiment_id") or (experiment or {}).get("experiment_id"), "experiment": experiment, "analysis": analysis, "priority": priority})
    ranked.sort(key=lambda item: item["priority"]["score"], reverse=True)
    return {
        "summary": {
            "experiments_reviewed": len(ranked),
            "highest_priority": ranked[0]["experiment_id"] if ranked else None,
            "method": "explainable research-review priority from detected flame trend, peak area, CO metadata, and flame persistence",
            "warning": "This ranking prioritizes experiments for investigation. It is not a validated spacecraft hazard score.",
        },
        "ranked": ranked,
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: Any) -> None:
        raw = json.dumps(body, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:
        self._send(204, {})

    def do_GET(self) -> None:
        if self.path == "/api/health":
            return self._send(200, {"ok": True, "service": "flame-analysis", "version": "0.1.0"})
        if self.path == "/api/experiments":
            return self._send(200, {"experiments": load_experiments()})
        self._send(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path not in {"/api/analyze-frames", "/api/rank"}:
            return self._send(404, {"error": "not_found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            self._send(200, analyze(payload) if self.path == "/api/analyze-frames" else rank_results(payload))
        except Exception as exc:  # Keep errors frontend-readable for the demo.
            self._send(400, {"error": str(exc)})

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("[backend] " + (fmt % args) + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"Flame analysis backend listening on http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
