export type CsvValue = string | number | null | undefined;

/**
 * Quotes one CSV cell. Text starting with = + - @ (or a tab/CR) is prefixed with
 * an apostrophe so Excel/Sheets treat it as text instead of running it as a
 * formula (CSV injection, e.g. a stock named `=HYPERLINK(...)`). Numbers are
 * left alone so negative values stay numeric.
 */
export function csvCell(value: CsvValue): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Builds a CSV document (with a UTF-8 BOM so Excel shows ₹ and other symbols correctly). */
export function toCsv(rows: CsvValue[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
