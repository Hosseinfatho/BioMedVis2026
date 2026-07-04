export function parseOrder(text) {
  const orderMap = new Map();
  if (!text || !text.trim()) return orderMap;

  text
    .trim()
    .split('\n')
    .forEach((line, idx) => {
      const match = line.match(/^(\d+)\s*:\s*(.+)$/);
      if (match) {
        const startTime = parseInt(match[1], 10);
        const name = match[2].trim();
        orderMap.set(name, { orderIndex: idx, startTime });
      }
    });

  return orderMap;
}
