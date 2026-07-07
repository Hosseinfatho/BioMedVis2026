import { buildRepresentativeFrames } from './buildRepresentativeFrames.js';

const topK = process.env.REPRESENTATIVE_TOP_K
  ? Number.parseInt(process.env.REPRESENTATIVE_TOP_K, 10)
  : 5;

async function main() {
  process.stdout.write(`Building representative_frames.csv (top ${topK})…\n`);

  const result = await buildRepresentativeFrames({ topK });

  process.stdout.write(
    `Scanned ${result.scanned.toLocaleString()} frame_index rows\n`
  );
  process.stdout.write(
    `Matched ${result.matched.toLocaleString()} rows with structural features\n`
  );
  process.stdout.write(
    `Selected ${result.rowCount} representatives from ${result.groupCount} state groups\n`
  );
  process.stdout.write(`Wrote → ${result.outputPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
