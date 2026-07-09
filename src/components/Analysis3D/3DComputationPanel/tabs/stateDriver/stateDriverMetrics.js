import { SYSTEMS } from '../../../../../config/dataFiles';

export const ALL_SYSTEMS = Object.keys(SYSTEMS);
export const TMP_SYSTEM = 'zsab3';
export const SPA_SYSTEM = 'zsab4';
export const TRAJECTORY_TYPE = 'original';
export const RESIDUE_COUNT = 42;
export const MIN_SEQ_SEP = 3;

export const DEFAULT_ARC_LIMIT = 14;
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

export function filterEdgesForResidue(edges, residue) {
  if (!residue) return edges;
  return edges.filter((edge) => edge.source === residue || edge.target === residue);
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
    return merged
      .sort((a, b) => b.displayStrength - a.displayStrength || b.persistence - a.persistence)
      .slice(0, arcLimit);
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

export function nodeX(residue, plotW, padL = 28) {
  if (RESIDUE_COUNT <= 1) return padL;
  return padL + ((residue - 1) / (RESIDUE_COUNT - 1)) * plotW;
}

/** Small vertical rise at chain center (gentle hill). */
export const HILL_SAG = 96;
/** Wider arc chord → more spacing between residues along the chain. */
export const RESIDUE_CHAIN_STRETCH = 1.28;
/** Each wave group: 3 up + 3 down + 2 on hill trace. */
export const HILL_WAVE_GROUP_SIZE = 8;
export const HILL_WAVE_UP_COUNT = 3;
export const HILL_WAVE_DOWN_COUNT = 3;
export const HILL_WAVE_CONNECT_COUNT = 2;
export const HILL_WAVE_AMPLITUDE = 14;

/** 0…1 offset within one 8-residue wave (3↑ 3↓ 2 on hill). */
export function hillWaveOffsetFactor(residue) {
  const p = (residue - 1) % HILL_WAVE_GROUP_SIZE;
  const { UP, DOWN } = {
    UP: HILL_WAVE_UP_COUNT,
    DOWN: HILL_WAVE_DOWN_COUNT,
  };

  if (p < UP) {
    return UP <= 1 ? 1 : p / (UP - 1);
  }
  if (p < UP + DOWN) {
    const q = p - UP;
    return DOWN <= 1 ? 0 : 1 - q / (DOWN - 1);
  }
  return 0;
}

function hillArcGeometry(
  residue,
  plotW,
  baseY,
  sag,
  padL,
  chainStretch = RESIDUE_CHAIN_STRETCH
) {
  const arcW = plotW * chainStretch;
  const arcPadL = padL - (arcW - plotW) / 2;
  const t = (residue - 1) / (RESIDUE_COUNT - 1);
  const halfW = arcW / 2;
  const cx = arcPadL + halfW;
  const radius = (halfW * halfW + sag * sag) / (2 * sag);
  const cy = baseY + radius - sag;
  const beta = Math.asin(Math.min(1, halfW / radius));
  const angle = -Math.PI / 2 - beta + t * (2 * beta);
  return { cx, cy, radius, angle, beta, halfW, arcW, arcPadL };
}

/** Hill arc only (smooth baseline). */
export function residueArcPosition(
  residue,
  plotW,
  baseY,
  sag = HILL_SAG,
  padL = 28,
  chainStretch = RESIDUE_CHAIN_STRETCH
) {
  const { cx, cy, radius, angle } = hillArcGeometry(
    residue,
    plotW,
    baseY,
    sag,
    padL,
    chainStretch
  );
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

/** Hill + grouped wave (3 up, 3 down, 2 on trace) along arc normal. */
export function residueHillWavePosition(
  residue,
  plotW,
  baseY,
  sag = HILL_SAG,
  padL = 28,
  waveAmp = HILL_WAVE_AMPLITUDE
) {
  const { cx, cy, radius, angle } = hillArcGeometry(residue, plotW, baseY, sag, padL);
  let x = cx + radius * Math.cos(angle);
  let y = cy + radius * Math.sin(angle);

  const wave = waveAmp * hillWaveOffsetFactor(residue);
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  x += wave * nx;
  y += wave * ny;

  return { x, y };
}

export function buildResidueHillNodes(
  _nodeProximity,
  plotW,
  baseY,
  sag = HILL_SAG,
  padL = 28
) {
  const nodes = [];
  for (let r = 1; r <= RESIDUE_COUNT; r += 1) {
    const { x, y } = residueHillWavePosition(r, plotW, baseY, sag, padL);
    nodes.push({
      residue: r,
      x,
      y,
      r: RESIDUE_NODE_RADIUS,
    });
  }
  return nodes;
}

/** Smooth hill baseline (no ripple). */
export function hillBasePath(plotW, baseY, sag, padL, chainStretch = RESIDUE_CHAIN_STRETCH) {
  const left = residueArcPosition(1, plotW, baseY, sag, padL, chainStretch);
  const right = residueArcPosition(RESIDUE_COUNT, plotW, baseY, sag, padL, chainStretch);
  const arcW = plotW * chainStretch;
  const halfW = arcW / 2;
  const radius = (halfW * halfW + sag * sag) / (2 * sag);
  return `M ${left.x} ${left.y} A ${radius} ${radius} 0 0 1 ${right.x} ${right.y}`;
}

/** Wavy chain path through residue nodes. */
export function hillGuidePath(nodes) {
  if (!nodes.length) return '';
  return nodes.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x} ${n.y}`).join(' ');
}

/** Shared layout padding for arc diagram + ligand rows. */
export const STATE_DRIVER_CHAIN_PAD = { l: 20, r: 20, t: 36, b: 24 };
export const STATE_DRIVER_CHAIN_BASE_Y = 188;

/** Fit viewBox around all residue nodes and interaction arcs. */
export function computeChainViewBounds(
  nodes,
  arcs = [],
  pad = { t: 36, r: 16, b: 20, l: 16 }
) {
  if (!nodes.length) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r - 2);
    maxX = Math.max(maxX, n.x + n.r + 2);
    minY = Math.min(minY, n.y - n.r - 2);
    maxY = Math.max(maxY, n.y + n.r + 10);
  }

  for (const arc of arcs) {
    const bulge = arc.bulge ?? arcBulge(arc.seqSpan ?? 0, arc.lane ?? 0, arc.proximityScale ?? 1);
    const midY = (arc.y1 + arc.y2) / 2;
    if (arc.side === 'down') {
      maxY = Math.max(maxY, midY + bulge + 2, arc.y1, arc.y2);
    } else {
      minY = Math.min(minY, midY - bulge - 2);
      maxY = Math.max(maxY, arc.y1, arc.y2);
    }
  }

  return {
    x: minX - pad.l,
    y: minY - pad.t,
    width: maxX - minX + pad.l + pad.r,
    height: maxY - minY + pad.t + pad.b,
  };
}

export function chainViewBoxString(bounds) {
  return `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`;
}

const ARC_BASE_BULGE = 22;
const ARC_SPAN_FACTOR = 1.2;
const ARC_LANE_STEP = 16;

export function arcBulge(seqSpan, lane = 0, proximityScale = 1) {
  const base = ARC_BASE_BULGE + seqSpan * ARC_SPAN_FACTOR + lane * ARC_LANE_STEP;
  return base * proximityScale;
}

/** Stack arcs into up/down lanes so overlapping pairs stay separated. */
export function assignArcLanes(edges) {
  const sorted = [...edges].sort(
    (a, b) => a.seqSpan - b.seqSpan || b.displayStrength - a.displayStrength
  );
  const placementByKey = new Map();
  const intervalsBySide = { up: [], down: [] };

  for (const edge of sorted) {
    const lo = Math.min(edge.source, edge.target);
    const hi = Math.max(edge.source, edge.target);
    let placed = false;

    for (let lane = 0; !placed; lane += 1) {
      for (const side of ['up', 'down']) {
        const buckets = intervalsBySide[side];
        while (buckets.length <= lane) buckets.push([]);
        const overlaps = buckets[lane].some(
          ({ lo: oLo, hi: oHi }) => lo < oHi && hi > oLo
        );
        if (!overlaps) {
          buckets[lane].push({ lo, hi });
          placementByKey.set(edge.pairKey, { lane, side });
          placed = true;
          break;
        }
      }
    }
  }

  return edges.map((edge) => {
    const placement = placementByKey.get(edge.pairKey) ?? { lane: 0, side: 'up' };
    return { ...edge, lane: placement.lane, side: placement.side };
  });
}

export function interactionArcPath(x1, y1, x2, y2, seqSpan, lane = 0, side = 'up', bulgeOverride) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const bulge = bulgeOverride ?? arcBulge(seqSpan, lane);
  const ctrlY = side === 'down' ? midY + bulge : midY - bulge;
  return `M ${x1} ${y1} Q ${midX} ${ctrlY} ${x2} ${y2}`;
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

export const ARC_WIDTH_MIN = 0.5;
export const ARC_WIDTH_MAX = 12;
export const ARC_WIDTH_GAMMA = 1.75;
export const ARC_OPACITY_MIN = 0.15;
export const ARC_OPACITY_MAX = 1;
export const ARC_STRENGTH_SPREAD_EPS = 0.02;
export const ARC_PROXIMITY_SCALE_MIN = 0.55;
export const ARC_PROXIMITY_SCALE_MAX = 1.55;
export const RESIDUE_NODE_RADIUS = 6;

export function pairMeanDistance(edge) {
  const distances = Object.values(edge?.distances ?? {}).filter(
    (distance) => Number.isFinite(distance) && distance > 0
  );
  if (!distances.length) return null;
  return distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
}

function widthSourceValue(edge, strengthSpread) {
  if (strengthSpread >= ARC_STRENGTH_SPREAD_EPS) {
    return edge.displayStrength;
  }

  const distances = Object.values(edge.distances ?? {}).filter(
    (distance) => Number.isFinite(distance) && distance > 0
  );
  if (distances.length) {
    const meanDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    return 1 / meanDistance;
  }

  return edge.persistence;
}

function scaledEncoding(value, min, max, outMin, outMax, gamma = 1) {
  if (!Number.isFinite(value)) return outMin;
  if (max <= min) return null;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return outMin + Math.pow(t, gamma) * (outMax - outMin);
}

function rankEncodings(edges, outMin, outMax, gamma = 1) {
  const ranked = [...edges].sort(
    (a, b) => b.displayStrength - a.displayStrength || b.persistence - a.persistence
  );
  const values = new Map();
  const last = ranked.length - 1;
  ranked.forEach((edge, index) => {
    const t = last <= 0 ? 1 : 1 - index / last;
    values.set(edge.pairKey, outMin + Math.pow(t, gamma) * (outMax - outMin));
  });
  return values;
}

function proximityScaleValue(meanDistance, minDistance, maxDistance) {
  if (!Number.isFinite(meanDistance)) return 1;
  if (maxDistance <= minDistance) return (ARC_PROXIMITY_SCALE_MIN + ARC_PROXIMITY_SCALE_MAX) / 2;
  const t = Math.max(0, Math.min(1, (meanDistance - minDistance) / (maxDistance - minDistance)));
  return ARC_PROXIMITY_SCALE_MAX - t * (ARC_PROXIMITY_SCALE_MAX - ARC_PROXIMITY_SCALE_MIN);
}

function proximityScalesForEdges(edges) {
  const scales = new Map();
  if (!edges.length) return scales;

  const distances = edges
    .map((edge) => pairMeanDistance(edge))
    .filter((distance) => Number.isFinite(distance));
  if (!distances.length) {
    for (const edge of edges) scales.set(edge.pairKey, 1);
    return scales;
  }

  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  if (maxDistance - minDistance < 1e-6) {
    const ranked = [...edges].sort(
      (a, b) => (pairMeanDistance(a) ?? Infinity) - (pairMeanDistance(b) ?? Infinity)
    );
    const last = ranked.length - 1;
    ranked.forEach((edge, index) => {
      const t = last <= 0 ? 1 : 1 - index / last;
      scales.set(
        edge.pairKey,
        ARC_PROXIMITY_SCALE_MIN + t * (ARC_PROXIMITY_SCALE_MAX - ARC_PROXIMITY_SCALE_MIN)
      );
    });
    return scales;
  }

  for (const edge of edges) {
    scales.set(
      edge.pairKey,
      proximityScaleValue(pairMeanDistance(edge), minDistance, maxDistance)
    );
  }
  return scales;
}

/** Scale encodings to the visible arc range so saturated scores still show width contrast. */
export function arcVisualEncodings(
  edges,
  minW = ARC_WIDTH_MIN,
  maxW = ARC_WIDTH_MAX,
  minO = ARC_OPACITY_MIN,
  maxO = ARC_OPACITY_MAX
) {
  if (!edges.length) {
    return { strokeWidths: new Map(), opacities: new Map(), proximityScales: new Map() };
  }

  const strengths = edges.map((edge) => edge.displayStrength);
  const minStrength = Math.min(...strengths);
  const maxStrength = Math.max(...strengths);
  const strengthSpread = maxStrength - minStrength;

  const widthValues = edges.map((edge) => widthSourceValue(edge, strengthSpread));
  const minWidthValue = Math.min(...widthValues);
  const maxWidthValue = Math.max(...widthValues);

  const persistences = edges.map((edge) => edge.persistence);
  const minPersistence = Math.min(...persistences);
  const maxPersistence = Math.max(...persistences);

  const strokeWidths = new Map();
  const opacities = new Map();
  const rankWidths =
    maxWidthValue - minWidthValue < 1e-6
      ? rankEncodings(edges, minW, maxW, ARC_WIDTH_GAMMA)
      : null;
  const rankOpacities =
    maxPersistence - minPersistence < 1e-6
      ? rankEncodings(edges, minO, maxO, 1.2)
      : null;
  const proximityScales = proximityScalesForEdges(edges);

  for (const edge of edges) {
    const widthValue = widthSourceValue(edge, strengthSpread);
    strokeWidths.set(
      edge.pairKey,
      rankWidths?.get(edge.pairKey) ??
        scaledEncoding(
          widthValue,
          minWidthValue,
          maxWidthValue,
          minW,
          maxW,
          ARC_WIDTH_GAMMA
        ) ??
        (minW + maxW) / 2
    );
    opacities.set(
      edge.pairKey,
      rankOpacities?.get(edge.pairKey) ??
        scaledEncoding(
          edge.persistence,
          minPersistence,
          maxPersistence,
          minO,
          maxO,
          1.2
        ) ??
        (minO + maxO) / 2
    );
  }

  return { strokeWidths, opacities, proximityScales };
}

function normalizedRangeValue(value, min, max, outMin, outMax) {
  if (!Number.isFinite(value)) return outMin;
  if (max <= min) return (outMin + outMax) / 2;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return outMin + t * (outMax - outMin);
}
