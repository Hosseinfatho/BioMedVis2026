/** Minimal RFC4180-style CSV line parser for browser-side tables. */
export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row = {};
    header.forEach((key, idx) => {
      row[key] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}
