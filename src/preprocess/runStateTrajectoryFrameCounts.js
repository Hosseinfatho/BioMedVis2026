import {
  buildStateTrajectoryFrameCounts,
  DEFAULT_PERCENTILE,
} from './buildStateTrajectoryFrameCounts.js';

const thresholdPercentile = process.env.THRESHOLD_PERCENTILE
  ? Number.parseFloat(process.env.THRESHOLD_PERCENTILE)
  : DEFAULT_PERCENTILE;

async function main() {
  process.stdout.write(
    `Building state_trajectory_frame_counts.json (P${thresholdPercentile})…\n`
  );
  const result = await buildStateTrajectoryFrameCounts({ thresholdPercentile });
  process.stdout.write(`Scanned ${result.scanned.toLocaleString()} frame_index rows\n`);
  process.stdout.write(`Matched ${result.matched.toLocaleString()} structural rows\n`);
  process.stdout.write(`Wrote ${result.groupCount} state groups → ${result.outputPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
