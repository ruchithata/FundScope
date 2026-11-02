import Metric from "./Metric";
import SectionHeader from "./SectionHeader";
import { fmt } from "../utils/formatters";

export default function Overview({ summary, loading, selectedState, selectedCategory }) {
  return (
    <section className="block">
      <SectionHeader title="Key indicators" description="Aggregated values for the selected records" badge={`${selectedState}${selectedCategory ? ` · ${selectedCategory}` : ""}`} />
      <div className="metrics">
        <Metric label="Total records" value={loading ? "…" : fmt(summary?.total_records)} note="Matching source records" icon="▤" />
        <Metric label="Account" value={loading ? "…" : fmt(summary?.total_account)} note="Actual account values" icon="₹" />
        <Metric label="Revised" value={loading ? "…" : fmt(summary?.total_revised)} note="Revised estimates" icon="↗" />
        <Metric label="Budget" value={loading ? "…" : fmt(summary?.total_budget)} note="Budget estimates" icon="◫" />
      </div>
    </section>
  );
}
