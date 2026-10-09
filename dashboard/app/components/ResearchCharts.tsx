"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type ChartExperiment = {
  id: string;
  investigation: string;
  material: string;
  sourceUrl: string;
  sourceLabel: string;
  initialOxygenPct: number | null;
  finalOxygenPct: number | null;
  oxygenConditionPct: number | null;
  flameSpreadRateMmS: number | null;
  burnDurationS: number | null;
  burnLengthCm: number | null;
  averageFlamePowerW: number | null;
};

type MetricKey = "flameSpreadRateMmS" | "burnDurationS" | "burnLengthCm" | "averageFlamePowerW";

const metricOptions: Array<{ value: MetricKey; label: string; unit: string }> = [
  { value: "flameSpreadRateMmS", label: "Flame spread rate", unit: "mm/s" },
  { value: "burnDurationS", label: "Burn duration", unit: "s" },
  { value: "burnLengthCm", label: "Burn length", unit: "cm" },
  { value: "averageFlamePowerW", label: "Average flame power", unit: "W" }
];

const colors = ["#FF5500", "#FFB000", "#FFFFFF", "#FF7A45", "#FFD166"];

export default function ResearchCharts({ experiments }: { experiments: ChartExperiment[] }) {
  const [investigation, setInvestigation] = useState("all");
  const [metric, setMetric] = useState<MetricKey>("flameSpreadRateMmS");
  const investigations = useMemo(() => [...new Set(experiments.map((item) => item.investigation))], [experiments]);
  const visible = useMemo(() => investigation === "all" ? experiments : experiments.filter((item) => item.investigation === investigation), [experiments, investigation]);
  const selectedMetric = metricOptions.find((item) => item.value === metric) ?? metricOptions[0];
  const metricRows = visible.flatMap((item) => {
    const value = item[metric];
    return typeof value === "number" ? [{ id: item.id, investigation: item.investigation, material: item.material, value, unit: selectedMetric.unit, sourceUrl: item.sourceUrl, sourceLabel: item.sourceLabel }] : [];
  });
  const fuelCounts = useMemo(() => {
    const counts = new Map<string, { fuel: string; count: number; sourceUrl: string }>();
    for (const item of visible) {
      const fuel = item.material || "Unknown material";
      const current = counts.get(fuel);
      counts.set(fuel, { fuel, count: (current?.count ?? 0) + 1, sourceUrl: item.sourceUrl });
    }
    return [...counts.values()];
  }, [visible]);
  const oxygenRateRows = visible.flatMap((item) => {
    const oxygen = item.oxygenConditionPct ?? item.initialOxygenPct;
    return oxygen != null && item.flameSpreadRateMmS != null ? [{ id: item.id, oxygen, rate: item.flameSpreadRateMmS, sourceUrl: item.sourceUrl }] : [];
  });

  return <section className="research-charts section-card" id="charts" aria-labelledby="charts-heading">
    <div className="comparison-heading"><div><span className="section-kicker">05 / SOURCE-TRACEABLE VISUALS</span><h2 id="charts-heading">Read the reported measurements</h2></div><span className="record-count">{visible.length} records in view</span></div>
    <div className="chart-toolbar" role="group" aria-label="Chart filters">
      <label>Investigation<select value={investigation} onChange={(event) => setInvestigation(event.target.value)}><option value="all">All investigations</option>{investigations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Reported metric<select value={metric} onChange={(event) => setMetric(event.target.value as MetricKey)}>{metricOptions.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.unit})</option>)}</select></label>
    </div>
    <div className="chart-grid">
      <article className="chart-panel"><div className="chart-heading"><div><h3>Outcome count by material</h3><p>Curated records grouped by reported fuel material.</p></div><span>n = {visible.length}</span></div>{fuelCounts.length ? <div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={fuelCounts} margin={{ top: 8, right: 18, bottom: 42, left: 0 }}><CartesianGrid stroke="#343A45" strokeDasharray="3 3" /><XAxis dataKey="fuel" angle={-18} textAnchor="end" interval={0} tick={{ fill: "#B7C0CC", fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: "#B7C0CC", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#0C0E12", border: "2px solid #FF5500", color: "#FFFFFF" }} /><Bar dataKey="count" name="Records" fill="#FF5500">{fuelCounts.map((item, index) => <Cell key={item.fuel} fill={colors[index % colors.length]} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="chart-empty">No material records match this filter.</div>}<p className="chart-source">Each bar links to the source record in the experiment detail panel.</p></article>
      <article className="chart-panel"><div className="chart-heading"><div><h3>O₂ condition vs spread rate</h3><p>Only records with both reported values are plotted.</p></div><span>{oxygenRateRows.length} points</span></div>{oxygenRateRows.length ? <div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 8, right: 18, bottom: 28, left: 0 }}><CartesianGrid stroke="#343A45" strokeDasharray="3 3" /><XAxis type="number" dataKey="oxygen" name="O₂" unit="%" tick={{ fill: "#B7C0CC", fontSize: 10 }} /><YAxis type="number" dataKey="rate" name="Spread rate" unit=" mm/s" tick={{ fill: "#B7C0CC", fontSize: 10 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#0C0E12", border: "2px solid #FFB000", color: "#FFFFFF" }} /><Legend wrapperStyle={{ color: "#FFFFFF", fontSize: 11 }} /><Scatter name="NASA reported records" data={oxygenRateRows} fill="#FFB000" /></ScatterChart></ResponsiveContainer></div> : <div className="chart-empty"><strong>Insufficient evidence</strong><br />No visible record reports both oxygen condition and flame spread rate. Missing values are not inferred.</div>}<p className="chart-source">This is a compatibility view, not a causal relationship or safety threshold.</p></article>
      <article className="chart-panel chart-wide"><div className="chart-heading"><div><h3>{selectedMetric.label}</h3><p>Reported aggregate values only; frame-derived measurements are kept separate.</p></div><span>{metricRows.length} reported</span></div>{metricRows.length ? <div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={metricRows} margin={{ top: 8, right: 18, bottom: 42, left: 0 }}><CartesianGrid stroke="#343A45" strokeDasharray="3 3" /><XAxis dataKey="id" tick={{ fill: "#B7C0CC", fontSize: 10 }} /><YAxis unit={` ${selectedMetric.unit}`} tick={{ fill: "#B7C0CC", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#0C0E12", border: "2px solid #FF5500", color: "#FFFFFF" }} formatter={(value) => [`${value ?? "—"} ${selectedMetric.unit}`, selectedMetric.label]} /><Bar dataKey="value" name={selectedMetric.label} fill="#FFB000" /></BarChart></ResponsiveContainer></div> : <div className="chart-empty"><strong>Metric unavailable in the curated slice</strong><br />No {selectedMetric.label.toLowerCase()} value is reported for the selected investigation.</div>}<div className="chart-citations">{metricRows.map((item) => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer">{item.id} · {item.sourceLabel} ↗</a>)}</div></article>
    </div>
    <p className="chart-disclaimer">Charts use NASA-reported aggregate values only. They do not combine incompatible investigations, convert missing fields into estimates, or represent a NASA-approved hazard rating.</p>
  </section>;
}
