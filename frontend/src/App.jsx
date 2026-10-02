
import { useEffect, useState } from "react";
import { api } from "./api";
import "./index.css";

const fmt = (value) => {
  if (value == null || value === "") return "—";

  const number = Number(value);

  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2,
        notation: Math.abs(number) >= 1e9 ? "compact" : "standard",
      }).format(number)
    : "—";
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
        onChange={(event) => onChange(event.target.value)}
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

  const x = (index) =>
    rows.length === 1 ? 400 : 42 + (index * 716) / (rows.length - 1);

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
          const yPosition = 18 + 55 * tick;

          return (
            <g key={tick}>
              <line
                x1="42"
                x2="758"
                y1={yPosition}
                y2={yPosition}
                stroke="#edf0ee"
              />
              <text
                x="34"
                y={yPosition + 4}
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
                (row, index) =>
                  `${x(index)},${y(Number(row[item[0]]) || 0)}`
              )
              .join(" ")}
            fill="none"
            stroke={item[2]}
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {rows.map((row, index) =>
          index % Math.max(1, Math.ceil(rows.length / 8)) === 0 ||
          index === rows.length - 1 ? (
            <text
              key={`${row.fiscal_year}-${index}`}
              x={x(index)}
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

export default function App() {
  const [states, setStates] = useState([]);
  const [years, setYears] = useState([]);

  const [state, setState] = useState("");
  const [year, setYear] = useState("");
  const [cat, setCat] = useState("");

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);

  const [optionsLoadedKey, setOptionsLoadedKey] = useState(null);
  const [optionsFailed, setOptionsFailed] = useState(null);

  const [dataLoadedKey, setDataLoadedKey] = useState(null);
  const [dataFailed, setDataFailed] = useState(null);

  const [reload, setReload] = useState(0);

  const optionsKey = String(reload);
  const dataKey = JSON.stringify([state, year, cat, reload]);

  const optionsBusy =
    optionsLoadedKey !== optionsKey &&
    optionsFailed !== optionsKey;

  const busy =
    dataLoadedKey !== dataKey &&
    dataFailed?.key !== dataKey;

  const error =
    (optionsFailed === optionsKey
      ? "Unable to load dashboard filters. Please try again."
      : "") ||
    (dataFailed?.key === dataKey ? dataFailed.message : "");

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
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setOptionsFailed(optionsKey);
        }
      });

    return () => controller.abort();
  }, [optionsKey]);

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
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setDataFailed({ key: dataKey, message: error.message });
        }
      });

    return () => controller.abort();
  }, [state, year, cat, dataKey]);

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

          <button onClick={() => setReload((value) => value + 1)}>
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
              {years.map((item) => {
                const fiscalYear =
                  typeof item === "string" ? item : item?.fiscal_year;

                if (!fiscalYear) return null;

                return (
                  <option key={fiscalYear} value={fiscalYear}>
                    {fiscalYear}
                  </option>
                );
              })}
            </Field>

            <Field label="Budget category" value={cat} onChange={setCat}>
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
            <button onClick={() => setReload((value) => value + 1)}>
              Try again
            </button>
          </div>
        )}

        <section className="block">
          <div className="sectiontitle">
            <div>
              <h2>Key indicators</h2>
              <p>Aggregated values for the selected records</p>
            </div>
            <span>
              {selectedState} · {selectedCategory}
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
              <p>Annual aggregates across the selected state and category</p>
            </div>
            <span>{year || "All available years"}</span>
          </div>

          <article className="chartcard">
            <Chart items={trends} loading={busy} />
          </article>
        </section>

        <footer>
          FundScope · Data-led public finance exploration
          <span>Source: RBI e-STATES Database</span>
        </footer>
      </main>
    </div>
  );
}
