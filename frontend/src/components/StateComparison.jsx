import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmt } from "../utils/formatters";
import Field from "./Field";
import SectionHeader from "./SectionHeader";

const METRICS = [
  ["total_records", "Total records"], ["total_account", "Account"],
  ["total_revised", "Revised"], ["total_budget", "Budget"],
];
const isAggregate = (name) => /^all\s+states\s*\/\s*ut(?:s)?$/i.test((name || "").trim());
function signed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (!n) return fmt(0);
  return `${n > 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
}
function percentage(a, b) {
  a = Number(a); b = Number(b);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  if (a === 0) return b === 0 ? "0%" : "N/A";
  const p = ((b - a) / Math.abs(a)) * 100;
  return `${p > 0 ? "+" : p < 0 ? "−" : ""}${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(Math.abs(p))}%`;
}

export default function StateComparison({ states, years, categories }) {
  const [stateA, setStateA] = useState("");
  const [stateB, setStateB] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const choices = useMemo(() => states.filter((s) => !isAggregate(s.name)), [states]);

  useEffect(() => {
    if (!stateA || !stateB || stateA === stateB) { setData(null); setLoading(false); setError(""); return undefined; }
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const [a, b] = await Promise.all([
          api.summary({ state_id: stateA, fiscal_year: year, appendix: category }, controller.signal),
          api.summary({ state_id: stateB, fiscal_year: year, appendix: category }, controller.signal),
        ]);
        if (!controller.signal.aborted) setData({ a, b });
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") { setData(null); setError(err.message || "Unable to load comparison."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    return () => controller.abort();
  }, [stateA, stateB, year, category, retry]);

  const nameA = choices.find((s) => String(s.id) === stateA)?.name || "State A";
  const nameB = choices.find((s) => String(s.id) === stateB)?.name || "State B";

  return <section className="block" id="state-comparison">
    <SectionHeader title="State comparison" description="Compare two states using the same fiscal-year and category filters." badge="Side-by-side analysis" />
    <div className="panel">
      <div className="comparison-filters">
        <Field label="First state" value={stateA} onChange={setStateA}><option value="">Select first state</option>{choices.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</Field>
        <Field label="Second state" value={stateB} onChange={setStateB}><option value="">Select second state</option>{choices.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</Field>
        <Field label="Fiscal year" value={year} onChange={setYear}><option value="">All fiscal years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Field>
        <Field label="Budget category" value={category} onChange={setCategory}>{categories.map(([v, label]) => <option key={v || "all"} value={v}>{label}</option>)}</Field>
      </div>
      {!stateA || !stateB ? <div className="state-message">Select two states to view their financial indicators.</div>
        : stateA === stateB ? <div className="state-message error-text">Choose two different states to compare.</div>
        : loading ? <div className="state-message" role="status">Loading comparison data…</div>
        : error ? <div className="error" role="alert"><p>{error}</p><button onClick={() => setRetry((n) => n + 1)}>Retry</button></div>
        : data ? <>
          <div className="table-wrap"><table><caption>Differences are calculated as {nameB} minus {nameA}.</caption>
            <thead><tr><th>Indicator</th><th>{nameA}</th><th>{nameB}</th><th>Difference (B − A)</th><th>Change vs. A</th></tr></thead>
            <tbody>{METRICS.map(([key, label]) => {
              const a = Number(data.a[key] ?? 0); const b = Number(data.b[key] ?? 0); const diff = b - a;
              return <tr key={key}><th>{label}</th><td>{fmt(data.a[key])}</td><td>{fmt(data.b[key])}</td><td className={diff > 0 ? "positive" : diff < 0 ? "negative" : ""}>{signed(diff)}</td><td>{percentage(a, b)}</td></tr>;
            })}</tbody>
          </table></div>
          <p className="muted small">A positive difference means the second state has a higher value. “N/A” indicates percentage change cannot be calculated from a zero baseline.</p>
        </> : null}
    </div>
  </section>;
}
