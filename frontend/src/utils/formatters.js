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
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
};

export { fmt, fmtDate };
