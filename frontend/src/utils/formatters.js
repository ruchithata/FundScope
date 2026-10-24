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

const fmtDate = (value) => {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
};

export { fmt, fmtDate };
