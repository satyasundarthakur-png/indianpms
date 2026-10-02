import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes cells and escapes embedded quotes", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(12.5)).toBe('"12.5"');
  });

  it("neutralizes spreadsheet formula injection in text", () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    for (const lead of ["+1", "-1", "@SUM(A1)", "\tcmd"]) {
      expect(csvCell(lead).startsWith(`"'`)).toBe(true);
    }
  });

  it("leaves negative numbers numeric (not prefixed)", () => {
    expect(csvCell(-5)).toBe('"-5"');
  });

  it("builds rows with CRLF and a UTF-8 BOM", () => {
    const out = toCsv([
      ["a", "b"],
      [1, "c"],
    ]);
    expect(out.startsWith("\uFEFF")).toBe(true);
    expect(out).toBe('\uFEFF"a","b"\r\n"1","c"');
  });
});
