"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, Button, Card, Checkbox, Col, Divider, Empty, Input, Layout, List,
  Row, Select, Space, Spin, Tag, Typography
} from "antd";
import { ArrowUpRight, Filter, Flame, Search, ShieldCheck } from "lucide-react";

const { Header, Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;

type Experiment = {
  id: string; investigation: string; title: string; material: string; condition: string;
  measurements: string[]; initialOxygenPct: number | null; finalOxygenPct: number | null;
  initialCoPpm: number | null; finalCoPpm: number | null; finding: string;
  sourceUrl: string; sourceLabel: string;
};

function comparisonScore(item: Experiment) {
  const oxygen = item.initialOxygenPct == null || item.finalOxygenPct == null ? null : Math.abs(item.finalOxygenPct - item.initialOxygenPct) * 20;
  const co = item.initialCoPpm == null || item.finalCoPpm == null ? null : Math.max(0, item.finalCoPpm - item.initialCoPpm) / 2;
  const values = [oxygen, co].filter((value): value is number => value != null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export default function Home() {
  const [data, setData] = useState<Experiment[]>([]);
  const [query, setQuery] = useState("");
  const [investigation, setInvestigation] = useState("all");
  const [measurement, setMeasurement] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Experiment | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch("/api/experiments").then((response) => {
      if (!response.ok) throw new Error("Experiment API returned an error.");
      return response.json();
    }).then((payload) => {
      setData(payload.experiments ?? []);
      setStatus("ready");
    }).catch(() => setStatus("error"));
  }, []);

  const experiments = useMemo(() => data.filter((item) => {
    const searchable = [item.id, item.title, item.material, item.condition, item.finding].join(" ").toLowerCase();
    return (!query || searchable.includes(query.toLowerCase())) &&
      (investigation === "all" || item.investigation === investigation) &&
      (measurement === "all" || item.measurements.includes(measurement));
  }), [data, query, investigation, measurement]);
  const chosen = data.filter((item) => selected.includes(item.id));
  const materials = new Set(data.map((item) => item.material));
  const investigations = [...new Set(data.map((item) => item.investigation))].map((value) => ({ value, label: value }));
  const measurements = [...new Set(data.flatMap((item) => item.measurements))].sort().map((value) => ({ value, label: value }));

  function toggleSelection(id: string, checked: boolean) {
    if (checked && selected.length >= 3) return;
    setSelected(checked ? [...selected, id] : selected.filter((item) => item !== id));
  }

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <a className="brand" href="/"><span className="brand-mark"><Flame size={18} strokeWidth={2.2} /></span><span><b>Flame in Freefall</b><small>NASA combustion field notes</small></span></a>
        <nav className="primary-nav" aria-label="Primary navigation"><a className="active" href="#catalog">Experiments</a><a href="#comparison">Compare</a><a href="#interpretation">Interpret</a></nav>
        <div className="header-status"><span className={status === "ready" ? "live-dot" : "muted-dot"} /> {status === "ready" ? "Catalog live" : "Catalog loading"}</div>
      </Header>
      <Content className="content">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy"><Text className="eyebrow">MICROGRAVITY COMBUSTION / RESEARCH INDEX</Text><Title id="page-title">Fire behaves differently when buoyancy disappears.</Title><Paragraph>Trace NASA’s experiments from raw conditions to defensible insight. Search the catalog, compare only what was measured, and keep uncertainty in view.</Paragraph><Space className="hero-actions" wrap><Button type="primary" href="#catalog" icon={<Search size={16} />}>Explore the catalog</Button><Button href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" target="_blank" icon={<ArrowUpRight size={15} />}>Open Saffire-I source</Button></Space></div>
          <aside className="hero-note"><div className="note-line"><ShieldCheck size={17} /><span>Evidence-led by design</span></div><Title level={3}>No invented measurements.</Title><Paragraph>Values shown here come from the curated NASA record. When a field is absent, the interface says so.</Paragraph><Text className="source-caption">STARTING POINT</Text><Link href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" target="_blank">Saffire-I / PSI-98 <ArrowUpRight size={13} /></Link></aside>
        </section>
        <section className="stat-rail" aria-label="Catalog summary"><div><Text className="stat-label">Experiments indexed</Text><strong>{data.length}</strong><Text> curated records</Text></div><div><Text className="stat-label">Material groups</Text><strong>{materials.size}</strong><Text> in the current slice</Text></div><div><Text className="stat-label">Source-backed findings</Text><strong>{data.filter((item) => item.finding).length}</strong><Text> with provenance</Text></div></section>
        <section id="catalog" className="research-layout" aria-labelledby="catalog-heading">
          <aside className="filter-rail"><div className="section-kicker"><Filter size={14} /> REFINE THE EVIDENCE</div><Title id="catalog-heading" level={2}>Find an experiment</Title><label htmlFor="search">Search the catalog</label><Input id="search" aria-label="Search experiments" prefix={<Search size={15} />} placeholder="Material, test, finding" value={query} onChange={(event) => setQuery(event.target.value)} /><label htmlFor="investigation">Investigation</label><Select id="investigation" aria-label="Filter by investigation" value={investigation} onChange={setInvestigation} options={[{ value: "all", label: "All investigations" }, ...investigations]} /><label htmlFor="measurement">Available measurement</label><Select id="measurement" aria-label="Filter by available measurement" value={measurement} onChange={setMeasurement} options={[{ value: "all", label: "Any measurement" }, ...measurements]} /><Divider /><Text type="secondary">Select up to three rows to open a comparison sheet. Numeric scores are transparent and provisional.</Text></aside>
          <div className="catalog-pane"><div className="catalog-heading"><div><Text className="section-kicker">NASA PSI CATALOG</Text><Title level={2}>Experiments</Title></div><Text type="secondary">{experiments.length} shown · {selected.length} selected</Text></div>{status === "loading" && <div className="state-panel"><Spin size="large" /><Text>Loading the NASA-derived catalog…</Text></div>}{status === "error" && <Alert className="state-alert" type="error" showIcon message="The experiment catalog could not be loaded." description="Restart the Next.js app and verify the catalog API route." action={<Button size="small" onClick={() => location.reload()}>Retry</Button>} />}{status === "ready" && experiments.length === 0 && <Empty className="state-panel" description="No experiments match these filters." />}{status === "ready" && experiments.length > 0 && <List className="experiment-list" dataSource={experiments} renderItem={(item) => <List.Item className={selected.includes(item.id) ? "experiment-row is-selected" : "experiment-row"} onClick={() => setDetail(item)}><div className="row-select" onClick={(event) => event.stopPropagation()}><Checkbox aria-label={"Select " + item.title} checked={selected.includes(item.id)} onChange={(event) => toggleSelection(item.id, event.target.checked)} /></div><div className="row-main"><div className="row-meta"><Text className="investigation-label">{item.investigation}</Text><Text type="secondary">{item.id}</Text></div><Title level={3}>{item.title}</Title><Text type="secondary">{item.condition}</Text><div className="measurement-tags">{item.measurements.map((value) => <Tag key={value}>{value}</Tag>)}</div></div><div className="row-arrow"><ArrowUpRight size={16} /></div></List.Item>} />}</div>
        </section>
        <section id="comparison" className="comparison-sheet" aria-labelledby="comparison-heading"><div className="comparison-heading"><div><Text className="section-kicker">EVIDENCE SIDE BY SIDE</Text><Title id="comparison-heading" level={2}>Comparison sheet</Title></div><Button type="text" onClick={() => setSelected([])}>Clear selection</Button></div>{chosen.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Choose experiments from the catalog to compare them." /> : <div className="comparison-table" role="table" aria-label="Experiment comparison"><div className="comparison-header" role="row"><span>Experiment</span><span>Prototype score</span><span>O₂ change</span><span>Final CO</span><span>Evidence</span></div>{chosen.map((item) => <div className="comparison-row" role="row" key={item.id}><strong>{item.investigation}<small>{item.id}</small></strong><strong className="score">{comparisonScore(item) ?? "—"}</strong><span>{item.initialOxygenPct != null && item.finalOxygenPct != null ? (item.finalOxygenPct - item.initialOxygenPct).toFixed(1) + " pp" : "Not provided"}</span><span>{item.finalCoPpm != null ? item.finalCoPpm + " ppm" : "Not provided"}</span><Link href={item.sourceUrl} target="_blank">{item.sourceLabel} <ArrowUpRight size={12} /></Link></div>)}</div>}<Alert className="comparison-warning" type="warning" showIcon message="Prototype comparison score · not an official NASA safety rating." description="Scores use only available oxygen and CO changes. Flame spread, heat output, and temperature remain unfilled when the source does not provide them." /></section>
        <section id="interpretation" className="interpretation" aria-labelledby="interpretation-heading"><div className="interpretation-mark"><Flame size={22} /></div><div><Text className="section-kicker">GROUNDED INTERPRETATION</Text><Title id="interpretation-heading" level={2}>Evidence first. Guidance second.</Title><Paragraph>{detail ? detail.finding + " Available measurements: " + detail.measurements.join(", ") + "." : "Select an experiment to read its source-linked finding. This space is reserved for evidence, not invented certainty."}</Paragraph>{detail && <Link href={detail.sourceUrl} target="_blank">{detail.sourceLabel} <ArrowUpRight size={13} /></Link>}</div></section>
      </Content>
    </Layout>
  );
}
