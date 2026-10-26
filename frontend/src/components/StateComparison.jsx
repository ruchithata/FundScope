
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmt } from "../utils/formatters";
import Field from "./Field";
import "./StateComparison.css";

const METRICS = [
  { key: "total_records", label: "Total records" },
  { key: "total_account", label: "Account" },
  { key: "total_revised", label: "Revised" },
  { key: "total_budget", label: "Budget" },
];

function formatSigned(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";
  if (number === 0) return fmt(0);

  return `${number > 0 ? "+" : "−"}${fmt(Math.abs(number))}`;
}

function formatPercentage(valueA, valueB) {
  const a = Number(valueA);
  const b = Number(valueB);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  if (a === 0) return b === 0 ? "0%" : "N/A";

  const percentage = ((b - a) / Math.abs(a)) * 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(Math.abs(percentage));

  return `${percentage > 0 ? "+" : percentage < 0 ? "−" : ""}${formatted}%`;
}

function isAggregateState(name) {
  return /^all\s+states\s*\/\s*ut(?:s)?$/i.test((name || "").trim());
}

function StateComparison({ states, years, categories }) {
  const [stateA, setStateA] = useState("");
  const [stateB, setStateB] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const comparableStates = useMemo(
    () => states.filter((item) => !isAggregateState(item.name)),
    [states]
  );

  useEffect(() => {
    if (!stateA || !stateB || stateA === stateB) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadComparison() {
      setLoading(true);
      setError("");

      try {
        const filtersA = {
          state_id: stateA,
          fiscal_year: year,
          appendix: category,
        };

        const filtersB = {
          state_id: stateB,
          fiscal_year: year,
          appendix: category,
        };

        const [summaryA, summaryB] = await Promise.all([
          api.summary(filtersA, controller.signal),
          api.summary(filtersB, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setComparison({ summaryA, summaryB });
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") {
          setComparison(null);
          setError(err.message || "Unable to load comparison.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadComparison();

    return () => controller.abort();
  }, [stateA, stateB, year, category, retryCount]);

  const nameA =
    comparableStates.find((item) => String(item.id) === stateA)?.name ||
    "State A";

  const nameB =
    comparableStates.find((item) => String(item.id) === stateB)?.name ||
    "State B";

  return (
    <section className="block state-comparison" id="state-comparison">
      <div className="sectiontitle">
        <div>
          <h2>State comparison</h2>
          <p>
            Compare state spending using the same fiscal-year and
            budget-category filters.
          </p>
        </div>
        <span>Side-by-side analysis</span>
      </div>

      <div className="comparison-panel">
        <div className="comparison-filters">
          <Field label="First state" value={stateA} onChange={setStateA}>
            <option value="">Select first state</option>
            {comparableStates.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </Field>

          <Field label="Second state" value={stateB} onChange={setStateB}>
            <option value="">Select second state</option>
            {comparableStates.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </Field>

          <Field label="Fiscal year" value={year} onChange={setYear}>
            <option value="">All fiscal years</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Field>

          <Field label="Budget category" value={category} onChange={setCategory}>
            {categories.map(([value, label]) => (
              <option key={value || "all-categories"} value={value}>
                {label}
              </option>
            ))}
          </Field>
        </div>

        {!stateA || !stateB ? (
          <div className="comparison-message" role="status">
            Select two states to view their financial indicators.
          </div>
        ) : stateA === stateB ? (
          <div className="comparison-message comparison-error" role="alert">
            Choose two different states to compare.
          </div>
        ) : loading ? (
          <div
            className="comparison-message"
            role="status"
            aria-live="polite"
          >
            Loading comparison data…
          </div>
        ) : error ? (
          <div className="comparison-message comparison-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="comparison-retry"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Retry
            </button>
          </div>
        ) : stateA && stateB && stateA !== stateB && comparison ? (
          <div className="comparison-results">
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <caption>
                  Comparison of {nameA} and {nameB}. Differences are
                  calculated as {nameB} minus {nameA}.
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Indicator</th>
                    <th scope="col">{nameA}</th>
                    <th scope="col">{nameB}</th>
                    <th scope="col">Difference (B − A)</th>
                    <th scope="col">Change vs. A</th>
                  </tr>
                </thead>

                <tbody>
                  {METRICS.map(({ key, label }) => {
                    const valueA = Number(comparison.summaryA[key] ?? 0);
                    const valueB = Number(comparison.summaryB[key] ?? 0);
                    const difference = valueB - valueA;

                    return (
                      <tr key={key}>
                        <th scope="row">{label}</th>
                        <td>{fmt(comparison.summaryA[key])}</td>
                        <td>{fmt(comparison.summaryB[key])}</td>
                        <td
                          className={
                            difference > 0
                              ? "comparison-positive"
                              : difference < 0
                                ? "comparison-negative"
                                : ""
                          }
                        >
                          {formatSigned(difference)}
                        </td>
                        <td>{formatPercentage(valueA, valueB)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="comparison-footnote">
              Values come from the summary API. A positive difference means
              the second state has a higher value. “N/A” indicates percentage
              change cannot be calculated from a zero baseline.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default StateComparison;
