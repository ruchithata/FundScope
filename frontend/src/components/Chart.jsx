import { fmt } from "../utils/formatters";

const SERIES = [
  ["total_account", "Account", "#0f766e"],
  ["total_revised", "Revised", "#3974d8"],
  ["total_budget", "Budget", "#c18b2c"],
];

export default function Chart({ items = [], loading, selectedYear = "" }) {
  if (loading) return <div className="empty">Loading trend data…</div>;
  const rows = [...items].sort((a, b) => String(a.fiscal_year).localeCompare(String(b.fiscal_year)));
  if (!rows.length) return <div className="empty">No annual trend data is available for these filters.</div>;

  // RBI e-STATES data is annual. When a fiscal year is selected, compare the
  // three available annual measures rather than implying monthly observations.
  if (selectedYear) {
    const selected = rows.find((row) => String(row.fiscal_year) === String(selectedYear));
    if (!selected) {
      return <div className="empty">
        No annual trend record was returned for {selectedYear}. Try clearing the fiscal-year filter or check the API response.
      </div>;
    }

    const values = SERIES.map(([key]) => Number(selected[key]) || 0);
    const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
    const chartTop = 30;
    const chartBottom = 225;
    const chartHeight = chartBottom - chartTop;
    const baseline = chartTop + (Math.max(0, ...values) / (Math.max(0, ...values) + Math.abs(Math.min(0, ...values)) || 1)) * chartHeight;
    const scale = (value) => (Math.abs(value) / maxAbs) * (chartHeight * 0.82);
    const barWidth = 100;
    const centers = [170, 400, 630];

    return (
      <div className="chart">
        <div className="legend">{SERIES.map(([key, label, color]) => <span key={key}><i style={{ background: color }} />{label}</span>)}</div>
        <svg viewBox="0 0 800 280" role="img" aria-label={`Account, Revised and Budget annual values for ${selectedYear}`}>
          <title>Annual spending measures for {selectedYear}</title>
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = 25 + 50 * tick;
            return <line key={tick} x1="55" x2="755" y1={y} y2={y} stroke="#edf0ee" />;
          })}
          <line x1="55" x2="755" y1={baseline} y2={baseline} stroke="#b7c2bc" strokeWidth="1.2" />
          {SERIES.map(([key, label, color], index) => {
            const value = Number(selected[key]) || 0;
            const height = Math.max(2, scale(value));
            const y = value >= 0 ? baseline - height : baseline;
            return <g key={key}>
              <rect x={centers[index] - barWidth / 2} y={y} width={barWidth} height={height} rx="5" fill={color} opacity="0.92" />
              <text x={centers[index]} y={value >= 0 ? y - 9 : y + height + 16} textAnchor="middle" className="chart-value">{fmt(value)}</text>
              <text x={centers[index]} y="258" textAnchor="middle" className="axis">{label}</text>
            </g>;
          })}
        </svg>
        <p className="note">Annual values only — no monthly values have been inferred or fabricated. Currency units follow the source dataset.</p>
      </div>
    );
  }

  const values = rows.flatMap((row) => SERIES.map(([key]) => Number(row[key]) || 0));
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const x = (index) => rows.length === 1 ? 400 : 55 + (index * 700) / (rows.length - 1);
  const y = (value) => 18 + ((high - value) / (high - low || 1)) * 220;

  return (
    <div className="chart">
      <div className="legend">{SERIES.map(([key, label, color]) => <span key={key}><i style={{ background: color }} />{label}</span>)}</div>
      <svg viewBox="0 0 800 280" role="img" aria-label="Annual Account, Revised and Budget aggregates across fiscal years">
        <title>Annual spending trends by fiscal year</title>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = high - ((high - low) * tick) / 4;
          const yPosition = 18 + 55 * tick;
          return <g key={tick}>
            <line x1="55" x2="755" y1={yPosition} y2={yPosition} stroke="#edf0ee" />
            <text x="47" y={yPosition + 4} textAnchor="end" className="axis">{fmt(value)}</text>
          </g>;
        })}
        {SERIES.map(([key, , color]) => <polyline key={key}
          points={rows.map((row, index) => `${x(index)},${y(Number(row[key]) || 0)}`).join(" ")}
          fill="none" stroke={color} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />)}
        {rows.map((row, index) => index % Math.max(1, Math.ceil(rows.length / 8)) === 0 || index === rows.length - 1
          ? <text key={`${row.fiscal_year}-${index}`} x={x(index)} y="260" textAnchor="middle" className="axis">{row.fiscal_year}</text>
          : null)}
      </svg>
      <p className="note">Annual aggregates from the API. Select one fiscal year to compare its three financial measures. Original negative values are retained.</p>
    </div>
  );
}
