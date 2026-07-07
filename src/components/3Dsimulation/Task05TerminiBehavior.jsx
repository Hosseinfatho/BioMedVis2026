import TaskChartShell from './TaskChartShell';

export default function Task05TerminiBehavior({ systemId }) {
  return (
    <TaskChartShell
      title="5. N-terminal vs C-terminal behavior"
      question="Does resid 1–15 behave differently from resid 28–42?"
      why="Drug candidates may stabilize or perturb specific peptide segments."
    >
      <div className="task-chart-placeholder">
        Segment comparison for <strong>{systemId}</strong> — pending regional
        metrics on XTC.
      </div>
    </TaskChartShell>
  );
}
