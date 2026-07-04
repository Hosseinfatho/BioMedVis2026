import { parseEpoch } from './parseEpoch';

export function buildConcatenatedTable(paths, stateByName) {
  return paths.map((path) => {
    let concatPos = 0;

    const segments = path.segments.map((seg) => {
      const source = stateByName.get(seg.name);
      const totalLen = source ? source.length : 0;
      // open-ended segment (frameEnd === null) covers all remaining frames
      const frameEnd = seg.frameEnd == null ? totalLen : seg.frameEnd;
      const length = Math.max(0, frameEnd - seg.frameStart);
      const epochInfo = parseEpoch(seg.name);
      const states = source
        ? source.states.slice(seg.frameStart, frameEnd)
        : [];

      const out = {
        ...seg,
        ...epochInfo,
        frameEnd,
        length,
        states,
        concatStart: concatPos,
        concatEnd: concatPos + length,
      };
      concatPos += length;
      return out;
    });

    return { ...path, segments, length: concatPos };
  });
}
