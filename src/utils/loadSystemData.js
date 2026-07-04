import {
  getStateFilePath,
  getOrderFilePath,
  getConcatenatedFilePath,
} from '../config/dataFiles';
import { parseStates } from './parseStates';
import { parseOrder } from './parseOrder';
import { parseConcatenated } from './parseConcatenated';
import { buildTrajectoryTable } from './buildTrajectoryTable';
import { buildConcatenatedTable } from './buildConcatenatedTable';

// Loads and builds the trajectory table for a single system, for either view.
// Returned rows are sorted the same way the charts expect them.
export async function loadSystemData(systemId, modelId, viewMode) {
  const statePath = getStateFilePath(systemId, modelId);
  const stateRes = await fetch(statePath);
  if (!stateRes.ok) throw new Error(`Failed to load ${statePath}`);

  const stateText = await stateRes.text();
  const parsed = parseStates(stateText);
  const stateByName = new Map(parsed.map((traj) => [traj.name, traj]));

  if (viewMode === 'concatenated') {
    const concatPath = getConcatenatedFilePath(systemId);
    const concatRes = await fetch(concatPath);
    if (!concatRes.ok) throw new Error(`Failed to load ${concatPath}`);

    const paths = parseConcatenated(await concatRes.text());
    const table = buildConcatenatedTable(paths, stateByName);

    // sort by total length ascending so the Y axis forms a clean staircase
    // (shortest at the bottom, longest at the top), matching the reference figure
    table.sort((a, b) => a.length - b.length || a.pathIndex - b.pathIndex);

    return table;
  }

  const orderPath = getOrderFilePath(systemId);
  const orderRes = await fetch(orderPath).catch(() => null);
  const orderText = orderRes?.ok ? await orderRes.text() : '';
  const orderMap = parseOrder(orderText);
  const table = buildTrajectoryTable(parsed, orderMap);

  table.sort(
    (a, b) =>
      a.startTime - b.startTime ||
      a.orderIndex - b.orderIndex ||
      a.name.localeCompare(b.name)
  );

  return table;
}
