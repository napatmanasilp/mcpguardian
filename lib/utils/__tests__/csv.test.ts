import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { escapeCsvField, buildCsvContent, getCsvFilename, exportCsv } from "@/lib/utils/csv";
import type { MergedEvent } from "@/lib/types/activity";

describe("escapeCsvField", () => {
  it("returns the value unchanged when no special characters", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("wraps value in double-quotes when it contains a comma", () => {
    expect(escapeCsvField("hello,world")).toBe('"hello,world"');
  });

  it("wraps value in double-quotes and escapes embedded quotes", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps value in double-quotes when it contains a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });
});

describe("buildCsvContent", () => {
  const sampleEvent: MergedEvent = {
    id: "evt-1",
    type: "threat",
    title: "SQL Injection Attempt",
    description: "Tool: query_db",
    severity: "critical",
    session_id: "sess-123",
    server_id: "srv-456",
    createdAt: "2024-06-15T12:30:00.000Z",
  };

  it("produces header-only CSV when events array is empty", () => {
    const result = buildCsvContent([]);
    expect(result).toBe("id,type,title,description,severity,session_id,server_id,created_at");
  });

  it("produces header + 1 data row for a single event", () => {
    const result = buildCsvContent([sampleEvent]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("id,type,title,description,severity,session_id,server_id,created_at");
    expect(lines[1]).toBe("evt-1,threat,SQL Injection Attempt,Tool: query_db,critical,sess-123,srv-456,2024-06-15T12:30:00.000Z");
  });

  it("renders null session_id and server_id as empty strings", () => {
    const event: MergedEvent = { ...sampleEvent, session_id: null, server_id: null };
    const result = buildCsvContent([event]);
    const lines = result.split("\n");
    expect(lines[1]).toContain(",,");
  });

  it("escapes fields with embedded quotes", () => {
    const event: MergedEvent = { ...sampleEvent, title: 'He said "stop"' };
    const result = buildCsvContent([event]);
    expect(result).toContain('"He said ""stop"""');
  });

  it("formats created_at as ISO 8601 UTC string", () => {
    const event: MergedEvent = { ...sampleEvent, createdAt: "2024-01-01T00:00:00+05:00" };
    const result = buildCsvContent([event]);
    // The UTC representation of 2024-01-01T00:00:00+05:00 is 2023-12-31T19:00:00.000Z
    expect(result).toContain("2023-12-31T19:00:00.000Z");
  });
});

describe("getCsvFilename", () => {
  it("returns filename in format threat-log-YYYY-MM-DD.csv", () => {
    const filename = getCsvFilename();
    expect(filename).toMatch(/^threat-log-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("uses today's UTC date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getCsvFilename()).toBe(`threat-log-${today}.csv`);
  });
});

describe("exportCsv", () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let appendChildMock: ReturnType<typeof vi.fn>;
  let removeChildMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/fake");
    revokeObjectURLMock = vi.fn();
    appendChildMock = vi.fn();
    removeChildMock = vi.fn();
    clickMock = vi.fn();

    global.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
    vi.spyOn(document.body, "appendChild").mockImplementation(appendChildMock as unknown as (node: Node) => Node);
    vi.spyOn(document.body, "removeChild").mockImplementation(removeChildMock as unknown as (child: Node) => Node);
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      style: { display: "" },
      click: clickMock,
    } as unknown as HTMLAnchorElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Blob and triggers download", () => {
    const events: MergedEvent[] = [{
      id: "1",
      type: "threat",
      title: "Test",
      description: "desc",
      severity: "high",
      session_id: null,
      server_id: null,
      createdAt: "2024-06-15T00:00:00Z",
    }];

    exportCsv(events);

    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(clickMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/fake");
  });

  it("always calls revokeObjectURL even if click throws", () => {
    clickMock.mockImplementation(() => { throw new Error("click failed"); });

    const events: MergedEvent[] = [];

    expect(() => exportCsv(events)).toThrow("click failed");
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/fake");
  });

  it("handles empty events array without error", () => {
    exportCsv([]);
    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledOnce();
  });
});
