import TaskChartShell from './TaskChartShell';

export default function Task03Rmsf({ trajectoryName }) {
  return (
    <TaskChartShell
      title="3. Residue flexibility (RMSF)"
      question="Which residues fluctuate most across frames?"
      why="High RMSF marks flexible/disordered segments; low RMSF marks stable cores."
    >
      <div className="task-chart-placeholder">
        Per-residue RMSF bar chart for <strong>{trajectoryName}</strong> —
        pending multi-frame XTC analysis.
      </div>
    </TaskChartShell>
  );
}
