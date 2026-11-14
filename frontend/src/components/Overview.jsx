import Metric from "./Metric";
import SectionHeader from "./SectionHeader";
import { fmt } from "../utils/formatters";

export default function Overview({ summary, loading, selectedState, selectedCategory }) {
  const metrics = [
    ["Total records", summary?.total_records, "Matching source records", "▤"],
    ["Account", summary?.total_account, "Actual account values", "₹"],
    ["Revised", summary?.total_revised, "Revised estimates", "↗"],
    ["Budget", summary?.total_budget, "Budget estimates", "◫"],
  ];
  const visibleMetrics = loading ? metrics : metrics.filter(([, value]) => Number(value) !== 0);

  return (
    <section className="block">
      <SectionHeader title="Key indicators" description="Aggregated values for the selected records" badge={`${selectedState}${selectedCategory ? ` · ${selectedCategory}` : ""}`} />
      {visibleMetrics.length ? <div className="metrics">
        {visibleMetrics.map(([label, value, note, icon]) => (
          <Metric key={label} label={label} value={loading ? "…" : fmt(value)} note={note} icon={icon} />
        ))}
      </div> : <p className="empty overview-empty">No non-zero summary metrics match the selected filters.</p>}
    </section>
  );
}
