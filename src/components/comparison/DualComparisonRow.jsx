import { SYSTEMS, MODELS, VIEW_MODES } from '../../config/dataFiles';
import DualTrajectoryRows from '../DualTrajectoryRows';
import DualState from '../DualState';

export default function DualComparisonRow({
  systemA,
  systemB,
  rowsA,
  rowsB,
  modelId,
  numStates,
  viewMode,
  timeOffsetB,
  onTimeOffsetBChange,
  selection,
  hoverIndex,
}) {
  if (viewMode !== 'original') {
    return (
      <div className="comparison-row dual-comparison-note">
        Dual overlay is available in <strong>Original</strong> trajectory view only.
      </div>
    );
  }

  const countA = rowsA?.length || 0;
  const countB = rowsB?.length || 0;

  return (
    <div className="comparison-row dual-comparison-row">
      <div className="comparison-header">
        <h2>
          {SYSTEMS[systemA].label}
          <span className="system-meta">({systemA})</span>
          <span className="dual-vs"> + </span>
          {SYSTEMS[systemB].label}
          <span className="system-meta">
            ({systemB}) · {countA} / {countB} trajectories ·{' '}
            {VIEW_MODES[viewMode].label} · {MODELS[modelId].label}
          </span>
        </h2>
      </div>
      <div className="comparison-charts">
        <div className="panel-half panel-epoch">
          <DualTrajectoryRows
            rowsA={rowsA}
            rowsB={rowsB}
            timeOffsetB={timeOffsetB}
            onTimeOffsetBChange={onTimeOffsetBChange}
            selection={selection}
            hoverIndex={hoverIndex}
          />
        </div>
        <div className="panel-half panel-state">
          <DualState
            rowsA={rowsA}
            rowsB={rowsB}
            numStates={numStates}
            timeOffsetB={timeOffsetB}
            onTimeOffsetBChange={onTimeOffsetBChange}
            selection={selection}
            hoverIndex={hoverIndex}
          />
        </div>
      </div>
    </div>
  );
}
