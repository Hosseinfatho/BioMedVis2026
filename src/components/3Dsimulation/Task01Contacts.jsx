import TaskChartShell from './TaskChartShell';

export default function Task01Contacts({ trajectoryName, frameIndex }) {
  return (
    <TaskChartShell
      title="1. Residue contacts over time"
      question="Do residues i and j come within ~4–6 Å of each other?"
      why="Contacts drive folding, aggregation, and drug binding."
    >
      <div className="task-chart-placeholder">
        Contact map for <strong>{trajectoryName}</strong> (frame {frameIndex}) —
        pending XTC distance analysis.
      </div>
    </TaskChartShell>
  );
}
