import { describe, expect, it, vi } from "vitest";
import { buildExportFilename, fetchAllSpending, toCsv } from "./csvExport.js";

describe("CSV serialization", () => {
  it("preserves decimal strings and quotes commas and newlines", () => {
    const csv = toCsv([{
      id: 1, state_id: 2, budget_head_id: 3, source_id: 4,
      fiscal_year: "2025-2026", account: "24326856.7265799997863",
      revised: null, budget: "1,200.50",
    }]);
    expect(csv).toContain('"24326856.7265799997863"');
    expect(csv).toContain('""');
    expect(csv).toContain('"1,200.50"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("protects spreadsheet formula strings", () => {
    const csv = toCsv([{ id: "=HYPERLINK(\"https://bad.example\")" }]);
    expect(csv).toContain("'=HYPERLINK(\"\"https://bad.example\"\")");
  });
});

describe("filtered paginated export", () => {
  it("fetches all pages while retaining filters", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ page: 1, total: 2, items: [{ id: 1 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ page: 2, total: 2, items: [{ id: 2 }] }) });
    const records = await fetchAllSpending({
      baseUrl: "http://localhost:8000/",
      filters: { state_id: 5, fiscal_year: "2025-2026", appendix: "Appendix-1" },
      fetchImpl,
    });
    expect(records.map((item) => item.id)).toEqual([1, 2]);
    expect(fetchImpl.mock.calls[0][0]).toContain("state_id=5");
    expect(fetchImpl.mock.calls[0][0]).toContain("fiscal_year=2025-2026");
    expect(fetchImpl.mock.calls[1][0]).toContain("page=2");
  });

  it("refuses exports above the configured safe limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ page: 1, total: 100001, items: [] }),
    });
    await expect(fetchAllSpending({ baseUrl: "http://localhost:8000", filters: {}, fetchImpl }))
      .rejects.toThrow("above the safe limit");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses an incomplete response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ page: 1, total: 2, items: [{ id: 1 }] }),
    });
    await expect(fetchAllSpending({ baseUrl: "http://localhost:8000", filters: {}, fetchImpl }))
      .rejects.toThrow("incomplete page");
  });
});

describe("export filenames", () => {
  it("uses sanitized filter metadata", () => {
    expect(buildExportFilename({ stateName: "All States/UT", fiscalYear: "2025-2026", appendix: "Appendix-1" }))
      .toBe("fundscope-spending-all-states-ut-2025-2026-appendix-1.csv");
  });
});
