const BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

async function get(path, signal) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Cannot reach the FundScope API. Check that FastAPI is running and VITE_API_BASE_URL is correct.");
  }
  if (!response.ok) {
    let message = `API request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export function qs(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value != null) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const api = {
  states: (signal) => get("/api/states", signal),
  years: async (signal) => {
    const data = await get("/api/fiscal-years", signal);
    if (!Array.isArray(data)) throw new Error("Invalid fiscal-year response from the API.");
    return data.map((item) => typeof item === "string" ? item : item?.fiscal_year)
      .filter((year) => typeof year === "string" && year.trim());
  },
  summary: (filters, signal) => get(`/api/summary${qs(filters)}`, signal),
  trends: (filters, signal) => get(`/api/trends${qs(filters)}`, signal),
  dataSources: (signal) => get("/api/data-sources", signal),
  dataQuality: (signal) => get("/api/data-quality", signal),
  anomalies: (filters, signal) => get(`/api/anomalies${qs(filters)}`, signal),
  async exportCsv(filters) {
    const response = await fetch(`${BASE}/api/spending/export.csv${qs(filters)}`, {
      headers: { Accept: "text/csv" },
    });
    if (!response.ok) {
      let message = `Export failed (HTTP ${response.status}).`;
      try {
        const body = await response.json();
        if (typeof body.detail === "string") message = body.detail;
      } catch {}
      throw new Error(message);
    }
    return response.blob();
  },
};
