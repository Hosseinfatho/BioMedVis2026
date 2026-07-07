import fs from 'node:fs';
import { SYSTEMS } from '../config/dataFiles.js';
import { parseStates } from '../utils/parseStates.js';
import { parseConcatenated } from '../utils/parseConcatenated.js';
import { systemDataFile } from './paths.js';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function buildConcatenatedTable(paths, stateByName) {
  return paths.map((path) => {
    let concatPos = 0;

    const segments = path.segments.map((seg) => {
      const source = stateByName.get(seg.name);
      const totalLen = source ? source.length : 0;
      const frameEnd = seg.frameEnd == null ? totalLen : seg.frameEnd;
      const length = Math.max(0, frameEnd - seg.frameStart);

      const out = {
        ...seg,
        frameEnd,
        length,
        concatStart: concatPos,
        concatEnd: concatPos + length,
      };
      concatPos += length;
      return out;
    });

    return { ...path, segments, length: concatPos };
  });
}

export function buildConcatFrameLookup(systemId) {
  const system = SYSTEMS[systemId];
  const statesPath = systemDataFile(systemId, system.files.states3);
  const concatPath = systemDataFile(systemId, system.files.concatenated);

  const parsedStates = parseStates(readText(statesPath));
  const stateByName = new Map(parsedStates.map((traj) => [traj.name, traj]));
  const paths = parseConcatenated(readText(concatPath));
  const table = buildConcatenatedTable(paths, stateByName);

  const lookup = new Map();

  for (const path of table) {
    const pathName = `concat_${path.pathIndex}`;

    for (const seg of path.segments) {
      for (let i = 0; i < seg.length; i++) {
        const localFrame = seg.concatStart + i;
        lookup.set(`${pathName}|${localFrame}`, {
          source_trajectory: seg.name,
          xtc_frame_index: String(seg.frameStart + i),
        });
      }
    }
  }

  return lookup;
}

export function buildAllConcatLookups(systems = Object.keys(SYSTEMS)) {
  const bySystem = new Map();
  for (const systemId of systems) {
    bySystem.set(systemId, buildConcatFrameLookup(systemId));
  }
  return bySystem;
}
