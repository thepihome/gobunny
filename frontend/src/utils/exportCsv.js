function escapeCsvCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build CSV text from rows and column definitions.
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ key: string, label: string, format?: (row: Record<string, unknown>) => string }[]} columns
 */
export function buildCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.format ? c.format(row) : row[c.key])).join(',')
  );
  return [header, ...lines].join('\n');
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(rows, columns, filename = 'export.csv') {
  const csv = buildCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
