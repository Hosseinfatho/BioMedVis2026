import { useMemo } from 'react';
import {
  COLORS,
  RESIDUE_COUNT,
  arcDirectionForEdge,
  arcOpacity,
  arcStrokeWidth,
  nodeRadius,
  systemColor,
} from './stateDriverMetrics';

const PAD = { l: 28, r: 28, t: 28, b: 12 };
const BASELINE_OFFSET = 56;

function nodeX(index, plotW) {
  if (RESIDUE_COUNT <= 1) return PAD.l;
  return PAD.l + ((index - 1) / (RESIDUE_COUNT - 1)) * plotW;
}

function arcPath(x1, x2, yBase, direction, seqSpan) {
  const midX = (x1 + x2) / 2;
  const height = 18 + seqSpan * 2.2;
  const ctrlY = yBase - direction * height;
  return `M ${x1} ${yBase} Q ${midX} ${ctrlY} ${x2} ${yBase}`;
}

function edgeColor(edge, selectedKey) {
  if (edge.pairKey === selectedKey) return COLORS.selected;
  if (edge.winner === 'shared') return COLORS.shared;
  return systemColor(edge.winner);
}

export default function DifferentialArcInteractionDiagram({
  edges = [],
  nodeProximity,
  activeSystems = [],
  selectedEdgeKey = null,
  topLabel = '',
  bottomLabel = '',
  onEdgeSelect,
  width = 920,
  height = 280,
}) {
  const layout = useMemo(() => {
    const plotW = width - PAD.l - PAD.r;
    const yBase = PAD.t + BASELINE_OFFSET;

    const nodes = [];
    for (let r = 1; r <= RESIDUE_COUNT; r += 1) {
      const x = nodeX(r, plotW);
      const meanDist = nodeProximity?.get(r) ?? 20;
      nodes.push({
        residue: r,
        x,
        y: yBase,
        r: nodeRadius(meanDist),
      });
    }

    const arcs = edges.map((edge) => {
      const x1 = nodeX(edge.source, plotW);
      const x2 = nodeX(edge.target, plotW);
      const direction = arcDirectionForEdge(edge, activeSystems);
      return {
        ...edge,
        x1,
        x2,
        yBase,
        path: arcPath(x1, x2, yBase, direction, edge.seqSpan),
        color: edgeColor(edge, selectedEdgeKey),
        strokeWidth: arcStrokeWidth(edge.displayStrength),
        opacity: arcOpacity(edge.persistence),
        direction,
      };
    });

    arcs.sort((a, b) => a.seqSpan - b.seqSpan);

    return { nodes, arcs, yBase, plotW };
  }, [edges, nodeProximity, activeSystems, selectedEdgeKey, width]);

  return (
    <div className="state-driver-arc-wrap">
      <svg
        className="state-driver-arc-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Arc interaction diagram for selected systems"
      >
        {topLabel ? (
          <text x={PAD.l} y={16} className="state-driver-arc-label">
            {topLabel}
          </text>
        ) : null}
        {bottomLabel ? (
          <text x={PAD.l} y={height - 6} className="state-driver-arc-label">
            {bottomLabel}
          </text>
        ) : null}

        {layout.arcs.map((arc) => (
          <path
            key={arc.pairKey}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={arc.strokeWidth}
            strokeOpacity={arc.opacity}
            strokeLinecap="round"
            className={`state-driver-arc${arc.pairKey === selectedEdgeKey ? ' is-selected' : ''}`}
            onClick={() => onEdgeSelect?.(arc)}
          />
        ))}

        {layout.nodes.map((node) => (
          <g key={node.residue}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill="#fff"
              stroke={COLORS.nodeStroke}
              strokeWidth="1.2"
            />
            <text
              x={node.x}
              y={node.y + 3}
              textAnchor="middle"
              className="state-driver-node-label"
            >
              {node.residue}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
