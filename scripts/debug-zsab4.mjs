import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const slot = (n) => (n ? n.split('_')[0] : '');

function parseStates(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf(':');
      if (i === -1) return null;
      return {
        name: line.slice(0, i).trim(),
        states: line
          .slice(i + 1)
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n)),
      };
    })
    .filter(Boolean);
}

function load(id) {
  const path = `public/data/${id}/${id}_states3.txt`;
  return parseStates(readFileSync(path, 'utf8'));
}

function matrixSlots(a, b) {
  const slots = [];
  const seen = new Set();
  for (const r of a) {
    const s = slot(r.name);
    if (!seen.has(s)) {
      seen.add(s);
      slots.push(s);
    }
  }
  for (const r of b) {
    const s = slot(r.name);
    if (s && !seen.has(s)) {
      seen.add(s);
      slots.push(s);
    }
  }
  return slots;
}

const {
  findGlobalMotifOccurrences,
  motifBundlesForSystem,
  defaultMotifPresets,
  attachMatrixColumns,
  computeMotifMatrixHighlights,
} = await import(pathToFileURL('src/utils/motifs.js').href);

const dataA = load('zsab2');
const dataB = load('zsab4');
const slots = matrixSlots(dataA, dataB);
const getStates = (r) => r.states || [];

console.log('B-only slots:', slots.length - new Set(dataA.map((r) => slot(r.name))).size);

for (const motif of defaultMotifPresets(3)) {
  const bundles = motifBundlesForSystem(motif, 3, dataB, slots, getStates);
  console.log(motif.label, 'bundles', bundles.length);
}

const m02 = { states: [0, 2], transitions: [[0, 2]], label: '0->2' };
const occ = findGlobalMotifOccurrences(m02, dataB, slots, getStates);
const aligned = attachMatrixColumns(occ, slots);
const { bundles } = computeMotifMatrixHighlights(m02, 3, aligned, slots);
console.log('0->2 occ', occ.length, 'bundles', bundles.length);
const dropped = occ.length - bundles.length;
console.log('dropped by highlight filter', dropped);

if (bundles[0]) {
  console.log('sample bundle cols', bundles[0].cells.map((c) => c.col));
}
