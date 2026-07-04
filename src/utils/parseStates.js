export function parseStates(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return null;
      const name = line.slice(0, colonIdx).trim();
      const states = line
        .slice(colonIdx + 1)
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      return { name, states, length: states.length };
    })
    .filter(Boolean);
}
