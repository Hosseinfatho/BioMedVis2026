import { buildStateSummaries } from './buildStateSummaries.js';

async function main() {
  process.stdout.write('Building state-level summaries…\n');
  const result = await buildStateSummaries();

  process.stdout.write(
    `Scanned ${result.scanned.toLocaleString()} frame_index rows\n`
  );
  process.stdout.write(
    `Matched ${result.matched.toLocaleString()} rows with structural features\n`
  );
  process.stdout.write(
    `Wrote ${result.summaryCount} state groups → ${result.outputDir}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
