import TaskChartShell from './TaskChartShell';

export default function Task07TransitionDrivers({ trajectoryName }) {
  return (
    <TaskChartShell
      title="7. Residues driving state transitions"
      question="At frames where state changes (e.g. 0→2), which residues move most?"
      why="Identifies structural drivers behind MSM transition events."
    >
      <div className="task-chart-placeholder">
        Transition-frame displacement ranking for <strong>{trajectoryName}</strong>.
      </div>
    </TaskChartShell>
  );
}
