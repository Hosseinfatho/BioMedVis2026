import TaskChartShell from './TaskChartShell';

export default function Task10BrushLink({ selection, trajectoryName }) {
  const brushLabel =
    selection && selection.startCol != null
      ? `columns ${selection.startCol}–${selection.endCol}`
      : 'no matrix brush selected';

  return (
    <TaskChartShell
      title="10. Dashboard brush → 3D link"
      question="What do residues look like in the brushed trajectory window?"
      why="Connects ensemble matrix view to structural inspection."
    >
      <div className="task-chart-placeholder">
        Matrix brush: <strong>{brushLabel}</strong>. Default trajectory:{' '}
        <strong>{trajectoryName}</strong>. Frame-range 3D playback coming next.
      </div>
    </TaskChartShell>
  );
}
