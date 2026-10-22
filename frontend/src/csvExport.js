const MAX_EXPORT_RECORDS = 100_000;
const PAGE_SIZE = 500;
const COLUMNS = [
  ["id", "Record ID"],
  ["state_id", "State ID"],
  ["budget_head_id", "Budget head ID"],
  ["source_id", "Source ID"],
  ["fiscal_year", "Fiscal year"],
  ["account", "Account"],
  ["revised", "Revised"],
  ["budget", "Budget"],
];


function csvCell(value) {
  if (value == null) return "";

  let text = String(value);

  // Prevent spreadsheet formula injection when a CSV is opened in office software.
  const startsWithFormulaAfterWhitespace = /^[\s]*[=+@-]/.test(text);
  const isNegativeNumber = /^-\d+(?:\.\d+)?$/.test(text);

  if (startsWithFormulaAfterWhitespace && !isNegativeNumber) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}


export function toCsv(records) {
  const header = COLUMNS.map(([, label]) => csvCell(label)).join(",");
  const lines = records.map((record) =>
    COLUMNS.map(([key]) => csvCell(record[key])).join(",")
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export async function fetchAllSpending({ baseUrl, filters, signal, fetchImpl = fetch }) {
  const records = [];
  let expectedTotal = null;
  let page = 1;

  while (true) {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    for (const [key, value] of Object.entries(filters || {})) {
      if (value !== "" && value != null) params.set(key, String(value));
    }

    let response;
    try {
      response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/spending?${params}`, {
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new Error("Could not connect to FundScope API while exporting.", { cause: error });
    }

    if (!response.ok) {
      let detail = `Export request failed (${response.status}).`;
      try {
        const body = await response.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
      }
      throw new Error(detail);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || !Number.isInteger(data.page)) {
      throw new Error("The API returned an unexpected spending response. No CSV was downloaded.");
    }
    if (data.page !== page || data.items.length > PAGE_SIZE || data.total < 0) {
      throw new Error("The API returned inconsistent pagination metadata. No CSV was downloaded.");
    }
    if (expectedTotal == null) {
      expectedTotal = data.total;
      if (expectedTotal > MAX_EXPORT_RECORDS) {
        throw new Error(`This export contains ${expectedTotal.toLocaleString()} records, above the safe limit of ${MAX_EXPORT_RECORDS.toLocaleString()}. Narrow your filters and try again.`);
      }
    } else if (data.total !== expectedTotal) {
      throw new Error("The matching record count changed during export. Please retry so the CSV is consistent.");
    }

    records.push(...data.items);
    if (records.length > expectedTotal || records.length > MAX_EXPORT_RECORDS) {
      throw new Error("The API returned more records than expected. No CSV was downloaded.");
    }
    if (records.length === expectedTotal) break;
    if (data.items.length === 0) {
      throw new Error("The API returned an incomplete page of results. No CSV was downloaded.");
    }
    page += 1;
  }

  if (records.length !== expectedTotal) {
    throw new Error("The export was incomplete. No CSV was downloaded.");
  }
  return records;
}

export function downloadCsv(records, filename = "fundscope-spending.csv") {
  const blob = new Blob([toCsv(records)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Delay revocation for browsers that resolve the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildExportFilename({ stateName, fiscalYear, appendix }) {
  const slug = ["fundscope-spending", stateName, fiscalYear, appendix]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "fundscope-spending"}.csv`;
}
