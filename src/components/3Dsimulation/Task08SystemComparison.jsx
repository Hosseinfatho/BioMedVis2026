import TaskChartShell from './TaskChartShell';

export default function Task08SystemComparison({ systemId }) {
  return (
    <TaskChartShell
      title="8. Cross-system residue comparison"
      question="With TMP (zsab3) or SPA (zsab4), do residues differ from free Aβ42 (zsab2)?"
      why="Core comparative question of the challenge at residue resolution."
    >
      <div className="task-chart-placeholder">
        Compare <strong>{systemId}</strong> against other systems — pending
        multi-system XTC metrics.
      </div>
    </TaskChartShell>
  );
}
