import TaskChartShell from './TaskChartShell';

export default function Task09LocalGlobalMotion({ trajectoryName }) {
  return (
    <TaskChartShell
      title="9. Local vs global motion"
      question="Is the whole peptide moving, or only a local loop?"
      why="Separates rigid-body drift from internal conformational change."
    >
      <div className="task-chart-placeholder">
        Per-residue / per-segment RMSD for <strong>{trajectoryName}</strong> after
        alignment.
      </div>
    </TaskChartShell>
  );
}
