import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import DashboardFilters, { CATEGORIES } from "./components/DashboardFilters";
import Overview from "./components/Overview";
import Chart from "./components/Chart";
import SectionHeader from "./components/SectionHeader";
import SpendingAnomalies from "./components/SpendingAnomalies";
import StateComparison from "./components/StateComparison";
import ProvenanceQuality from "./components/ProvenanceQuality";
import { fmt } from "./utils/formatters";

export default function App() {
  const [states, setStates] = useState([]);
  const [years, setYears] = useState([]);
  const [state, setState] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [sources, setSources] = useState([]);
  const [quality, setQuality] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [provenanceLoading, setProvenanceLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [dataError, setDataError] = useState("");
  const [provenanceError, setProvenanceError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  const filters = useMemo(() => ({ state_id: state, fiscal_year: year, appendix: category }), [state, year, category]);
  const selectedState = states.find((item) => String(item.id) === state)?.name || "All states / UTs";
  const selectedCategory = CATEGORIES.find(([value]) => value === category)?.[1] || "";

  useEffect(() => {
    const controller = new AbortController();
    setOptionsLoading(true); setOptionsError("");
    Promise.all([api.states(controller.signal), api.years(controller.signal)])
      .then(([stateData, yearData]) => {
        if (!controller.signal.aborted) { setStates(stateData); setYears(yearData); }
      })
      .catch((err) => { if (!controller.signal.aborted && err.name !== "AbortError") setOptionsError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    setDataLoading(true); setDataError("");
    Promise.all([
      api.summary(filters, controller.signal),
      api.trends({ state_id: state, appendix: category }, controller.signal),
    ]).then(([summaryData, trendData]) => {
      if (!controller.signal.aborted) { setSummary(summaryData); setTrends(trendData.items || []); }
    }).catch((err) => {
      if (!controller.signal.aborted && err.name !== "AbortError") setDataError(err.message || "Unable to load dashboard data.");
    }).finally(() => { if (!controller.signal.aborted) setDataLoading(false); });
    return () => controller.abort();
  }, [filters, state, category, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setProvenanceLoading(true); setProvenanceError("");
    Promise.all([api.dataSources(controller.signal), api.dataQuality(controller.signal)])
      .then(([sourceData, qualityData]) => {
        if (!Array.isArray(sourceData) || !Array.isArray(qualityData)) throw new Error("Unexpected source or data-quality response from API.");
        if (!controller.signal.aborted) { setSources(sourceData); setQuality(qualityData); }
      }).catch((err) => {
        if (!controller.signal.aborted && err.name !== "AbortError") setProvenanceError(err.message || "Unable to load source metadata.");
      }).finally(() => { if (!controller.signal.aborted) setProvenanceLoading(false); });
    return () => controller.abort();
  }, [reload]);

  async function exportCsv() {
    setExporting(true); setExportError("");
    try {
      const blob = await api.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "fundscope-spending.csv";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setExportError(err.message || "Unable to export CSV. Please try again."); }
    finally { setExporting(false); }
  }

  function refresh() {
    setReload((value) => value + 1);
  }

  return <div className="shell">
    <Sidebar />
    <main className="main" id="overview">
      <header><span>Workspace / Overview</span><span className="live">● Live data connection</span></header>
      <section className="heading">
        <div><small>PUBLIC FINANCE INTELLIGENCE</small><h1>Spending overview</h1><p>Explore state finances through transparent, source-backed data.</p></div>
        <div className="heading-actions">
          <button type="button" onClick={exportCsv} disabled={exporting}>{exporting ? "Preparing CSV…" : "↓ Export CSV"}</button>
          <button type="button" onClick={refresh}>↻ Refresh</button>
        </div>
      </section>
      {exportError && <div className="error" role="alert"><div><b>CSV export failed.</b><p>{exportError}</p></div><button onClick={exportCsv} disabled={exporting}>Try again</button></div>}
      <DashboardFilters states={states} years={years} state={state} year={year} category={category} setState={setState} setYear={setYear} setCategory={setCategory} disabled={optionsLoading} />
      {(optionsError || dataError) && <div className="error" role="alert"><div><b>We couldn't load the dashboard.</b><p>{optionsError || dataError}</p></div><button onClick={refresh}>Try again</button></div>}
      <Overview summary={summary} loading={dataLoading} selectedState={selectedState} selectedCategory={selectedCategory} />
      <section className="block" id="trends">
        <SectionHeader
          title={year ? `Spending breakdown · ${year}` : "Spending over time"}
          description={year
            ? "Annual Account, Revised and Budget values for the selected fiscal year. The RBI source does not provide monthly observations, so this view compares annual measures instead of inventing a monthly trend."
            : "Annual aggregates across available fiscal years. Select a fiscal year above to inspect its Account, Revised and Budget values."}
          badge={year || "Annual data"}
        />
        <article className="chartcard"><Chart items={trends} loading={dataLoading} selectedYear={year} /></article>
      </section>
      <SpendingAnomalies states={states} years={years} categories={CATEGORIES} />
      <StateComparison states={states} years={years} categories={CATEGORIES} />
      <ProvenanceQuality sources={sources} quality={quality} loading={provenanceLoading} error={provenanceError} />
      <footer><span>FundScope · Data-led public finance exploration</span><span>Source metadata is shown as recorded in the database.</span><span className="muted small">Records: {dataLoading ? "…" : fmt(summary?.total_records)}</span></footer>
    </main>
  </div>;
}
