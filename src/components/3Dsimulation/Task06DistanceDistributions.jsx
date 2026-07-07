import TaskChartShell from './TaskChartShell';

export default function Task06DistanceDistributions({ trajectoryName, numStates }) {
  return (
    <TaskChartShell
      title="6. Distance distributions per state"
      question="What is the distribution of distance(resid 1, resid 42) in each Markov state?"
      why="Makes compact/extended states interpretable with concrete geometry."
    >
      <div className="task-chart-placeholder">
        Histogram / violin per state ({numStates} states) for{' '}
        <strong>{trajectoryName}</strong>.
      </div>
    </TaskChartShell>
  );
}
