
const BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function get(path, signal) {
  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Cannot reach the FundScope API. Check that FastAPI is running and VITE_API_BASE_URL is correct.",
      { cause: error }
    );
  }

  if (!response.ok) {
    let message = `API request failed (${response.status}).`;

    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      // Keep the HTTP status message if the response is not valid JSON.
    }

    throw new Error(message);
  }

  return response.json();
}

const qs = (options) => {
  const params = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value !== "" && value != null) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const api = {
  states: (signal) => get("/api/states", signal),

  years: async (signal) => {
    const data = await get("/api/fiscal-years", signal);

    if (!Array.isArray(data)) {
      throw new Error("Invalid fiscal-year response from the API.");
    }

    return data
      .map((item) =>
        typeof item === "string" ? item : item?.fiscal_year
      )
      .filter(
        (year) => typeof year === "string" && year.trim().length > 0
      );
  },

  summary: (filters, signal) =>
    get(`/api/summary${qs(filters)}`, signal),

  trends: (filters, signal) =>
    get(`/api/trends${qs(filters)}`, signal),
};
