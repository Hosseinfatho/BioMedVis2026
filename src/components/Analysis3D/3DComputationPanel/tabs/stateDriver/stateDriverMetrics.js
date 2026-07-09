import { SYSTEMS } from '../../../../../config/dataFiles';

export const ALL_SYSTEMS = Object.keys(SYSTEMS);
export const TMP_SYSTEM = 'zsab3';
export const SPA_SYSTEM = 'zsab4';
export const TRAJECTORY_TYPE = 'original';
export const RESIDUE_COUNT = 42;
export const MIN_SEQ_SEP = 3;

export const DEFAULT_ARC_LIMIT = 30;
export const DEFAULT_LIGAND_LIMIT = 10;
export const DIFF_EPSILON = 0.03;

export const SYSTEM_STYLE = {
  zsab2: { color: '#636efa', ligandLabel: 'Free' },
  zsab3: { color: '#1b9e77', ligandLabel: 'TMP' },
  zsab4: { color: '#d95f02', ligandLabel: 'SPA' },
};

export const COLORS = {
  selected: '#7570b3',
  shared: '#c8c8c8',
  nodeStroke: '#2d3748',
};

export const DATA_URL = `${import.meta.env.BASE_URL}data/Residual/state_driver_interactions.json`;

export function systemLabel(systemId) {
  return SYSTEMS[systemId]?.label ?? systemId;
}

export function systemColor(systemId) {
  return SYSTEM_STYLE[systemId]?.color ?? '#888';
}

export function sortSystems(systemIds) {
  return [...systemIds].sort(
    (a, b) => ALL_SYSTEMS.indexOf(a) - ALL_SYSTEMS.indexOf(b)
  );
}

export function groupKey(system, model, trajectoryType, state) {
  return `${system}|${model}|${trajectoryType}|${state}`;
}

export function parsePairKey(pairKey) {
  const [a, b] = pairKey.split('-').map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { i: a, j: b, seqSpan: Math.abs(b - a) };
}

export function persistenceFromStd(std) {
  if (!Number.isFinite(std)) return 0;
  return 1 / (1 + std);
}

function pairMetric(entry, pairKey) {
  const stats = entry?.pairs?.[pairKey];
  if (!stats) return null;
  return {
    meanDistance: stats.mean_distance ?? null,
    meanSoft: stats.mean_soft ?? 0,
    persistence: stats.persistence ?? persistenceFromStd(stats.distance_std),
  };
}

export function buildMultiSystemEdges(entriesBySystem, activeSystems) {
  const systems = sortSystems(activeSystems);
  const pairKeys = new Set();
  for (const systemId of systems) {
    Object.keys(entriesBySystem[systemId]?.pairs ?? {}).forEach((k) => pairKeys.add(k));
  }

  const edges = [];
  for (const pairKey of pairKeys) {
    const parsed = parsePairKey(pairKey);
    if (!parsed || parsed.seqSpan < MIN_SEQ_SEP) continue;

    const strengths = {};
    const distances = {};
    const persistences = {};
    let hasData = false;

    for (const systemId of systems) {
      const metric = pairMetric(entriesBySystem[systemId], pairKey);
      strengths[systemId] = metric?.meanSoft ?? 0;
      distances[systemId] = metric?.meanDistance ?? null;
      persistences[systemId] = metric?.persistence ?? 0;
      if (metric) hasData = true;
    }
    if (!hasData) continue;

    const displayStrength = Math.max(...systems.map((id) => strengths[id]), 0);
    if (displayStrength <= 0.01) continue;

    const sharedStrength = Math.min(
      ...systems.map((id) => strengths[id]).filter((v) => v > 0),
      Infinity
    );

    let winner = 'shared';
    let difference = 0;

    if (systems.length === 1) {
      winner = systems[0];
    } else if (systems.length === 2) {
      const [a, b] = systems;
      difference = strengths[a] - strengths[b];
      if (difference > DIFF_EPSILON) winner = a;
      else if (difference < -DIFF_EPSILON) winner = b;
    } else {
      const ranked = systems
        .map((id) => ({ id, strength: strengths[id] }))
        .sort((x, y) => y.strength - x.strength);
      if (ranked[0].strength - ranked[1].strength > DIFF_EPSILON) {
        winner = ranked[0].id;
      }
      difference = ranked[0].strength - ranked[1].strength;
    }

    edges.push({
      pairKey,
      source: parsed.i,
      target: parsed.j,
      seqSpan: parsed.seqSpan,
      strengths,
      distances,
      persistences,
      sharedStrength: Number.isFinite(sharedStrength) ? sharedStrength : 0,
      difference,
      winner,
      persistence: Math.max(...systems.map((id) => persistences[id])),
      displayStrength,
      activeSystems: systems,
    });
  }

  return edges;
}

export function filterArcEdgesForSystems(edges, activeSystems, arcLimit = DEFAULT_ARC_LIMIT) {
  const systems = sortSystems(activeSystems);
  const eligible = edges.filter((e) => e.displayStrength > 0.01);

  if (systems.length === 1) {
    return eligible
      .sort((a, b) => b.displayStrength - a.displayStrength || b.persistence - a.persistence)
      .slice(0, arcLimit);
  }

  if (systems.length === 2) {
    const [sysA, sysB] = systems;
    const shared = eligible
      .filter((e) => e.winner === 'shared')
      .sort((a, b) => b.sharedStrength - a.sharedStrength || b.persistence - a.persistence)
      .slice(0, arcLimit);
    const aStronger = eligible
      .filter((e) => e.winner === sysA)
      .sort((a, b) => b.difference - a.difference || b.displayStrength - a.displayStrength)
      .slice(0, arcLimit);
    const bStronger = eligible
      .filter((e) => e.winner === sysB)
      .sort((a, b) => a.difference - b.difference || b.displayStrength - a.displayStrength)
      .slice(0, arcLimit);

    const keys = new Set();
    const merged = [];
    for (const list of [shared, aStronger, bStronger]) {
      for (const edge of list) {
        if (keys.has(edge.pairKey)) continue;
        keys.add(edge.pairKey);
        merged.push(edge);
      }
    }
    return merged;
  }

  return eligible
    .sort((a, b) => b.displayStrength - a.displayStrength || b.persistence - a.persistence)
    .slice(0, arcLimit);
}

export function buildLigandContacts(entry, systemId) {
  if (!entry?.ligand) return [];
  const label = SYSTEM_STYLE[systemId]?.ligandLabel ?? systemId;
  return Object.entries(entry.ligand)
    .map(([residue, stats]) => ({
      systemId,
      residue: Number.parseInt(residue, 10),
      ligand: label,
      strength: stats.mean_soft ?? 0,
      meanDistance: stats.mean_distance ?? null,
      persistence: stats.persistence ?? persistenceFromStd(stats.distance_std),
    }))
    .filter((row) => Number.isFinite(row.residue) && row.strength > 0);
}

export function filterLigandContacts(contacts, limit = DEFAULT_LIGAND_LIMIT) {
  return contacts
    .slice()
    .sort((a, b) => b.strength - a.strength || b.persistence - a.persistence)
    .slice(0, limit);
}

export function buildLigandRows(entriesBySystem, activeSystems) {
  return sortSystems(activeSystems).map((systemId) => ({
    systemId,
    label: SYSTEM_STYLE[systemId]?.ligandLabel ?? systemLabel(systemId),
    color: systemColor(systemId),
    contacts: filterLigandContacts(buildLigandContacts(entriesBySystem[systemId], systemId)),
  }));
}

export function computeNodeProximityScores(edges, ligandRows) {
  const sums = new Map();
  const counts = new Map();

  const add = (residue, distance) => {
    if (!Number.isFinite(distance) || distance <= 0) return;
    sums.set(residue, (sums.get(residue) || 0) + distance);
    counts.set(residue, (counts.get(residue) || 0) + 1);
  };

  for (const edge of edges) {
    for (const distance of Object.values(edge.distances ?? {})) {
      if (distance == null) continue;
      add(edge.source, distance);
      add(edge.target, distance);
    }
  }

  for (const row of ligandRows) {
    for (const contact of row.contacts) {
      add(contact.residue, contact.meanDistance);
    }
  }

  const scores = new Map();
  for (let r = 1; r <= RESIDUE_COUNT; r += 1) {
    const n = counts.get(r) || 0;
    scores.set(r, n > 0 ? sums.get(r) / n : 20);
  }
  return scores;
}

export function arcDirectionForEdge(edge, activeSystems) {
  if (edge.winner === 'shared') return 1;
  const systems = sortSystems(activeSystems);
  if (systems.length === 1) return 1;

  if (systems.length === 2) {
    const [first] = systems;
    return edge.winner === first ? 1 : -1;
  }

  const idx = ALL_SYSTEMS.indexOf(edge.winner);
  return idx <= 1 ? 1 : -1;
}

export function nodeRadius(meanDistance, minR = 4, maxR = 11) {
  const clamped = Math.max(3, Math.min(30, meanDistance ?? 20));
  const t = 1 - (clamped - 3) / 27;
  return minR + t * (maxR - minR);
}

export function arcStrokeWidth(strength, minW = 1, maxW = 6) {
  const t = Math.max(0, Math.min(1, strength));
  return minW + t * (maxW - minW);
}

export function arcOpacity(persistence, minO = 0.25, maxO = 0.95) {
  const t = Math.max(0, Math.min(1, persistence));
  return minO + t * (maxO - minO);
}
