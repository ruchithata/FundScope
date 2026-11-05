import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmt } from "../utils/formatters";
import SectionHeader from "./SectionHeader";
import "./BudgetBreakdown.css";

const MEASURES = [
  ["total_account", "Account / actual"],
  ["total_revised", "Revised estimate"],
  ["total_budget", "Budget estimate"],
];

const compact = (value) => new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
}).format(Number(value) || 0);

export default function BudgetBreakdown({ states, years, state, category }) {
  const [year, setYear] = useState("");
  const [metric, setMetric] = useState("total_budget");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const selectedYear = years.includes(year) ? year : years[0] || "";

  useEffect(() => {
    if (!selectedYear) return undefined;

    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await api.budgetBreakdown({
          fiscal_year: selectedYear,
          state_id: state,
          appendix: category,
        }, controller.signal);
        if (!controller.signal.aborted) setPayload(result);
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") {
          setPayload(null);
          setError(err.message || "Unable to load budget breakdown.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [selectedYear, state, category, retry]);

  const rows = useMemo(() => payload?.items || [], [payload]);
  const total = rows.reduce((sum, row) => sum + (Number(row[metric]) || 0), 0);
  const max = Math.max(0, ...rows.map((row) => Number(row[metric]) || 0));
  const label = MEASURES.find(([key]) => key === metric)?.[1] || "Budget estimate";
  const stateName = states.find((item) => String(item.id) === state)?.name || "All states / UTs";

  return (
    <section className="block" id="budget-breakdown">
      <SectionHeader
        title="Budget allocation & expenditure"
        description="Compare annual budget estimates, revised estimates and account values across budget heads."
        badge={selectedYear || "Select fiscal year"}
      />
      <div className="panel budget-breakdown">
        <div className="budget-controls">
          <label className="field">Fiscal year
            <select value={selectedYear} onChange={(event) => setYear(event.target.value)}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">Bar chart measure
            <select value={metric} onChange={(event) => setMetric(event.target.value)}>
              {MEASURES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          <div className="budget-context">
            <span>Scope</span><strong>{stateName}</strong>
            <small>{category || "All appendices"}</small>
          </div>
        </div>
        {!selectedYear ? <div className="empty">No fiscal years are available.</div>
          : loading ? <div className="empty" role="status">Loading budget-head breakdown…</div>
            : error ? <div className="error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>
              : !rows.length ? <div className="empty-box"><b>No budget-head records found.</b><p>Try another fiscal year, state or appendix filter.</p></div>
                : <>
                  <div className="budget-summary">
                    <div><span>Total {label.toLowerCase()}</span><strong>₹ {fmt(total)}</strong></div>
                    <div><span>Budget heads</span><strong>{fmt(rows.length)}</strong></div>
                    <div><span>Fiscal year</span><strong>{selectedYear}</strong></div>
                  </div>
                  <div className="budget-bars" aria-label={`${label} by budget head`}>
                    {rows.map((row) => {
                      const value = Number(row[metric]) || 0;
                      const width = max > 0 ? Math.max(0, value / max * 100) : 0;
                      return <div className="budget-bar-row" key={row.budget_head_id}>
                        <div className="budget-bar-label">
                          <span title={row.budget_head}>{row.budget_head}</span><strong>₹ {compact(value)}</strong>
                        </div>
                        <div className="budget-bar-track"><i style={{ width: `${width}%` }} /></div>
                      </div>;
                    })}
                  </div>
                  <div className="table-wrap"><table>
                    <caption>Annual totals by budget head. Utilization = Account ÷ Budget × 100.</caption>
                    <thead><tr><th>Budget head</th><th>Appendix</th><th>Account</th><th>Revised</th><th>Budget</th><th>Utilization</th></tr></thead>
                    <tbody>{rows.map((row) => <tr key={row.budget_head_id}>
                      <th className="head-name">{row.budget_head}</th><td>{row.appendix}</td>
                      <td className="number">{fmt(row.total_account)}</td><td className="number">{fmt(row.total_revised)}</td>
                      <td className="number">{fmt(row.total_budget)}</td>
                      <td className="number">{row.utilization_percent == null ? "—" : `${fmt(row.utilization_percent)}%`}</td>
                    </tr>)}</tbody>
                  </table></div>
                  <p className="note">Source units are retained. One fiscal year is shown at a time to avoid adding allocations from different years together.</p>
                </>}
      </div>
    </section>
  );
}
