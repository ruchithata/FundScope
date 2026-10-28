import Field from "./Field";

export const CATEGORIES = [
  ["", "All appendices"],
  ["Appendix-1", "Revenue receipts"],
  ["Appendix-2", "Revenue expenditure"],
  ["Appendix-3", "Capital receipts"],
  ["Appendix-4", "Capital expenditure"],
];

export default function DashboardFilters({ states, years, state, year, category, setState, setYear, setCategory, disabled }) {
  return (
    <section className="filters" aria-label="Global dashboard filters">
      <div className="filterhead">
        <b>Global filters</b><span>Refine the overview and trend chart</span>
        <button type="button" onClick={() => { setState(""); setYear(""); setCategory(""); }}>Clear all</button>
      </div>
      <div className="fields">
        <Field label="State / UT" value={state} onChange={setState} disabled={disabled}>
          <option value="">All states / UTs</option>
          {states.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
        </Field>
        <Field label="Fiscal year" value={year} onChange={setYear} disabled={disabled}>
          <option value="">All fiscal years</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Field>
        <Field label="Budget category" value={category} onChange={setCategory}>
          {CATEGORIES.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}
        </Field>
      </div>
    </section>
  );
}
