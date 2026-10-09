"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Col, Drawer, Input, Layout, List, Progress, Row, Select, Space, Statistic, Tag, Typography } from "antd";
import ImmersiveHero from "./components/ImmersiveHero";

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
    <Header className="app-header"><div className="brand"><span className="brand-mark">✦</span><span><b>Flame in Freefall</b><small>NASA microgravity fire research</small></span></div><Text type="secondary">API {apiState} · prototype</Text></Header>
    <Content className="content">
      <ImmersiveHero />
      <section className="hero"><div><Text className="eyebrow">COMBUSTION SCIENCE / DECISION SUPPORT</Text><Title>See how fire behaves when gravity gets out of the way.</Title><Paragraph>Find, compare, and understand NASA microgravity fire experiments. Missing measurements stay visible.</Paragraph></div><Card size="small"><Text type="secondary">STARTING POINT</Text><Title level={3}>Saffire-I</Title><Link href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" target="_blank">Open NASA PSI entry ↗</Link></Card></section>
      {apiState === "error" && <Alert message="Experiment API unavailable. Check the dashboard catalog route." type="error" showIcon />}
      <Row gutter={[16, 16]} className="stats"><Col xs={24} md={8}><Card><Statistic title="Experiments indexed" value={data.length} suffix={<Text type="secondary">curated</Text>} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Materials / groups" value={materials.size} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Source-backed findings" value={data.filter((item) => item.finding).length} /></Card></Col></Row>
      <Row gutter={[16, 16]}><Col xs={24} md={7}><Card title="Find experiments"><Space direction="vertical" style={{ width: "100%" }}><Input placeholder="Material, test, finding..." value={query} onChange={(event) => setQuery(event.target.value)} /><Select value={investigation} style={{ width: "100%" }} onChange={setInvestigation} options={[{ value: "all", label: "All investigations" }, ...[...new Set(data.map((item) => item.investigation))].map((value) => ({ value, label: value }))]} /><Select value={measurement} style={{ width: "100%" }} onChange={setMeasurement} options={[{ value: "all", label: "Any available measurement" }, ...[...new Set(data.flatMap((item) => item.measurements))].map((value) => ({ value, label: value }))]} /></Space></Card></Col>
        <Col xs={24} md={17}><Card title="Experiment catalog" extra={<Text type="secondary">{experiments.length} shown · select up to 3</Text>}><List dataSource={experiments} renderItem={(item) => <List.Item actions={[<Button key="details" type="link" onClick={() => setDetail(item)}>Details</Button>]}><List.Item.Meta title={<Space><Checkbox checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id].slice(-3) : selected.filter((id) => id !== item.id))} /><Text strong>{item.id}</Text><Tag color="orange">{item.investigation}</Tag></Space>} description={<><Text type="secondary">{item.material} · {item.condition}</Text><br />{item.measurements.map((value) => <Tag key={value}>{value}</Tag>)}</>} /></List.Item>} /></Card></Col></Row>
      <Card title="Comparison workspace" className="section-card">{!chosen.length ? <Alert message="Select experiments above to compare available evidence." type="info" /> : rankError ? <Alert message={rankError} type="error" showIcon /> : <><Row gutter={[16, 16]}>{ranked.map((item) => { const record = data.find((entry) => entry.id === item.experiment_id); return <Col xs={24} md={8} key={item.experiment_id}><Card size="small"><Text strong>{record?.investigation} · {item.experiment_id}</Text><Statistic title="Prototype review priority" value={item.priority.score ?? "—"} suffix={item.priority.score == null ? "" : "/ 100"} /><Tag color={item.priority.coverage_pct < 50 ? "orange" : "blue"}>{item.priority.label}</Tag><Progress percent={item.priority.coverage_pct} size="small" format={(value) => `${value}% evidence`} />{item.priority.components.map((part) => <Paragraph key={part.label} style={{ marginBottom: 4 }}><Text>{part.label}: </Text><Text type="secondary">{part.points == null ? "not measured" : `${part.points.toFixed(1)} points`}{part.evidence != null ? ` · evidence ${part.evidence}` : ""}</Text></Paragraph>)}<Paragraph type="secondary">{item.priority.reasons.join("; ")}</Paragraph><Button type="link" onClick={() => record && setDetail(record)}>Source and conditions</Button></Card></Col>; })}</Row><Alert type="warning" showIcon message="Prototype research-review priority. This is not a validated hazard score or NASA safety rating." /></>}</Card>
      <Card title="Analyze a video sample" className="section-card"><Paragraph>Choose a catalog experiment, then sample up to 24 evenly spaced frames from a local video. Frames are sent to the Node analysis service.</Paragraph><Space wrap><input type="file" accept="video/*" onChange={sampleVideo} disabled={analyzing || !selectedVideoExperiment} /><Text type="secondary">Linked experiment: {selectedVideoExperiment?.id ?? "select one above"}</Text>{videoFile && <Text>{videoFile.name}</Text>}</Space>{analysisError && <Alert className="section-card" type="error" showIcon message={analysisError} />}{analysis && <><Row gutter={16} className="section-card"><Col><Statistic title="Trend" value={analysis.analysis.state} /></Col><Col><Statistic title="Heuristic confidence" value={analysis.analysis.confidence} /></Col><Col><Statistic title="Peak frame area" value={`${(analysis.analysis.peak_area_fraction * 100).toFixed(2)}%`} /></Col><Col><Statistic title="Sampled frames" value={analysis.analysis.frame_count} /></Col></Row><Paragraph>{analysis.analysis.summary}</Paragraph><svg viewBox="0 0 600 140" role="img" aria-label="Detected flame area trend" style={{ width: "100%", height: 150, background: "#f5f6f8", borderRadius: 8 }}>{analysis.frames.length > 1 && <polyline fill="none" stroke="#e85d24" strokeWidth="3" points={analysis.frames.map((frame, index) => `${index * 600 / (analysis.frames.length - 1)},${130 - frame.area_fraction / Math.max(analysis.analysis.peak_area_fraction, 0.000001) * 110}`).join(" ")} />}</svg><Text type="secondary">Area trend is normalized within this video. {analysis.analysis.confidence_note}</Text><ul>{analysis.analysis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></>}</Card>
      <Card title="Ask about the selected evidence" className="section-card"><Paragraph>Answers are grounded in the selected NASA catalog records. With OPENAI_API_KEY configured, the server generates a cited explanation; otherwise it returns a source-linked catalog summary.</Paragraph><Space.Compact style={{ width: "100%" }}><Input value={question} onChange={(event) => setQuestion(event.target.value)} onPressEnter={askQuestion} placeholder="What differs between these experiments?" /><Button type="primary" loading={asking} disabled={!selected.length || !question.trim()} onClick={askQuestion}>Ask</Button></Space.Compact>{askError && <Alert className="section-card" type="error" message={askError} />}{answer && <div className="section-card"><Tag color={answer.generated ? "blue" : "default"}>{answer.generated ? "AI generated from selected records" : "Catalog grounded summary"}</Tag>{answer.incompleteEvidence && <Alert className="section-card" type="warning" showIcon message="Incomplete evidence: unavailable values were not inferred." />}<Paragraph style={{ whiteSpace: "pre-wrap" }}>{answer.answer}</Paragraph><Space wrap>{answer.sources.map((source) => <Link key={source.experimentId} href={source.sourceUrl} target="_blank">{source.experimentId}: {source.sourceTitle} ↗</Link>)}</Space></div>}</Card>
      <Card className="section-card"><Text className="eyebrow">FIRE SAFETY CONTEXT</Text><Title level={3}>Evidence first, guidance second.</Title><Paragraph>Use these records to identify questions for further review. They do not establish operational fire-response procedures for lunar, Mars, or spacecraft missions.</Paragraph><Alert message="Decision support only. Incomplete evidence is not converted into a certified spacecraft safety procedure." type="warning" showIcon /></Card>
    </Content>
    <Drawer title={detail ? `${detail.investigation} · ${detail.id}` : "Experiment details"} open={!!detail} onClose={() => setDetail(null)} width={480}>{detail && <Space direction="vertical" size="middle" style={{ width: "100%" }}><Text strong>{detail.material}</Text><Text>{detail.condition}</Text><Text>Measurements reported: {detail.measurements.join(", ") || "none"}</Text><Text>Initial / final oxygen: {detail.initialOxygenPct ?? "not reported"}% / {detail.finalOxygenPct ?? "not reported"}%</Text><Text>Approximate oxygen condition: {detail.oxygenConditionPct ?? "not reported"}%</Text><Text>Flame spread: {detail.flameSpreadRateMmS == null ? "not reported" : `${detail.flameSpreadRateMmS} mm/s`}</Text><Text>Burn duration / length: {detail.burnDurationS == null ? "not reported" : `${detail.burnDurationS} s`} / {detail.burnLengthCm == null ? "not reported" : `${detail.burnLengthCm} cm`}</Text><Text>Average flame power: {detail.averageFlamePowerW == null ? "not reported" : `${detail.averageFlamePowerW} ± ${detail.averageFlamePowerUncertaintyW ?? "unknown"} W`}</Text><Text>Missing measurements: {detail.missingMeasurements.join(", ") || "none in displayed fields"}</Text><Paragraph>{detail.finding}</Paragraph><Paragraph type="secondary">{detail.provenance}</Paragraph><Link href={detail.sourceUrl} target="_blank">{detail.sourceLabel} ↗</Link>{detail.sourceDoi && <Text>DOI: {detail.sourceDoi}</Text>}</Space>}</Drawer>
  </Layout>;
}
