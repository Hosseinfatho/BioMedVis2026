import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COLORS,
  HILL_SAG,
  STATE_DRIVER_CHAIN_BASE_Y,
  STATE_DRIVER_CHAIN_PAD,
  arcVisualEncodings,
  assignArcLanes,
  buildResidueHillNodes,
  chainViewBoxString,
  computeChainViewBounds,
  hillBasePath,
  hillGuidePath,
  interactionArcPath,
  arcBulge,
  nodeX,
  systemColor,
} from './stateDriverMetrics';
import InteractionLegend from './InteractionLegend';

const PAD = STATE_DRIVER_CHAIN_PAD;
const CHAIN_BASE_Y = STATE_DRIVER_CHAIN_BASE_Y;

function edgeColor(/** @type {any} */ edge, /** @type {string | null} */ selectedKey) {
  if (edge.pairKey === selectedKey) return COLORS.selected;
  if (edge.winner === 'shared') return COLORS.shared;
  return systemColor(edge.winner);
}

/**
 * @param {Object} props
 * @param {any[]} [props.edges]
 * @param {Map<any, any> | Record<number, number>} [props.nodeProximity]
 * @param {string | null} [props.selectedEdgeKey]
 * @param {number | null} [props.selectedResidue]
 * @param {number | null} [props.highlightedResidue]
 * @param {(edge: any) => void} [props.onEdgeSelect]
 * @param {(residue: number) => void} [props.onResidueSelect]
 */
export default function DifferentialArcInteractionDiagram({
  edges = [],
  nodeProximity,
  selectedEdgeKey = null,
  selectedResidue = null,
  highlightedResidue = null,
  onEdgeSelect,
  onResidueSelect,
}) {
  const wrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const update = () => setWidth(Math.max(260, Math.floor(el.clientWidth)));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const plotW = width - PAD.l - PAD.r;
    const baseY = CHAIN_BASE_Y;
    const nodes = buildResidueHillNodes(nodeProximity, plotW, baseY, HILL_SAG, PAD.l);
    const nodeByResidue = new Map(nodes.map((n) => [n.residue, n]));

    const layeredEdges = assignArcLanes(edges);
    const { strokeWidths, opacities, proximityScales } = arcVisualEncodings(layeredEdges);

    const arcs = layeredEdges.map((edge) => {
      const n1 = nodeByResidue.get(edge.source);
      const n2 = nodeByResidue.get(edge.target);
      const x1 = n1?.x ?? nodeX(edge.source, plotW, PAD.l);
      const y1 = n1?.y ?? baseY;
      const x2 = n2?.x ?? nodeX(edge.target, plotW, PAD.l);
      const y2 = n2?.y ?? baseY;
      const proximityScale = proximityScales.get(edge.pairKey) ?? 1;
      const bulge = arcBulge(edge.seqSpan, edge.lane, proximityScale);
      return {
        ...edge,
        x1,
        x2,
        y1,
        y2,
        proximityScale,
        bulge,
        path: interactionArcPath(x1, y1, x2, y2, edge.seqSpan, edge.lane, edge.side, bulge),
        color: edgeColor(edge, selectedEdgeKey),
        strokeWidth: strokeWidths.get(edge.pairKey) ?? 2,
        opacity: opacities.get(edge.pairKey) ?? 0.6,
      };
    });

    arcs.sort(
      (a, b) =>
        (a.side === 'down' ? 0 : 1) - (b.side === 'down' ? 0 : 1) ||
        b.seqSpan - a.seqSpan ||
        a.lane - b.lane
    );

    const arcsDown = arcs.filter((a) => a.side === 'down');
    const arcsUp = arcs.filter((a) => a.side === 'up');

    const viewBounds = computeChainViewBounds(nodes, arcs);

    return {
      nodes,
      arcs,
      arcsDown,
      arcsUp,
      basePath: hillBasePath(plotW, baseY, HILL_SAG, PAD.l),
      guidePath: hillGuidePath(nodes),
      viewBounds,
      baseY,
      plotW,
    };
  }, [edges, nodeProximity, selectedEdgeKey, width]);

  return (
    <div ref={wrapRef} className="state-driver-arc-wrap">
      <div className="state-driver-arc-overlay">
        <InteractionLegend />
      </div>
      <svg
        className="state-driver-arc-svg"
        viewBox={chainViewBoxString(layout.viewBounds)}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Arc interaction diagram for selected systems"
      >
        <path
          d={layout.basePath}
          fill="none"
          stroke="#dde2ea"
          strokeWidth="1.25"
          strokeDasharray="4 3"
          strokeLinecap="round"
          className="state-driver-hill-base"
        />

        {layout.arcsDown.map((arc) => (
          <path
            key={arc.pairKey}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={arc.strokeWidth}
            strokeOpacity={arc.opacity}
            strokeLinecap="round"
            className={`state-driver-arc state-driver-arc--down${arc.pairKey === selectedEdgeKey ? ' is-selected' : ''}`}
            onClick={() => onEdgeSelect?.(arc)}
          />
        ))}

        <path
          d={layout.guidePath}
          fill="none"
          stroke="#aeb8c8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="state-driver-hill-guide"
        />

        {layout.arcsUp.map((arc) => (
          <path
            key={arc.pairKey}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={arc.strokeWidth}
            strokeOpacity={arc.opacity}
            strokeLinecap="round"
            className={`state-driver-arc state-driver-arc--up${arc.pairKey === selectedEdgeKey ? ' is-selected' : ''}`}
            onClick={() => onEdgeSelect?.(arc)}
          />
        ))}

        {layout.nodes.map((node) => {
          const isSelected = selectedResidue === node.residue;
          const isHighlighted = !isSelected && highlightedResidue === node.residue;
          const hitR = Math.max(node.r + 2, 8);
          return (
            <g
              key={node.residue}
              className={[
                'state-driver-node',
                isSelected ? 'is-selected' : '',
                isHighlighted ? 'is-highlighted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onResidueSelect?.(node.residue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onResidueSelect?.(node.residue);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Residue ${node.residue}${isSelected ? ', filtering contacts' : ''}`}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 3}
                  fill={COLORS.selected}
                  fillOpacity={0.22}
                  stroke="none"
                  className="state-driver-node-glow"
                  pointerEvents="none"
                />
              ) : null}
              <circle
                cx={node.x}
                cy={node.y}
                r={hitR}
                fill="transparent"
                className="state-driver-node-hit"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={isSelected || isHighlighted ? node.r + 1.5 : node.r}
                fill="#fff"
                fillOpacity={isSelected ? 0.92 : 1}
                stroke={isSelected || isHighlighted ? COLORS.selected : COLORS.nodeStroke}
                strokeWidth={isSelected ? 2 : isHighlighted ? 1.6 : 1.2}
                strokeOpacity={isSelected ? 0.95 : isHighlighted ? 0.75 : 1}
                className="state-driver-node-ring"
                pointerEvents="none"
              />
              <text
                x={node.x}
                y={node.y + 3}
                textAnchor="middle"
                className="state-driver-node-label"
                pointerEvents="none"
              >
                {node.residue}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
