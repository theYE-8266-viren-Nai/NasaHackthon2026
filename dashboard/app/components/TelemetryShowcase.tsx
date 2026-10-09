"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import TelemetryCard from "./TelemetryCard";

const examples = [
  { id: "globe", category: "Surfaces", eyebrow: "GLOBE BROWSING", title: "Mars Surface", description: "A layered view of terrain, scale, and location for exploring planetary environments.", art: "visual-art-mars", source: "Illustrative interface concept · not a NASA Mars dataset" },
  { id: "catalogs", category: "Catalogs", eyebrow: "CATALOGS", title: "Asteroid Trajectories", description: "A searchable orbital catalog view designed to make large datasets easier to compare.", art: "visual-art-asteroids", source: "Illustrative interface concept · not a live trajectory feed" },
  { id: "helio", category: "Heliophysics", eyebrow: "HELIOPHYSICS", title: "Solar Magnetic Lines", description: "A field-line visualization concept for inspecting complex space-weather structures.", art: "visual-art-solar", source: "Illustrative interface concept · no magnetic-field data plotted" },
  { id: "mission", category: "Missions", eyebrow: "MISSION VISUALIZATIONS", title: "JWST Unfolding", description: "A mission-timeline presentation concept that makes engineering sequences easier to follow.", art: "visual-art-jwst", source: "Illustrative interface concept · not a JWST animation" },
];
const filters = ["All", "Surfaces", "Catalogs", "Heliophysics", "Missions"];

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
  const visibleExamples = useMemo(() => examples.filter((example) => activeFilter === "All" || example.category === activeFilter), [activeFilter]);
  const selectedExample = examples.find((example) => example.id === activeExample) ?? examples[0];

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
      <p>Explore four illustrative space-science interface concepts. Real NASA combustion records and source-linked measurements are shown in the research charts below.</p>
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

  </section>;
}
