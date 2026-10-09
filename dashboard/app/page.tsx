"use client";

import { useMemo, useState } from "react";
import { Alert, Card, Checkbox, Col, Input, Layout, List, Row, Select, Space, Statistic, Tag, Typography } from "antd";
import data from "../data/experiments.json";

const { Header, Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;
type Experiment = (typeof data)[number];

export default function Home() {
  const [query, setQuery] = useState("");
  const [investigation, setInvestigation] = useState("all");
  const [measurement, setMeasurement] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const experiments = useMemo(() => data.filter((item) => {
    const text = [item.id, item.title, item.material, item.condition, item.finding].join(" ").toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (investigation === "all" || item.investigation === investigation) && (measurement === "all" || item.measurements.includes(measurement));
  }), [query, investigation, measurement]);
  const chosen = data.filter((item) => selected.includes(item.id));
  const materials = new Set(data.map((item) => item.material));
  const score = (item: Experiment) => {
    const oxygen = item.initialOxygenPct == null || item.finalOxygenPct == null ? null : Math.abs(item.finalOxygenPct - item.initialOxygenPct) * 20;
    const co = item.initialCoPpm == null || item.finalCoPpm == null ? null : Math.max(0, item.finalCoPpm - item.initialCoPpm) / 2;
    const values = [oxygen, co].filter((value): value is number => value != null);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  };

  return <Layout className="app-shell">
    <Header className="app-header"><div className="brand"><span className="brand-mark">✦</span><span><b>Flame in Freefall</b><small>NASA microgravity fire research</small></span></div><Text type="secondary">Evidence explorer · prototype</Text></Header>
    <Content className="content">
      <section className="hero"><div><Text className="eyebrow">COMBUSTION SCIENCE / DECISION SUPPORT</Text><Title>See how fire behaves when gravity gets out of the way.</Title><Paragraph>Find, compare, and understand NASA microgravity fire experiments. Missing measurements stay visible.</Paragraph></div><Card size="small"><Text type="secondary">STARTING POINT</Text><Title level={3}>Saffire-I</Title><Link href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" target="_blank">Open NASA PSI entry ↗</Link></Card></section>
      <Row gutter={[16, 16]} className="stats"><Col xs={24} md={8}><Card><Statistic title="Experiments indexed" value={data.length} suffix={<Text type="secondary">curated</Text>} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Materials / groups" value={materials.size} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Source-backed findings" value={data.filter((item) => item.finding).length} /></Card></Col></Row>
      <Row gutter={[16, 16]}><Col xs={24} md={7}><Card title="Find experiments"><Space direction="vertical" style={{ width: "100%" }}><Input placeholder="Material, test, finding..." value={query} onChange={(event) => setQuery(event.target.value)} /><Select value={investigation} style={{ width: "100%" }} onChange={setInvestigation} options={[{ value: "all", label: "All investigations" }, ...[...new Set(data.map((item) => item.investigation))].map((value) => ({ value, label: value }))]} /><Select value={measurement} style={{ width: "100%" }} onChange={setMeasurement} options={[{ value: "all", label: "Any available measurement" }, ...[...new Set(data.flatMap((item) => item.measurements))].map((value) => ({ value, label: value }))]} /></Space></Card></Col><Col xs={24} md={17}><Card title="Experiment catalog" extra={<Text type="secondary">{experiments.length} shown · select up to 3</Text>}><List dataSource={experiments} renderItem={(item) => <List.Item><List.Item.Meta title={<Space><Checkbox checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id].slice(-3) : selected.filter((id) => id !== item.id))} /><Text strong>{item.title}</Text><Tag color="orange">{item.investigation}</Tag></Space>} description={<><Text type="secondary">{item.condition}</Text><br />{item.measurements.map((value) => <Tag key={value}>{value}</Tag>)}</>} /></List.Item>} /></Card></Col></Row>
      <Card title="Comparison workspace" className="section-card">{chosen.length === 0 ? <Alert message="Select experiments above to compare available evidence." type="info" /> : <Row gutter={[16, 16]}>{chosen.map((item) => <Col xs={24} md={8} key={item.id}><Card size="small"><Text strong>{item.investigation} · {item.id}</Text><Statistic title="Prototype comparison score" value={score(item) ?? "—"} /><Paragraph type="secondary">{score(item) == null ? "NASA does not provide comparable numeric measurements." : "Uses available oxygen and CO changes only."}</Paragraph><Link href={item.sourceUrl} target="_blank">{item.sourceLabel} ↗</Link></Card></Col>)}</Row>}<Text type="warning">Prototype comparison score · not an official NASA safety rating.</Text></Card>
      <Card className="section-card"><Text className="eyebrow">GROUNDED INTERPRETATION</Text><Title level={3}>Evidence first, guidance second.</Title><Paragraph>{chosen.length ? chosen[0].finding + " Available measurements: " + chosen[0].measurements.join(", ") + "." : "Select an experiment to see a source-linked interpretation."}</Paragraph><Alert message="Decision support only. Incomplete evidence is not converted into a certified spacecraft safety procedure." type="warning" showIcon /></Card>
    </Content>
  </Layout>;
}
