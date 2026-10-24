import { useEffect, useState } from "react";
import { api } from "./api";
import Field from "./components/Field";
import Metric from "./components/Metric";
import Chart from "./components/Chart";
import ProvenanceQuality from "./components/ProvenanceQuality";
import { fmt } from "./utils/formatters";
import "./index.css";

const cats = [
  ["", "All appendices"],
  ["Appendix-1", "Revenue receipts"],
  ["Appendix-2", "Revenue expenditure"],
  ["Appendix-3", "Capital receipts"],
  ["Appendix-4", "Capital expenditure"],
];

export default function App() {
  const [states, setStates] = useState([]);
  const [years, setYears] = useState([]);
  const [state, setState] = useState("");
  const [year, setYear] = useState("");
  const [cat, setCat] = useState("");
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [sources, setSources] = useState([]);
  const [quality, setQuality] = useState([]);
  const [provLoading, setProvLoading] = useState(true);
  const [provError, setProvError] = useState("");
  const [optionsLoadedKey, setOptionsLoadedKey] = useState(null);
  const [optionsFailed, setOptionsFailed] = useState(null);
  const [dataLoadedKey, setDataLoadedKey] = useState(null);
  const [dataFailed, setDataFailed] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [reload, setReload] = useState(0);

  const optionsKey = String(reload);
  const dataKey = JSON.stringify([state, year, cat, reload]);
  const optionsBusy = optionsLoadedKey !== optionsKey && optionsFailed !== optionsKey;
  const busy = dataLoadedKey !== dataKey && dataFailed?.key !== dataKey;
  const error = (optionsFailed === optionsKey ? "Unable to load dashboard filters. Please try again." : "") || (dataFailed?.key === dataKey ? dataFailed.message : "");

  const refreshDashboard = () => {
    setProvLoading(true);
    setProvError("");
    setReload((value) => value + 1);
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams();
      if (state) params.set("state_id", state);
      if (year) params.set("fiscal_year", year);
      if (cat) params.set("appendix", cat);
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
      const query = params.toString();
      const url = `${baseUrl}/api/spending/export.csv${query ? `?${query}` : ""}`;
      const response = await fetch(url, { headers: { Accept: "text/csv" } });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Export failed (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "fundscope-spending.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (e) {
      setExportError(e.message || "Unable to export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.states(controller.signal), api.years(controller.signal)])
      .then(([stateData, yearData]) => {
        if (controller.signal.aborted) return;
        setStates(stateData);
        setYears(yearData);
        setOptionsLoadedKey(optionsKey);
        setOptionsFailed(null);
      })
      .catch((e) => { if (!controller.signal.aborted && e.name !== "AbortError") setOptionsFailed(optionsKey); });
    return () => controller.abort();
  }, [optionsKey]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.summary({ state_id: state, fiscal_year: year, appendix: cat }, controller.signal),
      api.trends({ state_id: state, appendix: cat }, controller.signal),
    ])
      .then(([summaryData, trendData]) => {
        if (controller.signal.aborted) return;
        setSummary(summaryData);
        setTrends(trendData.items || []);
        setDataLoadedKey(dataKey);
        setDataFailed(null);
      })
      .catch((e) => { if (!controller.signal.aborted && e.name !== "AbortError") setDataFailed({ key: dataKey, message: e.message }); });
    return () => controller.abort();
  }, [state, year, cat, dataKey]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.dataSources(controller.signal), api.dataQuality(controller.signal)])
      .then(([sourceData, qualityData]) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(sourceData) || !Array.isArray(qualityData)) throw new Error("Unexpected source or data-quality response from API.");
        setSources(sourceData);
        setQuality(qualityData);
        setProvError("");
        setProvLoading(false);
      })
      .catch((e) => { if (!controller.signal.aborted && e.name !== "AbortError") { setProvError(e.message || "Unable to load source metadata."); setProvLoading(false); } });
    return () => controller.abort();
  }, [reload]);

  const selectedState = states.find((item) => String(item.id) === state)?.name || "All states / UTs";
  const selectedCategory = cats.find((item) => item[0] === cat)?.[1] || "";

  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/"><i>F</i>Fund<span>Scope</span></a>
      <small className="navlabel">WORKSPACE</small>
      <a className="nav active" href="#overview">▦ Overview</a>
      <a className="nav" href="#trends">⌁ Spending trends</a>
      <a className="nav" href="#provenance">◎ Data provenance</a>
      <div className="sidebottom"><b>● RBI e-STATES</b><p>Evidence-first public finance exploration.</p></div>
    </aside>

    <main className="main" id="overview">
      <header><span>Workspace / Overview</span><span className="live">● Live data connection</span></header>
      <section className="heading"><div><small>PUBLIC FINANCE INTELLIGENCE</small><h1>Spending overview</h1><p>Explore state finances through transparent, source-backed data.</p></div>
        <div className="heading-actions"><button type="button" onClick={exportCsv} disabled={exporting} aria-busy={exporting}>{exporting ? "Preparing CSV…" : "↓ Export CSV"}</button><button type="button" onClick={refreshDashboard}>↻ <span>Refresh</span></button></div>
      </section>
      {exportError && <div className="error" role="alert"><div><b>CSV export failed.</b><p>{exportError}</p></div><button type="button" onClick={exportCsv} disabled={exporting}>Try again</button></div>}

      <section className="filters"><div className="filterhead"><b>Filters</b><span>Refine the data shown below</span><button onClick={() => { setState(""); setYear(""); setCat(""); }}>Clear all</button></div>
        <div className="fields">
          <Field label="State / UT" value={state} onChange={setState} disabled={optionsBusy}><option value="">All states / UTs</option>{states.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Field>
          <Field label="Fiscal year" value={year} onChange={setYear} disabled={optionsBusy}><option value="">All fiscal years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</Field>
          <Field label="Budget category" value={cat} onChange={setCat}>{cats.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</Field>
        </div>
      </section>

      {error && <div className="error" role="alert"><div><b>We couldn't load the dashboard.</b><p>{error}</p></div><button onClick={refreshDashboard}>Try again</button></div>}
      <section className="block"><div className="sectiontitle"><div><h2>Key indicators</h2><p>Aggregated values for the selected records</p></div><span>{selectedState}{selectedCategory ? ` · ${selectedCategory}` : ""}</span></div>
        <div className="metrics"><Metric label="Total records" value={busy ? "…" : fmt(summary?.total_records)} note="Matching source records" icon="▤"/><Metric label="Account" value={busy ? "…" : fmt(summary?.total_account)} note="Actual account values" icon="₹"/><Metric label="Revised" value={busy ? "…" : fmt(summary?.total_revised)} note="Revised estimates" icon="↗"/><Metric label="Budget" value={busy ? "…" : fmt(summary?.total_budget)} note="Budget estimates" icon="◫"/></div>
      </section>
      <section className="block" id="trends"><div className="sectiontitle"><div><h2>Spending over time</h2><p>Annual aggregates across the selected state and category</p></div><span>{year || "All available years"}</span></div><article className="chartcard"><Chart items={trends} loading={busy}/></article></section>

      <section className="block" id="provenance"><div className="sectiontitle"><div><h2>Data provenance &amp; quality</h2><p>Source metadata and recorded ingestion checks for transparency</p></div><span>Source-backed metadata</span></div>
        <ProvenanceQuality sources={sources} quality={quality} loading={provLoading} error={provError}/>
      </section>
      <footer><span>FundScope · Data-led public finance exploration</span><span>Source metadata is shown as recorded in the database.</span></footer>
    </main>
  </div>;
}
