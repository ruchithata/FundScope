import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmt } from "../utils/formatters";
import Field from "./Field";
import SectionHeader from "./SectionHeader";

const PAGE_SIZE = 10;
const isAggregate = (name) => /^all\s+states\s*\/\s*ut(?:s)?$/i.test((name || "").trim());

export default function SpendingAnomalies({ states, years, categories }) {
  const [stateName, setStateName] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [metric, setMetric] = useState("budget");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const visible = useMemo(() => (result?.items || []).filter((item) => !stateName || item.state_name === stateName), [result, stateName]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [stateName, year, category, metric]);
  useEffect(() => { setPage((p) => Math.min(p, Math.max(1, Math.ceil(visible.length / PAGE_SIZE)))); }, [visible.length]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const data = await api.anomalies({ fiscal_year: year, appendix: category, metric }, controller.signal);
        const items = Array.isArray(data) ? data : data?.items ?? data?.anomalies;
        if (!Array.isArray(items)) {
          throw new Error("The anomaly API responded, but did not return an 'items' or 'anomalies' array. Check the FastAPI /api/anomalies response schema.");
        }
        if (!controller.signal.aborted) setResult({
          ...(!Array.isArray(data) ? data : {}),
          items,
          checked_records: data?.checked_records ?? data?.records_checked ?? 0,
          groups_checked: data?.groups_checked ?? data?.groups_analyzed ?? 0,
        });
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") { setResult(null); setError(err.message || "Unable to load spending anomalies."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    return () => controller.abort();
  }, [year, category, metric, retry]);

  const stateOptions = states.filter((item) => !isAggregate(item.name));
  const high = visible.filter((item) => item.direction === "high").length;
  const low = visible.filter((item) => item.direction === "low").length;
  const affected = new Set(visible.map((item) => item.state_name)).size;

  return (
    <section className="block" id="anomalies">
      <SectionHeader title="Spending anomaly detection" description="Flag unusually high or low values for comparable budget heads and fiscal years." badge="IQR analysis" />
      <div className="panel">
        <p className="notice">IQR limits are calculated across all eligible states first. The state filter only narrows displayed results; it does not recalculate the limits.</p>
        <div className="anomaly-filters">
          <Field label="State / UT (display filter)" value={stateName} onChange={setStateName}>
            <option value="">All states / UTs</option>
            {stateOptions.map((item) => <option key={item.id ?? item.name} value={item.name}>{item.name}</option>)}
          </Field>
          <Field label="Fiscal year" value={year} onChange={setYear}>
            <option value="">All fiscal years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Field>
          <Field label="Budget category" value={category} onChange={setCategory}>
            {categories.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}
          </Field>
          <Field label="Financial metric" value={metric} onChange={setMetric}>
            <option value="budget">Budget estimate</option><option value="revised">Revised estimate</option><option value="account">Account (actual)</option>
          </Field>
        </div>
        {loading ? <div className="state-message" role="status">Analyzing comparable spending records…</div>
          : error ? <div className="error" role="alert"><div><b>Could not load anomalies</b><p>{error}</p></div><button onClick={() => setRetry((n) => n + 1)}>Try again</button></div>
          : result ? <>
            <div className="anomaly-stats">
              <article><span>Flagged anomalies</span><strong>{fmt(visible.length)}</strong></article>
              <article><span>Unusually high</span><strong>{fmt(high)}</strong></article>
              <article><span>Unusually low</span><strong>{fmt(low)}</strong></article>
              <article><span>Affected states / UTs</span><strong>{fmt(affected)}</strong></article>
            </div>
            <p className="muted small">Checked {fmt(result.checked_records)} eligible records across {fmt(result.groups_checked)} comparable groups. Detection baseline includes all eligible states.</p>
            {visible.length === 0 ? <div className="empty-box"><b>{Number(result.checked_records) === 0 ? "No eligible records were analyzed" : "No statistical outliers found"}</b><p>{Number(result.checked_records) === 0
              ? "The API returned no eligible records for this metric and filter combination. Confirm that the backend anomaly endpoint is connected to the cleaned dataset and uses the selected metric names: budget, revised, or account."
              : stateName ? `No anomalies were returned for ${stateName} under these filters.` : "The selected records did not contain values outside the IQR limits."} Try another state, fiscal year, or category.</p></div>
              : <>
                <div className="results-head"><b>Detected anomalies</b><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} of {fmt(visible.length)}</span></div>
                <div className="table-wrap"><table>
                  <caption>{stateName ? `Showing ${stateName}; IQR limits still use all eligible states.` : "Showing anomalies across all states."} {PAGE_SIZE} results per page.</caption>
                  <thead><tr><th>State / UT</th><th>Fiscal year</th><th>Budget head</th><th>{metric === "account" ? "Account" : metric === "revised" ? "Revised" : "Budget"}</th><th>IQR allowed range</th><th>Flag</th></tr></thead>
                  <tbody>{pageItems.map((item, index) => <tr key={`${item.state_name}-${item.fiscal_year}-${item.budget_head}-${index}`}>
                    <td>{item.state_name}</td><td>{item.fiscal_year}</td><td className="head-name">{item.budget_head}</td><td className="number">{fmt(item.value)}</td><td className="number">{fmt(item.lower_bound)} – {fmt(item.upper_bound)}</td>
                    <td><span className={`tag ${item.direction === "high" ? "tag-high" : "tag-low"}`}>{item.direction === "high" ? "↑ High" : "↓ Low"}</span></td>
                  </tr>)}</tbody>
                </table></div>
                {pageCount > 1 && <nav className="pagination" aria-label="Anomaly result pages">
                  <button onClick={() => setPage(1)} disabled={page === 1}>« First</button><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                  <span>Page {page} of {pageCount}</span><button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>Next</button><button onClick={() => setPage(pageCount)} disabled={page === pageCount}>Last »</button>
                </nav>}
              </>}
            <details className="method"><summary>How is this calculated?</summary><p>Each group contains comparable records for one budget head in one fiscal year.</p><p><code>IQR = Q3 − Q1</code></p><p><code>Lower limit = Q1 − 1.5 × IQR</code></p><p><code>Upper limit = Q3 + 1.5 × IQR</code></p><p>Aggregate All States/UT rows and groups with fewer than four non-empty records should be excluded by the backend.</p></details>
            <p className="muted small">A statistical outlier is a signal for further investigation, not evidence of an error or wrongdoing. Currency units follow the source dataset.</p>
          </> : null}
      </div>
    </section>
  );
}
