import { fmt, fmtDate } from "../utils/formatters";

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
        const sourceQuality = qualityBySource.get(String(source.id));
        const missing = sourceQuality
          ? Number(sourceQuality.missing_account || 0) +
            Number(sourceQuality.missing_revised || 0) +
            Number(sourceQuality.missing_budget || 0)
          : null;

        return (
          <article className="source-card" key={source.id}>
            <div className="source-card-head">
              <span className="source-icon" aria-hidden="true">
                ↗
              </span>
              <span className="source-type">RECORDED DATA SOURCE</span>
            </div>

            <h3>{source.name || source.dataset_name || "Unnamed source"}</h3>
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
                <dd>{source.methodology || "No methodology note recorded."}</dd>
              </div>
            </dl>

            {source.source_url ? (
              <a
                className="source-link"
                href={source.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open original source <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="muted">Source URL not recorded</span>
            )}

            <div className="quality-divider" />
            <h4>Data quality snapshot</h4>

            {sourceQuality ? (
              <>
                <div className="quality-score-row">
                  <span>Stored quality score</span>
                  <strong>{fmt(sourceQuality.quality_score)}</strong>
                </div>

                <div className="quality-stats">
                  <div>
                    <strong>{fmt(sourceQuality.total_records)}</strong>
                    <span>Records</span>
                  </div>
                  <div>
                    <strong>{fmt(missing)}</strong>
                    <span>Missing numeric values*</span>
                  </div>
                  <div>
                    <strong>{fmt(sourceQuality.duplicate_records)}</strong>
                    <span>Duplicate records</span>
                  </div>
                </div>

                <details className="quality-breakdown">
                  <summary>Missing-value breakdown</summary>
                  <ul>
                    <li>Account: {fmt(sourceQuality.missing_account)}</li>
                    <li>Revised: {fmt(sourceQuality.missing_revised)}</li>
                    <li>Budget: {fmt(sourceQuality.missing_budget)}</li>
                  </ul>
                </details>

                <p className="note">
                  * Sum of stored missing-value counts across Account, Revised
                  and Budget. The UI displays the stored quality score without
                  inferring its formula.
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
        quality.map((item) => (
          <article className="source-card" key={item.source_id}>
            <h3>Quality metrics for source #{item.source_id}</h3>
            <p className="muted">Source metadata is unavailable.</p>

            <div className="quality-stats">
              <div>
                <strong>{fmt(item.total_records)}</strong>
                <span>Records</span>
              </div>
              <div>
                <strong>{fmt(item.duplicate_records)}</strong>
                <span>Duplicate records</span>
              </div>
              <div>
                <strong>{fmt(item.quality_score)}</strong>
                <span>Stored quality score</span>
              </div>
            </div>
          </article>
        ))}
    </div>
  );
}

export default ProvenanceQuality;
