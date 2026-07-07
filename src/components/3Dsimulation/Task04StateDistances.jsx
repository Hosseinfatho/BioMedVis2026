import TaskChartShell from './TaskChartShell';

export default function Task04StateDistances({ trajectoryName, numStates }) {
  return (
    <TaskChartShell
      title="4. Residue distances vs Markov states"
      question="In state 0 vs state 2, do specific residue pairs get closer or farther?"
      why="Links abstract MSM states to measurable structural differences."
    >
      <div className="task-chart-placeholder">
        Distance-by-state chart ({numStates} states) for{' '}
        <strong>{trajectoryName}</strong> — needs XTC + states*.txt.
      </div>
    </TaskChartShell>
  );
}
