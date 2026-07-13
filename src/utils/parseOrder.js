export function parseOrder(text) {
  const orderMap = new Map();
  if (!text || !text.trim()) return orderMap;

  // Split on both LF and CRLF, and trim each line so trailing "\r" (Windows
  // line endings) does not break the `(.+)$` match below.
  text
    .split(/\r?\n/)
    .forEach((raw, idx) => {
      const line = raw.trim();
      if (!line) return;
      const match = line.match(/^(\d+)\s*:\s*(.+)$/);
      if (match) {
        const startTime = parseInt(match[1], 10);
        const name = match[2].trim();
        orderMap.set(name, { orderIndex: idx, startTime });
      }
    });

  return orderMap;
}
