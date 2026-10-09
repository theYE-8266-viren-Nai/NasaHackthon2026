"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Alert, Button, Card, Checkbox, Col, Divider, Drawer, Input, Layout, List, Progress, Row, Select, Space, Statistic, Tag, Typography } from "antd";
import TelemetryCard from "./components/TelemetryCard";
import ResearchCharts from "./components/ResearchCharts";

const ImmersiveHero = dynamic(() => import("./components/ImmersiveHero"), {
  ssr: false,
  loading: () => <section className="immersive-hero hero-loading" aria-label="NASA combustion research introduction" />
});

const { Header, Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;
type Experiment = {
  id: string; investigation: string; title: string; material: string; condition: string; measurements: string[];
  initialOxygenPct: number | null; finalOxygenPct: number | null; oxygenConditionPct: number | null;
  calibratedInitialOxygenPct: number | null; calibratedFinalOxygenPct: number | null;
  initialCoPpm: number | null; finalCoPpm: number | null; initialCo2Pct: number | null; finalCo2Pct: number | null;
  airflowSpeedCmS: number | null; flameSpreadRateMmS: number | null; burnDurationS: number | null; burnLengthCm: number | null;
  averageFlamePowerW: number | null; averageFlamePowerUncertaintyW: number | null;
  finding: string; sourceUrl: string; sourceLabel: string; sourceDoi: string | null; provenance: string; missingMeasurements: string[];
};
type Ranked = { experiment_id: string; priority: { score: number | null; label: string; coverage_pct: number; components: Array<{ label: string; points: number | null; evidence: number | string | null; contribution: number | null }>; reasons: string[] } };
type Frame = { timestamp_s: number; image: string };
type Analysis = { analysis: { state: string; confidence: number; peak_area_fraction: number; area_slope_per_second: number; frame_count: number; summary: string; confidence_note: string; limitations: string[] }; frames: Array<{ timestamp_s: number; area_fraction: number }> };
type Answer = { answer: string; generated: boolean; incompleteEvidence: boolean; sources: Array<{ experimentId: string; sourceUrl: string; sourceTitle: string }> };

export default function Home() {
  const [data, setData] = useState<Experiment[]>([]); const [apiState, setApiState] = useState("loading");
  const [query, setQuery] = useState(""); const [investigation, setInvestigation] = useState("all"); const [measurement, setMeasurement] = useState("all");
  const [selected, setSelected] = useState<string[]>([]); const [ranked, setRanked] = useState<Ranked[]>([]); const [rankError, setRankError] = useState("");
  const [detail, setDetail] = useState<Experiment | null>(null); const [videoFile, setVideoFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false); const [analysis, setAnalysis] = useState<Analysis | null>(null); const [analysisError, setAnalysisError] = useState("");
  const [question, setQuestion] = useState(""); const [answer, setAnswer] = useState<Answer | null>(null); const [asking, setAsking] = useState(false); const [askError, setAskError] = useState("");

  useEffect(() => { fetch("/api/experiments").then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then((payload) => { setData(payload.experiments); setApiState("connected"); }).catch(() => setApiState("error")); }, []);
  useEffect(() => {
    if (!selected.length) { setRanked([]); setRankError(""); return; }
    fetch("/api/rank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ experiments: selected.map((id) => ({ id })) }) })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Ranking is unavailable."); return payload; })
      .then((payload) => { setRanked(payload.ranked ?? []); setRankError(""); })
      .catch((error: Error) => { setRanked([]); setRankError(error.message); });
  }, [selected]);

  const experiments = useMemo(() => data.filter((item) => {
    const text = [item.id, item.investigation, item.material, item.condition, item.finding].join(" ").toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (investigation === "all" || item.investigation === investigation) && (measurement === "all" || item.measurements.includes(measurement));
  }), [data, query, investigation, measurement]);
  const chosen = data.filter((item) => selected.includes(item.id));
  const materials = new Set(data.map((item) => item.material));
  const selectedVideoExperiment = chosen[0];

  async function sampleVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null; event.target.value = ""; setVideoFile(file); setAnalysis(null); setAnalysisError("");
    if (!file) return;
    if (!selectedVideoExperiment) { setAnalysisError("Select an experiment first so the analysis can be linked to its catalog record."); return; }
    setAnalyzing(true);
    const url = URL.createObjectURL(file); const video = document.createElement("video"); video.muted = true; video.preload = "metadata"; video.src = url;
    try {
      await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("The browser could not read this video.")); });
      if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("This video has no readable duration.");
      const count = Math.min(24, Math.max(2, Math.ceil(video.duration / 2))); const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 640); canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
      const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare a frame canvas.");
      const frames: Frame[] = [];
      for (let index = 0; index < count; index += 1) {
        const timestamp = Math.min(video.duration - 0.01, video.duration * index / (count - 1));
        await new Promise<void>((resolve, reject) => { video.onseeked = () => resolve(); video.onerror = () => reject(new Error("Could not sample a video frame.")); video.currentTime = timestamp; });
        context.drawImage(video, 0, 0, canvas.width, canvas.height); frames.push({ timestamp_s: Number(timestamp.toFixed(2)), image: canvas.toDataURL("image/jpeg", 0.72) });
      }
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ experiment_id: selectedVideoExperiment.id, frames }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Frame analysis failed."); setAnalysis(payload);
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : "Video analysis failed."); }
    finally { URL.revokeObjectURL(url); setAnalyzing(false); }
  }

  async function askQuestion() {
    setAsking(true); setAskError(""); setAnswer(null);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, experimentIds: selected }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Could not answer from the selected evidence."); setAnswer(payload);
    } catch (error) { setAskError(error instanceof Error ? error.message : "Could not prepare a grounded answer."); }
    finally { setAsking(false); }
  }

  return <Layout className="app-shell">
    <Header className="app-header"><a className="brand" href="#top"><span className="brand-mark">✦</span><span><b>Flame in Freefall</b><small>NASA microgravity fire research</small></span></a><nav className="primary-nav" aria-label="Main navigation"><a href="#catalog">CATALOG</a><a href="#comparison">COMPARISON</a><a href="#charts">CHARTS</a><a href="#analysis">FRAME ANALYSIS</a></nav><Text className="header-status"><i className={apiState === "connected" ? "live-dot" : "muted-dot"} />API {apiState.toUpperCase()} · PROTOTYPE</Text></Header>
    <Content className="content">
      <div id="top"><ImmersiveHero /></div>
      {apiState === "error" && <Alert message="Experiment API unavailable. Check the dashboard catalog route." type="error" showIcon />}
      <div className="stat-rail" aria-label="Catalog summary"><div><Text className="stat-label">EXPERIMENTS INDEXED</Text><strong>{data.length.toString().padStart(2, "0")}</strong><span>curated records</span></div><div><Text className="stat-label">MATERIALS / GROUPS</Text><strong>{materials.size.toString().padStart(2, "0")}</strong><span>tested in microgravity</span></div><div><Text className="stat-label">SOURCE-BACKED FINDINGS</Text><strong>{data.filter((item) => item.finding).length.toString().padStart(2, "0")}</strong><span>NASA linked</span></div></div>
      <div className="research-layout" id="catalog"><aside className="filter-rail"><Text className="section-kicker">01 / DATA EXPLORER</Text><Title level={2}>Find an experiment</Title><label htmlFor="search-experiments">Search records</label><Input id="search-experiments" placeholder="Material, test, finding..." value={query} onChange={(event) => setQuery(event.target.value)} /><label htmlFor="filter-investigation">Investigation</label><Select id="filter-investigation" value={investigation} onChange={setInvestigation} options={[{ value: "all", label: "All investigations" }, ...[...new Set(data.map((item) => item.investigation))].map((value) => ({ value, label: value }))]} /><label htmlFor="filter-measurement">Available evidence</label><Select id="filter-measurement" value={measurement} onChange={setMeasurement} options={[{ value: "all", label: "Any available measurement" }, ...[...new Set(data.flatMap((item) => item.measurements))].map((value) => ({ value, label: value }))]} /><Divider className="filter-divider" /><Text type="secondary">Choose up to three runs. Missing measurements stay visible and are excluded from calculations.</Text></aside>
        <section className="catalog-panel"><div className="catalog-heading"><div><Text className="section-kicker">CURATED NASA RECORDS</Text><Title level={2}>Experiment catalog</Title></div><Text className="record-count">{experiments.length} / {data.length} records</Text></div><List className="experiment-list" dataSource={experiments} locale={{ emptyText: <div className="state-panel">No records match these filters.</div> }} renderItem={(item) => <List.Item className={`experiment-row ${selected.includes(item.id) ? "is-selected" : ""}`} actions={[<Button key="details" className="detail-link" onClick={() => setDetail(item)}>Inspect <span aria-hidden>↗</span></Button>]}><div className="row-select"><Checkbox aria-label={`Select ${item.id}`} checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id].slice(-3) : selected.filter((id) => id !== item.id))} /></div><List.Item.Meta title={<div className="row-title"><Text strong>{item.id}</Text><Tag className="investigation-label">{item.investigation}</Tag></div>} description={<><Text className="row-condition">{item.material} · {item.condition}</Text><div className="measurement-tags">{item.measurements.map((value) => <Tag key={value}>{value}</Tag>)}</div></>} /></List.Item>} /></section></div>
      <section className="comparison-sheet section-card" id="comparison"><div className="comparison-heading"><div><Text className="section-kicker">02 / DETERMINISTIC REVIEW</Text><Title level={2}>Compare selected evidence</Title></div><Text className="record-count">{chosen.length} selected</Text></div>{!chosen.length ? <div className="state-panel">Select experiments in the catalog to build a comparison.</div> : rankError ? <Alert className="state-alert" message={rankError} type="error" showIcon /> : !ranked.length ? <div className="state-panel">Calculating the evidence-weighted comparison…</div> : <div className="comparison-cards">{ranked.map((item) => { const record = data.find((entry) => entry.id === item.experiment_id); return <TelemetryCard key={item.experiment_id}><Card className="rank-card" size="small"><Text className="rank-investigation">{record?.investigation}</Text><Title level={3}>{item.experiment_id}</Title><div className="rank-score"><strong>{item.priority.score ?? "—"}</strong><span>/ 100<br />review priority</span></div><Tag className="priority-tag">{item.priority.label}</Tag><Progress percent={item.priority.coverage_pct} size="small" format={(value) => `${value}% evidence`} />{item.priority.components.map((part) => <div className="evidence-line" key={part.label}><Text>{part.label}</Text><Text type="secondary">{part.points == null ? "not measured" : `${part.points.toFixed(1)} pts`}{part.evidence != null ? ` · ${part.evidence}` : ""}</Text></div>)}<Paragraph className="rank-reason">{item.priority.reasons.join("; ")}</Paragraph><Button type="link" onClick={() => record && setDetail(record)}>Open source conditions ↗</Button></Card></TelemetryCard>; })}</div>}<Alert className="comparison-warning" type="warning" showIcon message="Prototype research-review priority. This is not a validated hazard score or NASA safety rating." /></section>
      <ResearchCharts experiments={data} />
      <section className="lower-grid section-card" id="analysis"><Card className="hud-card" title={<span><Text className="section-kicker">03 / FRAME ANALYSIS</Text><br />Analyze a video sample</span>}><Paragraph>Choose a catalog experiment, then sample up to 24 evenly spaced frames from a local video. Frames are sent to the Node analysis service.</Paragraph><div className="video-controls"><input className="video-input" type="file" accept="video/*" aria-label="Choose a video for frame analysis" onChange={sampleVideo} disabled={analyzing} /><Text type="secondary">Linked experiment: {selectedVideoExperiment?.id ?? "select one above before analysis"}</Text>{videoFile && <Text className="file-name">{videoFile.name}</Text>}</div>{analyzing && <div className="state-panel">Sampling video frames and analyzing flame area…</div>}{analysisError && <Alert className="state-alert" type="error" showIcon message={analysisError} />}{analysis && <div className="analysis-result"><div className="analysis-metrics"><div><span>TREND</span><strong>{analysis.analysis.state}</strong></div><div><span>HEURISTIC CONFIDENCE</span><strong>{analysis.analysis.confidence}</strong></div><div><span>PEAK FRAME AREA</span><strong>{(analysis.analysis.peak_area_fraction * 100).toFixed(2)}%</strong></div><div><span>FRAMES</span><strong>{analysis.analysis.frame_count}</strong></div></div><Paragraph>{analysis.analysis.summary}</Paragraph><svg className="trend-chart" viewBox="0 0 600 140" role="img" aria-label="Detected flame area trend">{analysis.frames.length > 1 && <><line x1="0" y1="130" x2="600" y2="130" /><polyline fill="none" stroke="#FF5A00" strokeWidth="3" points={analysis.frames.map((frame, index) => `${index * 600 / (analysis.frames.length - 1)},${130 - frame.area_fraction / Math.max(analysis.analysis.peak_area_fraction, 0.000001) * 110}`).join(" ")} /></>}</svg><Text type="secondary">Area trend is normalized within this video. {analysis.analysis.confidence_note}</Text><ul>{analysis.analysis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>}</Card>
        <Card className="hud-card ask-card" title={<span><Text className="section-kicker">04 / GROUNDED INTERPRETATION</Text><br />Ask about the evidence</span>}><Paragraph>Answers use the selected NASA catalog records and link to their sources. Missing values are never inferred.</Paragraph><div className="ask-controls"><Input value={question} onChange={(event) => setQuestion(event.target.value)} onPressEnter={askQuestion} placeholder="What differs between these experiments?" aria-label="Ask about selected NASA evidence" /><Button className="launch-button" loading={asking} disabled={!selected.length || !question.trim()} onClick={askQuestion}>ASK <span aria-hidden>↗</span></Button></div>{askError && <Alert className="state-alert" type="error" message={askError} />}{answer && <div className="answer-panel"><Tag className="priority-tag">{answer.generated ? "AI GENERATED FROM SELECTED RECORDS" : "CATALOG-GROUNDED SUMMARY"}</Tag>{answer.incompleteEvidence && <Alert className="state-alert" type="warning" showIcon message="Incomplete evidence: unavailable values were not inferred." />}<Paragraph className="answer-text">{answer.answer}</Paragraph><div className="source-links">{answer.sources.map((source) => <Link key={source.experimentId} href={source.sourceUrl} target="_blank">{source.experimentId}: {source.sourceTitle} ↗</Link>)}</div></div>}<div className="safety-note"><Text className="section-kicker">RESEARCH CONTEXT</Text><Paragraph>Use these records to identify questions for further review. They do not establish operational fire-response procedures for lunar, Mars, or spacecraft missions.</Paragraph></div></Card></section>
    </Content>
    <Drawer className="source-drawer" title={detail ? `${detail.investigation} · ${detail.id}` : "Experiment details"} open={!!detail} onClose={() => setDetail(null)} width="min(480px, 100vw)">{detail && <Space direction="vertical" size="middle" style={{ width: "100%" }}><Text strong>{detail.material}</Text><Text>{detail.condition}</Text><Text>Measurements reported: {detail.measurements.join(", ") || "none"}</Text><Text>Initial / final oxygen: {detail.initialOxygenPct ?? "not reported"}% / {detail.finalOxygenPct ?? "not reported"}%</Text><Text>Approximate oxygen condition: {detail.oxygenConditionPct ?? "not reported"}%</Text><Text>Flame spread: {detail.flameSpreadRateMmS == null ? "not reported" : `${detail.flameSpreadRateMmS} mm/s`}</Text><Text>Burn duration / length: {detail.burnDurationS == null ? "not reported" : `${detail.burnDurationS} s`} / {detail.burnLengthCm == null ? "not reported" : `${detail.burnLengthCm} cm`}</Text><Text>Average flame power: {detail.averageFlamePowerW == null ? "not reported" : `${detail.averageFlamePowerW} ± ${detail.averageFlamePowerUncertaintyW ?? "unknown"} W`}</Text><Text>Missing measurements: {detail.missingMeasurements.join(", ") || "none in displayed fields"}</Text><Paragraph>{detail.finding}</Paragraph><Paragraph type="secondary">{detail.provenance}</Paragraph><Link href={detail.sourceUrl} target="_blank">{detail.sourceLabel} ↗</Link>{detail.sourceDoi && <Text>DOI: {detail.sourceDoi}</Text>}</Space>}</Drawer>
  </Layout>;
}
