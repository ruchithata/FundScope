import React from "react";

function Metric({ label, value, note, icon }) {
  return (
    <article className="metric">
      <div className="metric-top"><span>{label}</span><b aria-hidden="true">{icon}</b></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export default Metric;
