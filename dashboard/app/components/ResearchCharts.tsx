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
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";

export type ChartExperiment = {
  id: string;
  investigation: string;
  material: string;
  testId: string;
  sampleId: string;
  testEnd: string | null;
  initialOxygenPct: number | null;
  initialOxygenPctBasis: string | null;
  burningRateSourceValue: number | null;
  burningRateUnitLabel: string;
  burnTimeS: number | null;
  burnDurationS: number | null;
  visibleFlameExtinctionDiameterMm: number | null;
  initialDropletDiameterMm: number | null;
  flameSpreadRateMmS: number | null;
  burnLengthCm: number | null;
  averageFlamePowerW: number | null;
  averageFlamePowerUncertaintyW: number | null;
  reportedMetricQualifiers: Record<string, string>;
  sourceRowNumber: number | null;
  sourceUrl: string;
  sourceDocumentUrl: string;
  sourceLabel: string;
};

type Props = {
  experiments: ChartExperiment[];
  status: "loading" | "ready" | "error";
};

type MetricKey =
  | "burningRateSourceValue"
  | "burnTimeS"
  | "visibleFlameExtinctionDiameterMm"
  | "initialDropletDiameterMm"
  | "flameSpreadRateMmS"
  | "burnDurationS"
  | "burnLengthCm"
  | "averageFlamePowerW";

type MetricSpec = { key: MetricKey; label: string; unit: string };
type MetricDatum = ChartExperiment & { value: number; unit: string; qualifier: string | null };
type OutcomeDatum = { fuel: string; [key: string]: number | string | Record<string, ChartExperiment[]> };
type TooltipEntry = { value?: unknown; name?: string; payload?: Record<string, unknown> };

const FLEX_METRICS: MetricSpec[] = [
  { key: "burningRateSourceValue", label: "Reported burning-rate value", unit: "source label: mm" },
  { key: "burnTimeS", label: "Burn time", unit: "s" },
  { key: "visibleFlameExtinctionDiameterMm", label: "Visible flame extinction diameter", unit: "mm" },
  { key: "initialDropletDiameterMm", label: "Initial droplet diameter", unit: "mm" },
];

const OTHER_METRICS: MetricSpec[] = [
  { key: "flameSpreadRateMmS", label: "Flame spread rate", unit: "mm/s" },
  { key: "burnDurationS", label: "Burn duration", unit: "s" },
  { key: "burnLengthCm", label: "Burn length", unit: "cm" },
  { key: "averageFlamePowerW", label: "Average flame power", unit: "W" },
];

const OUTCOME_COLORS = ["#ff5a1f", "#ffb000", "#f4f4f4", "#78a9ff", "#c078ff", "#63d6a3"];
const FUEL_COLORS = ["#ff5a1f", "#ffd166", "#77b8ff", "#f4f4f4"];

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function metricValue(record: ChartExperiment, metric: MetricSpec): number | null {
  const value = record[metric.key];
  return finite(value) ? value : null;
}

function displayUnit(record: ChartExperiment, metric: MetricSpec) {
  return metric.key === "burningRateSourceValue" ? record.burningRateUnitLabel || metric.unit : metric.unit;
}

function recordQualifier(record: ChartExperiment, metric: MetricSpec) {
  const sourceKey = metric.key === "burnTimeS" ? "burn_time_s" : metric.key;
  return record.reportedMetricQualifiers[sourceKey] ?? null;
}

function sortedMedian(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function metricLabel(metric: MetricSpec, record: ChartExperiment, value: number) {
  return `${value} ${displayUnit(record, metric)}`;
}

function RecordTooltip({ active, payload, metric }: { active?: boolean; payload?: TooltipEntry[]; metric: MetricSpec }) {
  if (!active || !payload?.length) return null;
  const record = payload[0].payload as unknown as MetricDatum | undefined;
  if (!record) return null;
  return <div className="research-tooltip">
    <strong>{record.id}</strong>
    <span>{record.investigation} · {record.material}</span>
    <span>{metric.label}: {record.qualifier ? `${record.qualifier}; ` : ""}{metricLabel(metric, record, record.value)}</span>
    {metric.key === "averageFlamePowerW" && record.averageFlamePowerUncertaintyW != null && <span>Reported uncertainty: ±{record.averageFlamePowerUncertaintyW} W</span>}
    <span>Test {record.testId || "not assigned"} · Sample {record.sampleId || "not assigned"}</span>
    <a href={record.sourceUrl} target="_blank" rel="noreferrer">NASA source record <ArrowUpRight size={12} /></a>
    {record.sourceDocumentUrl && <a href={record.sourceDocumentUrl} target="_blank" rel="noreferrer">Supporting document <ArrowUpRight size={12} /></a>}
  </div>;
}

function ScatterRecordTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const record = payload[0].payload as unknown as ChartExperiment & { oxygenPct: number; burningRate: number };
  if (!record) return null;
  return <div className="research-tooltip">
    <strong>{record.id}</strong>
    <span>{record.material} · Test {record.testId}</span>
    <span>Initial oxygen: {record.oxygenPct}% ({record.initialOxygenPctBasis || "source basis unavailable"})</span>
    <span>Burning-rate value: {record.burningRate} {record.burningRateUnitLabel}</span>
    <a href={record.sourceUrl} target="_blank" rel="noreferrer">NASA PSI-69 record <ArrowUpRight size={12} /></a>
    {record.sourceDocumentUrl && <a href={record.sourceDocumentUrl} target="_blank" rel="noreferrer">NASA report <ArrowUpRight size={12} /></a>}
  </div>;
}

function OutcomeTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as unknown as OutcomeDatum | undefined;
  const outcomes = row?.sourceRecordsByOutcome as Record<string, ChartExperiment[]> | undefined;
  if (!row || !outcomes) return null;
  const displayed = payload.filter((entry) => finite(entry.value) && entry.value > 0);
  return <div className="research-tooltip">
    <strong>{row.fuel} · reported outcomes</strong>
    {displayed.map((entry) => <span key={String(entry.name)}>{String(entry.name)}: {String(entry.value)} tests</span>)}
    <span>Open the record list below the chart to inspect every included test ID.</span>
  </div>;
}

function SourceRecords({ records, emptyLabel }: { records: ChartExperiment[]; emptyLabel: string }) {
  if (!records.length) return <p className="chart-source-empty">{emptyLabel}</p>;
  return <details className="chart-record-list">
    <summary>Trace plotted values to {records.length} NASA {records.length === 1 ? "record" : "records"}</summary>
    <div className="chart-record-links">
      {records.map((record) => <a key={record.id} href={record.sourceUrl} target="_blank" rel="noreferrer">
        <span>{record.id}</span><small>{record.material} · test {record.testId}{record.sourceRowNumber ? ` · CSV row ${record.sourceRowNumber}` : ""}</small><ArrowUpRight size={12} />
      </a>)}
    </div>
  </details>;
}

export default function ResearchCharts({ experiments, status }: Props) {
  const investigations = useMemo(() => [...new Set(experiments.map((item) => item.investigation))].sort(), [experiments]);
  const [investigation, setInvestigation] = useState("");
  const [metricKey, setMetricKey] = useState<MetricKey>("burningRateSourceValue");
  const [fuel, setFuel] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [recordQuery, setRecordQuery] = useState("");

  const selectedInvestigation = investigation && investigations.includes(investigation)
    ? investigation
    : investigations.find((name) => name.toLowerCase().includes("flex")) ?? investigations[0] ?? "";
  const investigationRecords = useMemo(() => experiments.filter((item) => item.investigation === selectedInvestigation), [experiments, selectedInvestigation]);
  const isFlex = selectedInvestigation.toLowerCase().includes("flex");
  const metricOptions = useMemo(() => {
    const candidates = isFlex ? FLEX_METRICS : OTHER_METRICS;
    return candidates.filter((metric) => investigationRecords.some((record) => metricValue(record, metric) != null));
  }, [investigationRecords, isFlex]);
  const activeMetric = metricOptions.find((item) => item.key === metricKey) ?? metricOptions[0] ?? null;

  const fuels = useMemo(() => [...new Set(investigationRecords.map((item) => item.material).filter(Boolean))].sort(), [investigationRecords]);
  const outcomes = useMemo(() => [...new Set(investigationRecords.map((item) => item.testEnd).filter((value): value is string => Boolean(value)))].sort(), [investigationRecords]);

  const filteredRecords = useMemo(() => {
    const query = recordQuery.trim().toLowerCase();
    return investigationRecords.filter((record) =>
      (fuel === "all" || record.material === fuel) &&
      (outcome === "all" || record.testEnd === outcome) &&
      (!query || [record.id, record.testId, record.sampleId, record.material, record.testEnd].some((value) => value?.toLowerCase().includes(query)))
    );
  }, [fuel, investigationRecords, outcome, recordQuery]);

  const outcomeNames = [...new Set(filteredRecords.map((item) => item.testEnd).filter((value): value is string => Boolean(value)))].sort();
  const outcomeRows = useMemo(() => {
    const byFuel = new Map<string, OutcomeDatum>();
    for (const record of filteredRecords) {
      if (!record.testEnd) continue;
      let row = byFuel.get(record.material);
      if (!row) {
        row = { fuel: record.material, sourceRecordsByOutcome: {} };
        byFuel.set(record.material, row);
      }
      row[record.testEnd] = (typeof row[record.testEnd] === "number" ? row[record.testEnd] as number : 0) + 1;
      (row.sourceRecordsByOutcome as Record<string, ChartExperiment[]>)[record.testEnd] ??= [];
      (row.sourceRecordsByOutcome as Record<string, ChartExperiment[]>)[record.testEnd].push(record);
    }
    return [...byFuel.values()].sort((a, b) => a.fuel.localeCompare(b.fuel));
  }, [filteredRecords]);

  const metricRecords = useMemo(() => {
    if (!activeMetric) return [];
    return filteredRecords.flatMap((record) => {
      const value = metricValue(record, activeMetric);
      return value == null ? [] : [{ ...record, value, unit: displayUnit(record, activeMetric), qualifier: recordQualifier(record, activeMetric) }];
    }).sort((a, b) => b.value - a.value);
  }, [activeMetric, filteredRecords]);
  const metricTopRecords = metricRecords.slice(0, 16);
  const metricValues = metricRecords.map((record) => record.value);
  const qualifiedMetricCount = metricRecords.filter((record) => record.qualifier).length;
  const metricMean = metricValues.length ? metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length : null;
  const metricMedian = sortedMedian(metricValues);
  const metricMin = metricValues.length ? Math.min(...metricValues) : null;
  const metricMax = metricValues.length ? Math.max(...metricValues) : null;

  const oxygenRateRecords = filteredRecords.flatMap((record) => record.initialOxygenPct != null && record.burningRateSourceValue != null
    ? [{ ...record, oxygenPct: record.initialOxygenPct, burningRate: record.burningRateSourceValue }]
    : []);
  const oxygenRateMissingCount = filteredRecords.length - oxygenRateRecords.length;
  const missingOutcomeCount = filteredRecords.filter((record) => !record.testEnd).length;

  if (status === "loading") return <section className="research-charts content-section" id="charts" aria-labelledby="research-charts-title" aria-busy="true"><div className="research-section-head"><div><p className="section-kicker">NASA RESEARCH / DATA VISUALIZATION</p><h2 id="research-charts-title">Compare reported measurements.</h2></div></div><div className="research-state">Loading curated NASA experiment records…</div></section>;
  if (status === "error") return <section className="research-charts content-section" id="charts" aria-labelledby="research-charts-title"><div className="research-section-head"><div><p className="section-kicker">NASA RESEARCH / DATA VISUALIZATION</p><h2 id="research-charts-title">Compare reported measurements.</h2></div></div><div className="research-state is-error">The experiment catalog could not be loaded. Try again after the local data API is available.</div></section>;
  if (!experiments.length) return <section className="research-charts content-section" id="charts" aria-labelledby="research-charts-title"><div className="research-section-head"><div><p className="section-kicker">NASA RESEARCH / DATA VISUALIZATION</p><h2 id="research-charts-title">Compare reported measurements.</h2></div></div><div className="research-state">No curated NASA records are available for charting yet.</div></section>;

  return <section className="research-charts content-section" id="charts" aria-labelledby="research-charts-title">
    <div className="research-section-head">
      <div><p className="section-kicker">03 / SOURCE-TRACEABLE RESEARCH CHARTS</p><h2 id="research-charts-title">Compare reported measurements.</h2><p className="research-intro">Choose one investigation at a time. Missing measurements stay out of calculations, and each plotted test links to its NASA source.</p></div>
      <a className="research-primary-source" href={investigationRecords[0]?.sourceUrl ?? "https://psi.nasa.gov/"} target="_blank" rel="noreferrer">OPEN {isFlex ? "NASA PSI-69" : "NASA SOURCE"} <ArrowUpRight size={14} /></a>
    </div>

    <div className="research-controls" aria-label="Research chart filters">
      <label>Investigation<select value={selectedInvestigation} onChange={(event) => { setInvestigation(event.target.value); setFuel("all"); setOutcome("all"); setRecordQuery(""); }}>
        {investigations.map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
      <label>Fuel / material<select value={fuel} onChange={(event) => setFuel(event.target.value)}><option value="all">All materials</option>{fuels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Reported outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="all">All outcomes</option>{outcomes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Find test<input value={recordQuery} onChange={(event) => setRecordQuery(event.target.value)} placeholder="Experiment, test, sample…" /></label>
      <label>Metric<select value={activeMetric?.key ?? ""} disabled={!metricOptions.length} onChange={(event) => setMetricKey(event.target.value as MetricKey)}>
        {metricOptions.length ? metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label} · {item.key === "burningRateSourceValue" ? "source unit" : item.unit}</option>) : <option value="">No reported metrics</option>}
      </select></label>
    </div>

    {isFlex && <div className="dataset-scope-note"><strong>PSI-69 / VERSION 5</strong><span>274 downloaded test rows · source table and NASA report scopes differ.</span><a href="https://ntrs.nasa.gov/citations/20150023456" target="_blank" rel="noreferrer">Scope and unit notes <ArrowUpRight size={12} /></a></div>}
    <div className="research-record-status"><span>{filteredRecords.length} records in current filter</span><span>{metricRecords.length} numeric values for selected metric</span><span>{filteredRecords.length - metricRecords.length} missing values excluded</span></div>

    <div className="research-chart-grid">
      <article className="research-chart-card">
        <div className="research-chart-heading"><div><span>01 / TEST OUTCOME</span><h3>Outcome counts by fuel</h3><p>Counts group source-reported test-end labels; hover to inspect the distribution.</p></div><strong>{filteredRecords.filter((record) => record.testEnd).length} outcomes</strong></div>
        {outcomeRows.length && outcomeNames.length ? <div className="research-chart-frame outcome-chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={outcomeRows} margin={{ top: 10, right: 12, left: -12, bottom: 18 }}>
          <CartesianGrid stroke="#28303c" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="fuel" tick={{ fill: "#cad2de", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#475161" }} />
          <YAxis allowDecimals={false} tick={{ fill: "#9ba7b7", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<OutcomeTooltip />} cursor={{ fill: "rgba(255,90,31,.08)" }} />
          <Legend wrapperStyle={{ color: "#d5deeb", fontSize: 10 }} />
          {outcomeNames.map((name, index) => <Bar key={name} dataKey={name} name={name} stackId="outcomes" fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]} maxBarSize={76} />)}
        </BarChart></ResponsiveContainer></div> : <div className="research-chart-empty"><strong>Outcome data unavailable</strong><span>{isFlex ? "No reported outcomes match the current filters." : `${selectedInvestigation} has no compatible reported test-end labels in this catalog subset.`}</span></div>}
        <p className="research-chart-caption">Missing outcome labels are excluded: {missingOutcomeCount}. A stacked bar is a count of catalog test records, not a risk score.</p>
        <div className="outcome-trace-list"><h4>Record trace for each bar segment</h4>{outcomeRows.flatMap((row) => outcomeNames.map((name) => {
          const records = (row.sourceRecordsByOutcome as Record<string, ChartExperiment[]>)[name] ?? [];
          return records.length ? <details key={`${row.fuel}-${name}`}><summary>{row.fuel} · {name} · {records.length} tests</summary><SourceRecords records={records} emptyLabel="No records in this group." /></details> : null;
        }))}</div>
      </article>

      <article className="research-chart-card">
        <div className="research-chart-heading"><div><span>02 / CONDITION COMPARISON</span><h3>Oxygen vs. reported burning rate</h3><p>Only paired values from the selected investigation are shown.</p></div><strong>{oxygenRateRecords.length} paired</strong></div>
        {oxygenRateRecords.length ? <div className="research-chart-frame"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 14, bottom: 22, left: 2 }}>
          <CartesianGrid stroke="#28303c" strokeDasharray="3 4" />
          <XAxis type="number" dataKey="oxygenPct" name="Initial oxygen" unit="%" tick={{ fill: "#aeb9c8", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#475161" }} label={{ value: "Initial oxygen (%)", position: "insideBottom", offset: -12, fill: "#aeb9c8", fontSize: 10 }} />
          <YAxis type="number" dataKey="burningRate" name="Reported burning rate" tick={{ fill: "#aeb9c8", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "Source value", angle: -90, position: "insideLeft", fill: "#aeb9c8", fontSize: 10 }} />
          <Tooltip content={<ScatterRecordTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#ffb000" }} />
          <Legend wrapperStyle={{ color: "#d5deeb", fontSize: 10 }} />
          {fuels.filter((item) => fuel === "all" || fuel === item).map((item, index) => <Scatter key={item} name={item} data={oxygenRateRecords.filter((record) => record.material === item)} fill={FUEL_COLORS[index % FUEL_COLORS.length]} />)}
        </ScatterChart></ResponsiveContainer></div> : <div className="research-chart-empty"><strong>Paired measurements unavailable</strong><span>{isFlex ? "No records with both initial oxygen and reported burning-rate values match the current filters." : "This investigation does not provide the FLEX burning-rate field used for this view. Investigations remain separate."}</span></div>}
        <p className="research-chart-caption">{oxygenRateMissingCount} filtered records lacked one or both paired values and are excluded. Initial oxygen percentage is derived from reported mole fraction × 100. No line or fit implies causation.</p>
        {isFlex && <div className="research-unit-warning"><strong>Check the unit before interpreting this axis.</strong><span>The PSI CSV header says mm; the NASA report labels the corresponding metric mm²/s. Values retain the PSI source label pending reconciliation.</span><a href="https://ntrs.nasa.gov/citations/20150023456" target="_blank" rel="noreferrer">Open NASA report <ArrowUpRight size={12} /></a></div>}
      </article>

      <article className="research-chart-card research-chart-wide">
        <div className="research-chart-heading"><div><span>03 / SELECTABLE REPORTED METRIC</span><h3>{activeMetric?.label ?? "Reported metric summary"}</h3><p>Sorted individual measurements are shown below. Summary statistics use all visible non-missing records.{activeMetric?.key === "burningRateSourceValue" ? " PSI CSV header says mm; the NASA report labels the corresponding metric mm²/s." : ""}</p></div><strong>{activeMetric ? activeMetric.key === "burningRateSourceValue" ? "PSI SOURCE UNIT" : activeMetric.unit : "NO VALUES"}</strong></div>
        {activeMetric && metricRecords.length ? <>
          <div className="metric-summary-rail"><div><span>REPORTED</span><strong>{metricRecords.length}</strong></div><div><span>EXCLUDED MISSING</span><strong>{filteredRecords.length - metricRecords.length}</strong></div><div><span>MEAN</span><strong>{metricMean?.toLocaleString(undefined, { maximumFractionDigits: 3 })} <small>{activeMetric.key === "burningRateSourceValue" ? "source unit" : activeMetric.unit}</small></strong></div><div><span>MEDIAN</span><strong>{metricMedian?.toLocaleString(undefined, { maximumFractionDigits: 3 })} <small>{activeMetric.key === "burningRateSourceValue" ? "source unit" : activeMetric.unit}</small></strong></div><div><span>RANGE</span><strong>{metricMin?.toLocaleString(undefined, { maximumFractionDigits: 3 })}–{metricMax?.toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong></div><div><span>QUALIFIED</span><strong>{qualifiedMetricCount}</strong></div></div>
          <p className="research-chart-caption">Showing the {metricTopRecords.length} highest source values from {metricRecords.length} numeric records; ties follow catalog order. Summary statistics include source numeric entries as provided; {qualifiedMetricCount} carry a qualifier. Hover any bar for the record ID, unit, qualifier, uncertainty, and source.</p>
          <div className="research-chart-frame metric-chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={metricTopRecords} margin={{ top: 8, right: 16, left: 8, bottom: 68 }}>
            <CartesianGrid stroke="#28303c" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="id" interval={0} angle={-40} textAnchor="end" height={74} tick={{ fill: "#bdc7d5", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "#475161" }} />
            <YAxis tick={{ fill: "#aeb9c8", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<RecordTooltip metric={activeMetric} />} cursor={{ fill: "rgba(255,90,31,.08)" }} />
            <Bar dataKey="value" name={activeMetric.label} fill="#ff5a1f" maxBarSize={40}>
              {metricTopRecords.map((record, index) => <Cell key={record.id} fill={index === 0 ? "#ffb000" : "#ff5a1f"} />)}
            </Bar>
          </BarChart></ResponsiveContainer></div>
          <SourceRecords records={metricTopRecords} emptyLabel="No source-linked values to show." />
        </> : <div className="research-chart-empty"><strong>Metric values unavailable</strong><span>{activeMetric ? `No ${activeMetric.label.toLowerCase()} values match the current filters. Missing values were not imputed.` : "No reported numeric metric is available for this investigation."}</span></div>}
      </article>
    </div>

    {isFlex && <p className="research-limitations">The selected NASA PSI-69 Version 5 table contains 274 downloadable test rows (tests 1–274). NASA’s PSI table view reports 275 entries; NASA’s 2015 report describes its first 284 tests. These scopes are not combined. BRE is not charted because its public NASA access page requires authorization.</p>}
    {!isFlex && <p className="research-limitations">Charts use records from {selectedInvestigation} only. Values from other investigations are not pooled, even when their labels look similar. This is a curated subset; see each source record for its reporting context.</p>}
  </section>;
}
