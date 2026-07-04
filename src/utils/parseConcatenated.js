export function parseConcatenated(text) {
  if (!text || !text.trim()) return [];

  return text
    .trim()
    .split(/\n\n+/)
    .map((block, pathIndex) => {
      const lines = block.split('\n').filter((line) => line.trim());
      const score = parseInt(lines[0], 10);
      const segments = [];

      for (const line of lines.slice(1)) {
        // open-ended segment: "start+: name" means from `start` to the last frame
        const open = line.match(/^(\d+)\+\s*:\s*(.+)$/);
        if (open) {
          segments.push({
            name: open[2].trim(),
            frameStart: parseInt(open[1], 10),
            frameEnd: null,
          });
          continue;
        }

        // ranged segment: "start-end: name" (end is exclusive => length = end - start)
        const ranged = line.match(/^(\d+)-(\d+)\s*:\s*(.+)$/);
        if (ranged) {
          segments.push({
            name: ranged[3].trim(),
            frameStart: parseInt(ranged[1], 10),
            frameEnd: parseInt(ranged[2], 10),
          });
        }
      }

      return { pathIndex, score, segments };
    })
    .filter((path) => path.segments.length > 0);
}
