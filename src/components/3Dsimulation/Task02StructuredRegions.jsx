import TaskChartShell from './TaskChartShell';

export default function Task02StructuredRegions({ trajectoryName }) {
  return (
    <TaskChartShell
      title="2. Structured vs disordered regions"
      question="Do residues 15–21 stay helical? Is the C-terminus (30–42) extended?"
      why="Helix vs β-strand balance is central to Aβ42 toxicity and drug effects."
    >
      <div className="task-chart-placeholder">
        Secondary-structure timeline for <strong>{trajectoryName}</strong> —
        pending DSSP / geometry analysis on XTC.
      </div>
    </TaskChartShell>
  );
}
