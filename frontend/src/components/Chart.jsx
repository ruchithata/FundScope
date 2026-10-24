import { fmt } from "../utils/formatters";

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
  const y = (value) => 18 + ((high - value) / (high - low || 1)) * 220;

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

export default Chart;
