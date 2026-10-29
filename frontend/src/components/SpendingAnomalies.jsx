import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmt } from "../utils/formatters";
import Field from "./Field";
import "./SpendingAnomalies.css";

const PAGE_SIZE = 10;
const AGGREGATE_STATE_NAMES = new Set(["all states/ut", "all states/uts"]);

export default function SpendingAnomalies({ states = [], years = [], categories = [] }) {
  const [stateName, setStateName] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [metric, setMetric] = useState("budget");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const visibleItems = useMemo(
    () => (result?.items || []).filter((item) => !stateName || item.state_name === stateName),
    [result, stateName]
  );
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const pageItems = visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const highCount = visibleItems.filter((item) => item.direction === "high").length;
  const lowCount = visibleItems.filter((item) => item.direction === "low").length;
  const affectedStates = new Set(visibleItems.map((item) => item.state_name)).size;
  const stateOptions = states.filter((item) =>
    !AGGREGATE_STATE_NAMES.has(String(item.name || "").trim().toLowerCase())
  );



  useEffect(() => {
    const controller = new AbortController();

    async function loadAnomalies() {
      setLoading(true);
      setError("");
      try {
        const data = await api.anomalies(
          { fiscal_year: year, appendix: category, metric },
          controller.signal
        );
        if (!data || !Array.isArray(data.items)) {
          throw new Error("The API response did not contain an 'items' array. Check GET /api/anomalies in the backend.");
        }
        if (!controller.signal.aborted) setResult(data);
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") {
          setResult(null);
          setError(err.message || "Unable to load spending anomalies.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAnomalies();
    return () => controller.abort();
  }, [year, category, metric, retryCount]);

  const firstResult = visibleItems.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(page * PAGE_SIZE, visibleItems.length);

  return (
    <section className="block anomaly-section" id="anomalies">
      <div className="sectiontitle">
        <div>
          <h2>Spending anomaly detection</h2>
          <p>Unusually high or low annual spending compared with other states for the same budget head and fiscal year.</p>
        </div>
        <span>IQR analysis</span>
      </div>

      <div className="anomaly-panel">
        <div className="anomaly-filter-note">
          The backend calculates IQR limits across eligible states. The state selector only filters displayed results.
        </div>
        <div className="anomaly-filters">
          <Field label="State / UT (display filter)" value={stateName} onChange={(value) => { setStateName(value); setPage(1); }}>
            <option value="">All states / UTs</option>
            {stateOptions.map((item) => <option key={item.id ?? item.name} value={item.name}>{item.name}</option>)}
          </Field>
          <Field label="Fiscal year" value={year} onChange={(value) => { setYear(value); setPage(1); }}>
            <option value="">All fiscal years</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Field>
          <Field label="Budget category" value={category} onChange={(value) => { setCategory(value); setPage(1); }}>
            {categories.map(([value, label]) => <option key={value || "all-categories"} value={value}>{label}</option>)}
          </Field>
          <Field label="Financial metric" value={metric} onChange={(value) => { setMetric(value); setPage(1); }}>
            <option value="budget">Budget estimate</option>
            <option value="revised">Revised estimate</option>
            <option value="account">Account (actual)</option>
          </Field>
        </div>

        {loading ? (
          <div className="anomaly-state" role="status"><span className="anomaly-spinner" />Analyzing comparable spending records…</div>
        ) : error ? (
          <div className="anomaly-state anomaly-state-error" role="alert">
            <div><strong>Could not load anomalies</strong><p>{error}</p></div>
            <button type="button" className="anomaly-retry" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
          </div>
        ) : result ? (
          <>
            <div className="anomaly-stats">
              <article><span>Flagged anomalies</span><strong>{fmt(visibleItems.length)}</strong></article>
              <article><span>Unusually high</span><strong>{fmt(highCount)}</strong></article>
              <article><span>Unusually low</span><strong>{fmt(lowCount)}</strong></article>
              <article><span>Affected states / UTs</span><strong>{fmt(affectedStates)}</strong></article>
            </div>

            <p className="anomaly-coverage">
              Checked {fmt(result.checked_records ?? 0)} source rows; compared {fmt(result.states_compared ?? "—")} states/UTs across {fmt(result.groups_checked ?? 0)} eligible groups.
              {result.groups_skipped_small != null ? ` Skipped ${fmt(result.groups_skipped_small)} groups with fewer than ${result.minimum_group_size ?? 4} distinct states.` : ""}
              {result.skipped_missing_values != null ? ` Ignored ${fmt(result.skipped_missing_values)} missing/non-finite values for this metric.` : ""}
            </p>

            {Number(result.groups_checked ?? 0) === 0 ? (
              <div className="anomaly-empty">
                <strong>No eligible comparison groups were found</strong>
                <p>
                  The endpoint returned {fmt(result.checked_records ?? 0)} usable source rows, but no budget-head/fiscal-year group contained enough distinct states to compare. Try another fiscal year/category or confirm the loaded database contains the state-level RBI rows.
                </p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="anomaly-empty">
                <strong>{stateName ? `No anomalies found for ${stateName}` : "No statistical outliers found"}</strong>
                <p>
                  {stateName
                    ? "This state has no values outside the limits calculated across eligible states."
                    : "The selected data has eligible comparison groups, but no values fell outside the IQR limits. An empty result is a valid finding, not an API failure."}
                </p>
              </div>
            ) : (
              <>
                <div className="anomaly-results-heading"><strong>Detected anomalies</strong><span>Showing {firstResult}–{lastResult} of {fmt(visibleItems.length)}</span></div>
                <div className="anomaly-table-wrap">
                  <table className="anomaly-table">
                    <caption>{stateName ? `Showing ${stateName} only; limits still use all eligible states. ` : "Showing anomalies across all states. "}{PAGE_SIZE} results per page.</caption>
                    <thead><tr>
                      <th scope="col">State / UT</th><th scope="col">Fiscal year</th><th scope="col">Budget head</th>
                      <th scope="col">{metric === "account" ? "Account" : metric === "revised" ? "Revised" : "Budget"}</th>
                      <th scope="col">IQR allowed range</th><th scope="col">Flag</th>
                    </tr></thead>
                    <tbody>{pageItems.map((item, index) => (
                      <tr key={`${item.state_name}-${item.fiscal_year}-${item.budget_head}-${(page - 1) * PAGE_SIZE + index}`}>
                        <td>{item.state_name}</td><td>{item.fiscal_year}</td><td className="anomaly-head-name">{item.budget_head}</td>
                        <td className="anomaly-number">{fmt(item.value)}</td><td className="anomaly-number">{fmt(item.lower_bound)} – {fmt(item.upper_bound)}</td>
                        <td><span className={`anomaly-tag anomaly-${item.direction}`}>{item.direction === "high" ? "↑ High" : "↓ Low"}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {pageCount > 1 && <nav className="anomaly-pagination" aria-label="Anomaly result pages">
                  <button type="button" onClick={() => setPage(1)} disabled={page === 1}>« First</button>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                  <span>Page {page} of {pageCount}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>Next</button>
                  <button type="button" onClick={() => setPage(pageCount)} disabled={page === pageCount}>Last »</button>
                </nav>}
              </>
            )}

            <details className="anomaly-method">
              <summary>How is this calculated?</summary>
              <p>Peer groups are one budget head in one fiscal year, with one mean value per state.</p>
              <p><code>IQR = Q3 − Q1</code></p><p><code>Lower limit = Q1 − 1.5 × IQR</code></p><p><code>Upper limit = Q3 + 1.5 × IQR</code></p>
              <p>The “All States/UT” aggregate row is excluded. Groups with fewer than four distinct state values are skipped. An outlier is a signal for review, not proof of error or wrongdoing.</p>
            </details>
          </>
        ) : null}
      </div>
    </section>
  );
}
