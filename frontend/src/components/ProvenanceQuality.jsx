import { fmt, fmtDate } from "../utils/formatters";
import SectionHeader from "./SectionHeader";

export default function ProvenanceQuality({ sources, quality, loading, error }) {
  if (loading) return <div className="state-message">Loading source and data-quality metadata…</div>;
  if (error) return <div className="error" role="alert">{error}</div>;
  if (!sources.length && !quality.length) return <div className="empty-box">Source metadata and quality metrics have not been recorded yet.</div>;

  const bySource = new Map(quality.map((item) => [String(item.source_id), item]));
  return <section className="block" id="provenance">
    <SectionHeader title="Data provenance & quality" description="Source metadata and recorded ingestion checks for transparency" badge="Source-backed metadata" />
    <div className="source-grid">
      {sources.map((source) => {
        const q = bySource.get(String(source.id));
        const missing = q ? Number(q.missing_account || 0) + Number(q.missing_revised || 0) + Number(q.missing_budget || 0) : null;
        return <article className="source-card" key={source.id}>
          <div className="source-card-head"><span className="source-icon">↗</span><span className="eyebrow">RECORDED DATA SOURCE</span></div>
          <h3>{source.name || source.dataset_name || "Unnamed source"}</h3>
          <p className="muted">{source.dataset_name || "Dataset name not recorded"}</p>
          <dl className="source-details">
            <div><dt>Publisher</dt><dd>{source.publisher || "Not recorded"}</dd></div>
            <div><dt>Retrieved</dt><dd>{fmtDate(source.retrieved_at)}</dd></div>
            <div><dt>Methodology</dt><dd>{source.methodology || "No methodology note recorded."}</dd></div>
          </dl>
          {source.source_url ? <a className="source-link" href={source.source_url} target="_blank" rel="noreferrer">Open original source ↗</a> : <span className="muted">Source URL not recorded</span>}
          <hr />
          <h4>Data quality snapshot</h4>
          {q ? <>
            <div className="quality-score"><span>Stored quality score</span><b>{fmt(q.quality_score)}</b></div>
            <div className="quality-stats">
              <div><strong>{fmt(q.total_records)}</strong><span>Records</span></div>
              <div><strong>{fmt(missing)}</strong><span>Missing numeric values*</span></div>
              <div><strong>{fmt(q.duplicate_records)}</strong><span>Duplicate records</span></div>
            </div>
            <details><summary>Missing-value breakdown</summary><ul><li>Account: {fmt(q.missing_account)}</li><li>Revised: {fmt(q.missing_revised)}</li><li>Budget: {fmt(q.missing_budget)}</li></ul></details>
            <p className="muted small">* Sum of stored missing-value counts. The UI does not infer the quality-score formula.</p>
          </> : <p className="muted">No quality metrics are recorded for this source.</p>}
        </article>;
      })}
      {!sources.length && quality.map((q) => <article className="source-card" key={q.source_id}><h3>Quality metrics for source #{q.source_id}</h3><div className="quality-stats"><div><strong>{fmt(q.total_records)}</strong><span>Records</span></div><div><strong>{fmt(q.duplicate_records)}</strong><span>Duplicates</span></div><div><strong>{fmt(q.quality_score)}</strong><span>Stored score</span></div></div></article>)}
    </div>
  </section>;
}
