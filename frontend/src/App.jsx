
import { useEffect, useState } from "react";
import { api } from "./api";
import "./index.css";

const fmt = (value) => {
  if (value == null || value === "") return "—";

  const n = Number(value);

  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2,
        notation: Math.abs(n) >= 1e9 ? "compact" : "standard",
      }).format(n)
    : "—";
};

const fmtDate = (value) => {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
      }).format(date);
};

const cats = [
  ["", "All appendices"],
  ["Appendix-1", "Revenue receipts"],
  ["Appendix-2", "Revenue expenditure"],
  ["Appendix-3", "Capital receipts"],
  ["Appendix-4", "Capital expenditure"],
];

function Field({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function Metric({ label, value, note, icon }) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <b aria-hidden="true">{icon}</b>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Chart({ items, loading }) {
  if (loading) {
    return <div className="empty">Loading trend data…</div>;
  }

  const rows = [...items].reverse();

  if (!rows.length) {
    return <div className="empty">No trend data for these filters.</div>;
  }

  const series = [
    ["total_account", "Account", "#0f766e"],
    ["total_revised", "Revised", "#3974d8"],
    ["total_budget", "Budget", "#c18b2c"],
  ];

  const values = rows.flatMap((row) =>
    series.map((item) => Number(row[item[0]]) || 0)
  );

  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);

  const x = (i) =>
    rows.length === 1 ? 400 : 42 + (i * 716) / (rows.length - 1);

  const y = (value) =>
    18 + ((high - value) / (high - low || 1)) * 220;

  return (
    <div className="chart">
      <div className="legend">
        {series.map((item) => (
          <span key={item[0]}>
            <i style={{ background: item[2] }} />
            {item[1]}
          </span>
        ))}
      </div>

      <svg
        viewBox="0 0 800 280"
        role="img"
        aria-label="Annual Account, Revised and Budget aggregates"
      >
        <title>Spending trends by fiscal year</title>

        {[0, 1, 2, 3, 4].map((tick) => {
          const value = high - ((high - low) * tick) / 4;
          const yp = 18 + 55 * tick;

          return (
            <g key={tick}>
              <line
                x1="42"
                x2="758"
                y1={yp}
                y2={yp}
                stroke="#edf0ee"
              />
              <text
                x="34"
                y={yp + 4}
                textAnchor="end"
                className="axis"
              >
                {fmt(value)}
              </text>
            </g>
          );
        })}

        {series.map((item) => (
          <polyline
            key={item[0]}
            points={rows
              .map(
                (row, i) =>
                  `${x(i)},${y(Number(row[item[0]]) || 0)}`
              )
              .join(" ")}
            fill="none"
            stroke={item[2]}
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {rows.map((row, i) =>
          i % Math.max(1, Math.ceil(rows.length / 8)) === 0 ||
          i === rows.length - 1 ? (
            <text
              key={`${row.fiscal_year}-${i}`}
              x={x(i)}
              y="260"
              textAnchor="middle"
              className="axis"
            >
              {row.fiscal_year}
            </text>
          ) : null
        )}
      </svg>

      <p className="note">
        Aggregates are returned by the API. Original negative values are
        retained.
      </p>
    </div>
  );
}

function ProvenanceQuality({ sources, quality, loading, error }) {
  if (loading) {
    return (
      <div className="provenance-state" role="status">
        Loading source and data-quality metadata…
      </div>
    );
  }

  if (error) {
    return (
      <div className="provenance-state provenance-error" role="alert">
        {error}
      </div>
    );
  }

  if (!sources.length && !quality.length) {
    return (
      <div className="provenance-state">
        Source metadata and quality metrics have not been recorded for this
        dataset yet.
      </div>
    );
  }

  const qualityBySource = new Map(
    quality.map((item) => [String(item.source_id), item])
  );

  return (
    <div className="source-grid">
      {sources.map((source) => {
        const q = qualityBySource.get(String(source.id));

        const missing = q
          ? Number(q.missing_account || 0) +
            Number(q.missing_revised || 0) +
            Number(q.missing_budget || 0)
          : null;

        return (
          <article className="source-card" key={source.id}>
            <div className="source-card-head">
              <span className="source-icon" aria-hidden="true">
                ↗
              </span>
              <span className="source-type">RECORDED DATA SOURCE</span>
            </div>

            <h3>
              {source.name || source.dataset_name || "Unnamed source"}
            </h3>

            <p className="source-dataset">
              {source.dataset_name || "Dataset name not recorded"}
            </p>

            <dl className="source-details">
              <div>
                <dt>Publisher</dt>
                <dd>{source.publisher || "Not recorded"}</dd>
              </div>

              <div>
                <dt>Retrieved</dt>
                <dd>{fmtDate(source.retrieved_at)}</dd>
              </div>

              <div>
                <dt>Methodology</dt>
                <dd>
                  {source.methodology || "No methodology note recorded."}
                </dd>
              </div>
            </dl>

            {source.source_url ? (
              <a
                className="source-link"
                href={source.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open original source{" "}
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="muted">Source URL not recorded</span>
            )}

            <div className="quality-divider" />

            <h4>Data quality snapshot</h4>

            {q ? (
              <>
                <div className="quality-score-row">
                  <span>Stored quality score</span>
                  <strong>{fmt(q.quality_score)}</strong>
                </div>

                <div className="quality-stats">
                  <div>
                    <strong>{fmt(q.total_records)}</strong>
                    <span>Records</span>
                  </div>

                  <div>
                    <strong>{fmt(missing)}</strong>
                    <span>Missing numeric values*</span>
                  </div>

                  <div>
                    <strong>{fmt(q.duplicate_records)}</strong>
                    <span>Duplicate records</span>
                  </div>
                </div>

                <details className="quality-breakdown">
                  <summary>Missing-value breakdown</summary>
                  <ul>
                    <li>Account: {fmt(q.missing_account)}</li>
                    <li>Revised: {fmt(q.missing_revised)}</li>
                    <li>Budget: {fmt(q.missing_budget)}</li>
                  </ul>
                </details>

                <p className="note">
                  * Sum of stored missing-value counts across Account,
                  Revised and Budget. The UI displays the stored quality
                  score without inferring its formula.
                </p>
              </>
            ) : (
              <p className="muted">
                No quality metrics are recorded for this source.
              </p>
            )}
          </article>
        );
      })}

      {!sources.length &&
        quality.map((q) => (
          <article className="source-card" key={q.source_id}>
            <h3>Quality metrics for source #{q.source_id}</h3>
            <p className="muted">Source metadata is unavailable.</p>

            <div className="quality-stats">
              <div>
                <strong>{fmt(q.total_records)}</strong>
                <span>Records</span>
              </div>

              <div>
                <strong>{fmt(q.duplicate_records)}</strong>
                <span>Duplicate records</span>
              </div>

              <div>
                <strong>{fmt(q.quality_score)}</strong>
                <span>Stored quality score</span>
              </div>
            </div>
          </article>
        ))}
    </div>
  );
}

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

  const [reload, setReload] = useState(0);

  const optionsKey = String(reload);
  const dataKey = JSON.stringify([state, year, cat, reload]);

  const optionsBusy =
    optionsLoadedKey !== optionsKey && optionsFailed !== optionsKey;

  const busy =
    dataLoadedKey !== dataKey && dataFailed?.key !== dataKey;

  const error =
    (optionsFailed === optionsKey
      ? "Unable to load dashboard filters. Please try again."
      : "") ||
    (dataFailed?.key === dataKey ? dataFailed.message : "");

  // Shared refresh handler for the dashboard and provenance data.
  const refreshDashboard = () => {
    setProvLoading(true);
    setProvError("");
    setReload((value) => value + 1);
  };

  // Load state and fiscal-year filter options.
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api.states(controller.signal),
      api.years(controller.signal),
    ])
      .then(([stateData, yearData]) => {
        if (controller.signal.aborted) return;

        setStates(stateData);
        setYears(yearData);
        setOptionsLoadedKey(optionsKey);
        setOptionsFailed(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError") {
          setOptionsFailed(optionsKey);
        }
      });

    return () => controller.abort();
  }, [optionsKey]);

  // Load summary and multi-year trend data.
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api.summary(
        {
          state_id: state,
          fiscal_year: year,
          appendix: cat,
        },
        controller.signal
      ),
      api.trends(
        {
          state_id: state,
          appendix: cat,
        },
        controller.signal
      ),
    ])
      .then(([summaryData, trendData]) => {
        if (controller.signal.aborted) return;

        setSummary(summaryData);
        setTrends(trendData.items || []);
        setDataLoadedKey(dataKey);
        setDataFailed(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError") {
          setDataFailed({
            key: dataKey,
            message: e.message,
          });
        }
      });

    return () => controller.abort();
  }, [state, year, cat, dataKey]);

  // Load source provenance and data-quality metadata.
  // Do not synchronously update loading state inside this effect.
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api.dataSources(controller.signal),
      api.dataQuality(controller.signal),
    ])
      .then(([sourceData, qualityData]) => {
        if (controller.signal.aborted) return;

        if (
          !Array.isArray(sourceData) ||
          !Array.isArray(qualityData)
        ) {
          throw new Error(
            "Unexpected source or data-quality response from API."
          );
        }

        setSources(sourceData);
        setQuality(qualityData);
        setProvError("");
        setProvLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError") {
          setProvError(
            e.message || "Unable to load source metadata."
          );
          setProvLoading(false);
        }
      });

    return () => controller.abort();
  }, [reload]);

  const selectedState =
    states.find((item) => String(item.id) === state)?.name ||
    "All states / UTs";

  const selectedCategory =
    cats.find((item) => item[0] === cat)?.[1] || "";

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <i>F</i>
          Fund<span>Scope</span>
        </a>

        <small className="navlabel">WORKSPACE</small>

        <a className="nav active" href="#overview">
          ▦ Overview
        </a>

        <a className="nav" href="#trends">
          ⌁ Spending trends
        </a>

        <a className="nav" href="#provenance">
          ◎ Data provenance
        </a>

        <div className="sidebottom">
          <b>● RBI e-STATES</b>
          <p>Evidence-first public finance exploration.</p>
        </div>
      </aside>

      <main className="main" id="overview">
        <header>
          <span>Workspace / Overview</span>
          <span className="live">● Live data connection</span>
        </header>

        <section className="heading">
          <div>
            <small>PUBLIC FINANCE INTELLIGENCE</small>
            <h1>Spending overview</h1>
            <p>
              Explore state finances through transparent, source-backed data.
            </p>
          </div>

          <button onClick={refreshDashboard}>
            ↻ <span>Refresh</span>
          </button>
        </section>

        <section className="filters">
          <div className="filterhead">
            <b>Filters</b>
            <span>Refine the data shown below</span>
            <button
              onClick={() => {
                setState("");
                setYear("");
                setCat("");
              }}
            >
              Clear all
            </button>
          </div>

          <div className="fields">
            <Field
              label="State / UT"
              value={state}
              onChange={setState}
              disabled={optionsBusy}
            >
              <option value="">All states / UTs</option>
              {states.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Field>

            <Field
              label="Fiscal year"
              value={year}
              onChange={setYear}
              disabled={optionsBusy}
            >
              <option value="">All fiscal years</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Field>

            <Field
              label="Budget category"
              value={cat}
              onChange={setCat}
            >
              {cats.map((item) => (
                <option key={item[0]} value={item[0]}>
                  {item[1]}
                </option>
              ))}
            </Field>
          </div>
        </section>

        {error && (
          <div className="error" role="alert">
            <div>
              <b>We couldn't load the dashboard.</b>
              <p>{error}</p>
            </div>
            <button onClick={refreshDashboard}>Try again</button>
          </div>
        )}

        <section className="block">
          <div className="sectiontitle">
            <div>
              <h2>Key indicators</h2>
              <p>Aggregated values for the selected records</p>
            </div>

            <span>
              {selectedState}
              {selectedCategory ? ` · ${selectedCategory}` : ""}
            </span>
          </div>

          <div className="metrics">
            <Metric
              label="Total records"
              value={busy ? "…" : fmt(summary?.total_records)}
              note="Matching source records"
              icon="▤"
            />

            <Metric
              label="Account"
              value={busy ? "…" : fmt(summary?.total_account)}
              note="Actual account values"
              icon="₹"
            />

            <Metric
              label="Revised"
              value={busy ? "…" : fmt(summary?.total_revised)}
              note="Revised estimates"
              icon="↗"
            />

            <Metric
              label="Budget"
              value={busy ? "…" : fmt(summary?.total_budget)}
              note="Budget estimates"
              icon="◫"
            />
          </div>
        </section>

        <section className="block" id="trends">
          <div className="sectiontitle">
            <div>
              <h2>Spending over time</h2>
              <p>
                Annual aggregates across the selected state and category
              </p>
            </div>

            <span>{year || "All available years"}</span>
          </div>

          <article className="chartcard">
            <Chart items={trends} loading={busy} />
          </article>
        </section>

        <section className="block" id="provenance">
          <div className="sectiontitle">
            <div>
              <h2>Data provenance &amp; quality</h2>
              <p>
                Source metadata and recorded ingestion checks for
                transparency
              </p>
            </div>

            <span>Source-backed metadata</span>
          </div>

          <ProvenanceQuality
            sources={sources}
            quality={quality}
            loading={provLoading}
            error={provError}
          />
        </section>

        <footer>
          <span>FundScope · Data-led public finance exploration</span>
          <span>Source metadata is shown as recorded in the database.</span>
        </footer>
      </main>
    </div>
  );
}
