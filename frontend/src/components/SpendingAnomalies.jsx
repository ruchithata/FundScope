import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmt } from "../utils/formatters";
import Field from "./Field";
import "./SpendingAnomalies.css";

const PAGE_SIZE = 10;
const AGGREGATE_STATE_NAMES = new Set(["all states/ut", "all states/uts"]);

function SpendingAnomalies({ states = [], years = [], categories = [] }) {
  const [stateName, setStateName] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [metric, setMetric] = useState("budget");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // IQR detection runs across all eligible states. The selected state only
  // filters the returned anomaly list and never changes the calculated bounds.
  const visibleItems = useMemo(
    () => (result?.items || []).filter(
      (item) => !stateName || item.state_name === stateName
    ),
    [result, stateName]
  );

  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const pageItems = visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const highCount = visibleItems.filter((item) => item.direction === "high").length;
  const lowCount = visibleItems.filter((item) => item.direction === "low").length;
  const affectedStates = new Set(visibleItems.map((item) => item.state_name)).size;
  const firstResult = visibleItems.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(page * PAGE_SIZE, visibleItems.length);

  useEffect(() => {
    setPage(1);
  }, [stateName, year, category, metric]);

  useEffect(() => {
    // Keep page valid if a new response has fewer rows than the previous one.
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE))));
  }, [visibleItems.length]);

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
          throw new Error("Unexpected anomaly response from the API.");
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

  const stateOptions = states.filter((item) =>
    !AGGREGATE_STATE_NAMES.has(String(item.name || "").trim().toLowerCase())
  );

  return (
    <section className="block anomaly-section" id="anomalies">
      <div className="sectiontitle">
        <div>
          <h2>Spending anomaly detection</h2>
          <p>
            Identify unusually high or low values compared with other states
            for the same budget head and fiscal year.
          </p>
        </div>
        <span>IQR analysis</span>
      </div>

      <div className="anomaly-panel">
        <div className="anomaly-filter-note">
          IQR limits are calculated across all eligible states first. The state filter only narrows the displayed results; it does not recalculate the limits.
        </div>
        <div className="anomaly-filters">
          <Field label="State / UT (display filter)" value={stateName} onChange={setStateName}>
            <option value="">All states / UTs</option>
            {stateOptions.map((item) => (
              <option key={item.id ?? item.name} value={item.name}>{item.name}</option>
            ))}
          </Field>
          <Field label="Fiscal year" value={year} onChange={setYear}>
            <option value="">All fiscal years</option>
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Field>
          <Field label="Budget category" value={category} onChange={setCategory}>
            {categories.map(([value, label]) => (
              <option key={value || "all-categories"} value={value}>{label}</option>
            ))}
          </Field>
          <Field label="Financial metric" value={metric} onChange={setMetric}>
            <option value="budget">Budget estimate</option>
            <option value="revised">Revised estimate</option>
            <option value="account">Account (actual)</option>
          </Field>
        </div>

        {loading ? (
          <div className="anomaly-state" role="status">
            <span className="anomaly-spinner" />
            Analyzing comparable spending records…
          </div>
        ) : error ? (
          <div className="anomaly-state anomaly-state-error" role="alert">
            <div>
              <strong>Could not load anomalies</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="anomaly-retry"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        ) : result ? (
          <>
            <div className="anomaly-stats">
              <article>
                <span>Flagged anomalies</span>
                <strong>{fmt(visibleItems.length)}</strong>
              </article>
              <article>
                <span>Unusually high</span>
                <strong>{fmt(highCount)}</strong>
              </article>
              <article>
                <span>Unusually low</span>
                <strong>{fmt(lowCount)}</strong>
              </article>
              <article>
                <span>Affected states / UTs</span>
                <strong>{fmt(affectedStates)}</strong>
              </article>
            </div>
            <p className="anomaly-coverage">
              Checked {fmt(result.checked_records)} eligible records across {fmt(result.groups_checked)} comparable groups. Detection baseline includes all eligible states.
            </p>

            {result.groups_checked === 0 ? (
              <div className="anomaly-empty">
                <strong>Not enough comparable data</strong>
                <p>
                  At least {result.minimum_group_size || 4} non-empty records
                  are needed in a budget-head and fiscal-year group. Try
                  another category or fiscal year.
                </p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="anomaly-empty">
                <strong>{stateName ? `No anomalies found for ${stateName}` : "No statistical outliers found"}</strong>
                <p>
                  {stateName
                    ? "No records for this state fell outside the IQR limits calculated across all eligible states. Try another state or adjust the fiscal year or budget category."
                    : "The selected records did not contain values outside the IQR limits. This does not certify that every value is correct."}
                </p>
              </div>
            ) : (
              <>
                <div className="anomaly-results-heading">
                  <strong>Detected anomalies</strong>
                  <span>Showing {firstResult}–{lastResult} of {fmt(visibleItems.length)}</span>
                </div>
                <div className="anomaly-table-wrap">
                  <table className="anomaly-table">
                    <caption>
                      {stateName
                        ? `Showing ${stateName} only; IQR limits still use all eligible states.`
                        : "Showing anomalies across all states; IQR limits use all eligible states."}
                      {` ${PAGE_SIZE} results per page.`}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">State / UT</th>
                        <th scope="col">Fiscal year</th>
                        <th scope="col">Budget head</th>
                        <th scope="col">{metric === "account" ? "Account" : metric === "revised" ? "Revised" : "Budget"}</th>
                        <th scope="col">IQR allowed range</th>
                        <th scope="col">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item, index) => (
                        <tr key={`${item.state_name}-${item.fiscal_year}-${item.budget_head}-${(page - 1) * PAGE_SIZE + index}`}>
                          <td>{item.state_name}</td>
                          <td>{item.fiscal_year}</td>
                          <td className="anomaly-head-name">{item.budget_head}</td>
                          <td className="anomaly-number">{fmt(item.value)}</td>
                          <td className="anomaly-number">{fmt(item.lower_bound)} – {fmt(item.upper_bound)}</td>
                          <td>
                            <span className={`anomaly-tag anomaly-${item.direction}`}>
                              {item.direction === "high" ? "↑ High" : "↓ Low"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pageCount > 1 && (
                  <nav className="anomaly-pagination" aria-label="Anomaly results pages">
                    <button type="button" onClick={() => setPage(1)} disabled={page === 1} aria-label="First page">« First</button>
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
                    <span>Page {page} of {pageCount}</span>
                    <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next</button>
                    <button type="button" onClick={() => setPage(pageCount)} disabled={page === pageCount} aria-label="Last page">Last »</button>
                  </nav>
                )}
              </>
            )}

            <details className="anomaly-method">
              <summary>How is this calculated?</summary>
              <p>Each group contains comparable records for one budget head in one fiscal year.</p>
              <p><code>IQR = Q3 − Q1</code></p>
              <p><code>Lower limit = Q1 − 1.5 × IQR</code></p>
              <p><code>Upper limit = Q3 + 1.5 × IQR</code></p>
              <p>
                Values outside these limits are flagged. The aggregate “All States/UT”
                row is excluded, and groups with fewer than four non-empty records are skipped.
                The state selector filters displayed anomalies only; it does not recalculate quartiles or bounds.
              </p>
            </details>

            <p className="anomaly-disclaimer">
              A statistical outlier is a signal for further investigation, not evidence
              of an error or wrongdoing. Currency units follow the source dataset.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default SpendingAnomalies;
