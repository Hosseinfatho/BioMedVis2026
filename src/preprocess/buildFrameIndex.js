import fs from 'node:fs';
import { SYSTEMS, MODELS } from '../config/dataFiles.js';
import { parseStates } from '../utils/parseStates.js';
import { parseOrder } from '../utils/parseOrder.js';
import { parseConcatenated } from '../utils/parseConcatenated.js';
import { parseEpoch } from '../utils/parseEpoch.js';
import { systemDataFile } from './paths.js';

export const FRAME_INDEX_COLUMNS = [
  'system',
  'model',
  'trajectory_type',
  'trajectory_name',
  'epoch',
  'local_frame',
  'state',
  'xtc_frame_index',
  'global_order',
];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function startTimeFor(orderMap, trajectoryName) {
  return orderMap.get(trajectoryName)?.startTime ?? 0;
}

function buildConcatenatedTable(paths, stateByName) {
  return paths.map((path) => {
    let concatPos = 0;

    const segments = path.segments.map((seg) => {
      const source = stateByName.get(seg.name);
      const totalLen = source ? source.length : 0;
      const frameEnd = seg.frameEnd == null ? totalLen : seg.frameEnd;
      const length = Math.max(0, frameEnd - seg.frameStart);
      const states = source ? source.states.slice(seg.frameStart, frameEnd) : [];

      const out = {
        ...seg,
        ...parseEpoch(seg.name),
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

function buildOriginalRows(systemId, modelId, parsedStates, orderMap) {
  const rows = [];

  for (const traj of parsedStates) {
    const { epoch } = parseEpoch(traj.name);
    const startTime = startTimeFor(orderMap, traj.name);

    for (let localFrame = 0; localFrame < traj.states.length; localFrame++) {
      rows.push({
        system: systemId,
        model: modelId,
        trajectory_type: 'original',
        trajectory_name: traj.name,
        epoch,
        local_frame: localFrame,
        state: traj.states[localFrame],
        xtc_frame_index: localFrame,
        global_order: startTime + localFrame,
      });
    }
  }

  return rows;
}

function buildConcatenatedRows(systemId, modelId, paths, stateByName, orderMap) {
  const table = buildConcatenatedTable(paths, stateByName);
  const rows = [];

  for (const path of table) {
    const pathName = `concat_${path.pathIndex}`;

    for (const seg of path.segments) {
      const { epoch } = parseEpoch(seg.name);
      const startTime = startTimeFor(orderMap, seg.name);

      for (let i = 0; i < seg.states.length; i++) {
        const localFrame = seg.concatStart + i;
        const xtcFrameIndex = seg.frameStart + i;

        rows.push({
          system: systemId,
          model: modelId,
          trajectory_type: 'concatenated',
          trajectory_name: pathName,
          epoch,
          local_frame: localFrame,
          state: seg.states[i],
          xtc_frame_index: xtcFrameIndex,
          global_order: startTime + xtcFrameIndex,
        });
      }
    }
  }

  return rows;
}

export function loadSystemInputs(systemId, modelId) {
  const system = SYSTEMS[systemId];
  const statesPath = systemDataFile(systemId, system.files[modelId]);
  const orderPath = systemDataFile(systemId, system.files.order);
  const concatPath = systemDataFile(systemId, system.files.concatenated);

  const parsedStates = parseStates(readText(statesPath));
  const stateByName = new Map(parsedStates.map((traj) => [traj.name, traj]));
  const orderMap = parseOrder(readText(orderPath));
  const paths = parseConcatenated(readText(concatPath));

  return { parsedStates, stateByName, orderMap, paths };
}

export function buildFrameIndexRowsForSystemModel(systemId, modelId) {
  const { parsedStates, stateByName, orderMap, paths } = loadSystemInputs(
    systemId,
    modelId
  );

  return [
    ...buildOriginalRows(systemId, modelId, parsedStates, orderMap),
    ...buildConcatenatedRows(systemId, modelId, paths, stateByName, orderMap),
  ];
}

export function* iterateFrameIndexRows({
  systems = Object.keys(SYSTEMS),
  models = Object.keys(MODELS),
} = {}) {
  for (const systemId of systems) {
    for (const modelId of models) {
      const rows = buildFrameIndexRowsForSystemModel(systemId, modelId);
      for (const row of rows) {
        yield row;
      }
    }
  }
}
