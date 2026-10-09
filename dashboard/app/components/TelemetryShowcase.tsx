"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleHelp } from "lucide-react";
import TelemetryCard from "./TelemetryCard";

type OutcomeRow = { fuel: string; outcome: string; count: number };
type ScatterPoint = { experimentId: string; testId: string; sampleId: string; fuel: string; oxygenPct: number; burningRateValue: number; burningRateUnit: string; sourceUrl: string; sourceTitle: string };
type VisualizationPayload = {
  dataset: { title: string; sourceUrl: string; sourceDoi: string; reportUrl: string; recordCount: number; metricNotes: string[] };
  outcomeCountsByFuel: OutcomeRow[];
  oxygenBurningRate: ScatterPoint[];
};

const examples = [
  { id: "globe", category: "Surfaces", eyebrow: "GLOBE BROWSING", title: "Mars Surface", description: "A layered view of terrain, scale, and location for exploring planetary environments.", art: "visual-art-mars", source: "Illustrative interface concept · not a NASA Mars dataset" },
  { id: "catalogs", category: "Catalogs", eyebrow: "CATALOGS", title: "Asteroid Trajectories", description: "A searchable orbital catalog view designed to make large datasets easier to compare.", art: "visual-art-asteroids", source: "Illustrative interface concept · not a live trajectory feed" },
  { id: "helio", category: "Heliophysics", eyebrow: "HELIOPHYSICS", title: "Solar Magnetic Lines", description: "A field-line visualization concept for inspecting complex space-weather structures.", art: "visual-art-solar", source: "Illustrative interface concept · no magnetic-field data plotted" },
  { id: "mission", category: "Missions", eyebrow: "MISSION VISUALIZATIONS", title: "JWST Unfolding", description: "A mission-timeline presentation concept that makes engineering sequences easier to follow.", art: "visual-art-jwst", source: "Illustrative interface concept · not a JWST animation" },
];
const filters = ["All", "Surfaces", "Catalogs", "Heliophysics", "Missions"];
const outcomeColors: Record<string, string> = { Extinction: "#ff5722", Disruption: "#f4bf44", Completion: "#6fc9a0" };

function OutcomeBars({ rows }: { rows: OutcomeRow[] }) {
  const fuels = [...new Set(rows.map((row) => row.fuel))];
  const outcomes = ["Extinction", "Disruption", "Completion"];
  return <div className="outcome-chart" role="img" aria-label="FLEX outcome counts by fuel">
    {fuels.map((fuel) => {
      const values = outcomes.map((outcome) => ({ outcome, count: rows.find((row) => row.fuel === fuel && row.outcome === outcome)?.count ?? 0 }));
      const total = values.reduce((sum, value) => sum + value.count, 0);
      return <div className="outcome-row" key={fuel}>
        <div className="outcome-row-label"><span>{fuel}</span><b>{total} TESTS</b></div>
        <div className="outcome-stack" aria-label={`${fuel}: ${values.map((value) => `${value.count} ${value.outcome}`).join(", ")}`}>
          {values.map(({ outcome, count }) => count > 0 && <span key={outcome} title={`${fuel}: ${count} ${outcome}`} style={{ width: `${count / Math.max(total, 1) * 100}%`, background: outcomeColors[outcome] }} />)}
        </div>
        <div className="outcome-counts">{values.map(({ outcome, count }) => <span key={outcome}><i style={{ background: outcomeColors[outcome] }} />{outcome} {count}</span>)}</div>
      </div>;
    })}
  </div>;
}

function OxygenRateScatter({ points }: { points: ScatterPoint[] }) {
  if (!points.length) return <div className="chart-empty">No records contain both oxygen and a burning-rate value.</div>;
  const xs = points.map((point) => point.oxygenPct); const ys = points.map((point) => point.burningRateValue);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const xPosition = (value: number) => 48 + (value - minX) / Math.max(maxX - minX, 0.000001) * 544;
  const yPosition = (value: number) => 198 - (value - minY) / Math.max(maxY - minY, 0.000001) * 154;
  return <svg className="scatter-chart" viewBox="0 0 640 242" preserveAspectRatio="none" role="img" aria-label="Initial oxygen percentage compared with source-reported FLEX burning-rate values">
    <line x1="48" y1="198" x2="592" y2="198" /><line x1="48" y1="44" x2="48" y2="198" />
    <text x="48" y="222">{minX.toFixed(1)}%</text><text x="544" y="222">{maxX.toFixed(1)}%</text><text x="48" y="30">SOURCE VALUE / {minY.toFixed(2)}–{maxY.toFixed(2)}</text>
    {points.map((point) => <circle key={point.experimentId} cx={xPosition(point.oxygenPct)} cy={yPosition(point.burningRateValue)} r="3.2" fill={point.fuel === "Methanol" ? "#ff5722" : "#e8f0fb"} fillOpacity=".72" stroke="#0c0e12" strokeWidth="1"><title>{`${point.experimentId} · ${point.fuel} · ${point.oxygenPct}% O₂ · ${point.burningRateValue} ${point.burningRateUnit} · ${point.sourceTitle}`}</title></circle>)}
    <text x="300" y="239">INITIAL OXYGEN / MOLE-FRACTION × 100 (%)</text>
  </svg>;
}

function VisualizationArt({ kind }: { kind: string }) {
  return <div className={`visual-art ${kind}`} aria-hidden="true">
    {kind === "visual-art-mars" && <><span className="mars-sphere" /><svg viewBox="0 0 520 220"><path d="M0 147C84 88 133 174 205 119S350 71 520 119M-10 184c103-62 144 19 236-31s169-61 304-15M40 80c87 32 118-29 189-2s157 49 257 2" /></svg><span className="art-coordinate">22°N / 14°E</span></>}
    {kind === "visual-art-asteroids" && <><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" /><i className="asteroid asteroid-one" /><i className="asteroid asteroid-two" /><i className="asteroid asteroid-three" /><b className="orbit-sun" /></>}
    {kind === "visual-art-solar" && <><span className="solar-core" /><svg viewBox="0 0 520 220"><path d="M260 110C100 15 95 208 260 110s160-96 160 0-160 96-160 0-95-96-95 0 95 96 255 0M260 110C195 28 175 38 178 110s17 82 82 0 82-82 82 0-17 82-82 0" /></svg><span className="art-coordinate">FIELD / MODEL VIEW</span></>}
    {kind === "visual-art-jwst" && <><div className="telescope-mirror"><i /><i /><i /><i /><i /><i /><i /></div><span className="telescope-boom" /><span className="telescope-shield" /><span className="art-coordinate">SEQUENCE / DEPLOYMENT</span></>}
  </div>;
}

export default function TelemetryShowcase() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeExample, setActiveExample] = useState("globe");
  const [payload, setPayload] = useState<VisualizationPayload | null>(null);
  const [dataState, setDataState] = useState<"loading" | "ready" | "error">("loading");
  const visibleExamples = useMemo(() => examples.filter((example) => activeFilter === "All" || example.category === activeFilter), [activeFilter]);
  const selectedExample = examples.find((example) => example.id === activeExample) ?? examples[0];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visualizations?investigation=FLEX").then(async (response) => {
      if (!response.ok) throw new Error("NASA FLEX visualization data is unavailable.");
      return response.json() as Promise<VisualizationPayload>;
    }).then((result) => { if (!cancelled) { setPayload(result); setDataState("ready"); } }).catch(() => { if (!cancelled) setDataState("error"); });
    return () => { cancelled = true; };
  }, []);

  function changeFilter(filter: string) {
    setActiveFilter(filter);
    const next = examples.find((example) => filter === "All" || example.category === filter);
    if (next) setActiveExample(next.id);
  }

  function stepExample(direction: number) {
    const currentIndex = examples.findIndex((example) => example.id === activeExample);
    const nextIndex = (currentIndex + direction + examples.length) % examples.length;
    const next = examples[nextIndex];
    setActiveExample(next.id);
    setActiveFilter("All");
  }

  return <section className="showcase-section content-section" id="showcase" aria-labelledby="showcase-title">
    <div className="section-heading-row showcase-heading">
      <div><p className="section-kicker">02 / SEE WHAT’S POSSIBLE</p><h2 id="showcase-title">One source. Many ways to see it.</h2></div>
      <p>Explore interface concepts, then inspect the NASA FLEX measurements that power this project’s fire-safety research views.</p>
    </div>
    <div className="showcase-controls" aria-label="Filter visualization concepts">
      <div className="showcase-filters">{filters.map((filter) => <button type="button" key={filter} className={activeFilter === filter ? "is-active" : ""} aria-pressed={activeFilter === filter} onClick={() => changeFilter(filter)}>{filter}</button>)}</div>
      <div className="showcase-arrows"><button type="button" aria-label="Previous visualization" onClick={() => stepExample(-1)}><ArrowLeft size={16} /></button><span>{String(examples.findIndex((item) => item.id === activeExample) + 1).padStart(2, "0")} / 04</span><button type="button" aria-label="Next visualization" onClick={() => stepExample(1)}><ArrowRight size={16} /></button></div>
    </div>
    <div className="visualization-grid">
      {visibleExamples.map((example) => <TelemetryCard className="visualization-tilt" key={example.id}>
        <button type="button" className={`visualization-card ${activeExample === example.id ? "is-selected" : ""}`} aria-pressed={activeExample === example.id} onClick={() => setActiveExample(example.id)}>
          <VisualizationArt kind={example.art} />
          <span className="visualization-card-copy"><span className="visualization-eyebrow">{example.eyebrow}</span><strong>{example.title}</strong><span>{example.description}</span><small>{example.source}</small></span>
        </button>
      </TelemetryCard>)}
    </div>
    <div className="showcase-selection" aria-live="polite"><span className="signal-dot" /><span>SELECTED VIEW /</span><b>{selectedExample.eyebrow} — {selectedExample.title}</b><span className="showcase-selection-source">Concept preview · no live mission feed</span></div>

    <div className="flex-data-panel">
      <div className="flex-data-heading"><div><p className="section-kicker">SOURCE DATA / FLEX · PSI-69</p><h3>Combustion outcomes under test conditions.</h3></div><a href={payload?.dataset.sourceUrl ?? "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69"} target="_blank" rel="noreferrer">OPEN NASA SOURCE <ArrowUpRight size={14} /></a></div>
      {dataState === "loading" && <div className="chart-state" aria-live="polite">Reading source-backed FLEX records…</div>}
      {dataState === "error" && <div className="chart-state chart-state-error"><CircleHelp size={16} /> FLEX visualizations are unavailable. See the NASA PSI-69 source directly.</div>}
      {dataState === "ready" && payload && <>
        <div className="flex-dataset-status"><strong>{payload.dataset.recordCount}</strong><span>downloaded PSI-69 test rows</span><span className="dataset-doi">DOI {payload.dataset.sourceDoi}</span><span>274 rows; source scopes differ from the NTRS report</span></div>
        <div className="flex-chart-grid">
          <article className="flex-chart-card"><div className="chart-title"><div><span>01 / DISTRIBUTION</span><h4>Recorded test outcomes</h4></div><span>COUNT / FUEL</span></div><OutcomeBars rows={payload.outcomeCountsByFuel} /><div className="chart-source">Counts are deterministic tallies of reported PSI-69 test-end labels. <a href={payload.dataset.sourceUrl} target="_blank" rel="noreferrer">Source: NASA PSI-69 ↗</a></div></article>
          <article className="flex-chart-card"><div className="chart-title"><div><span>02 / CONDITION COMPARISON</span><h4>Oxygen vs. reported burning rate</h4></div><span>{payload.oxygenBurningRate.length} PAIRED RECORDS</span></div><OxygenRateScatter points={payload.oxygenBurningRate} /><div className="chart-legend"><span><i className="legend-methanol" />Methanol</span><span><i className="legend-heptane" />Heptane</span></div><div className="chart-source"><strong>Unit note:</strong> {payload.dataset.metricNotes[0]} <a href={payload.dataset.reportUrl} target="_blank" rel="noreferrer">Read NASA report ↗</a></div></article>
        </div>
        <p className="prototype-disclaimer">These are experimental results for review and research. They do not establish a NASA hazard rating or a spacecraft fire-safety limit.</p>
      </>}
    </div>
  </section>;
}
