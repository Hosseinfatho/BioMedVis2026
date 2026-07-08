import { ensureStructuralIndexDb } from './structuralIndexDb.js';

async function main() {
  process.stdout.write('Building structural_index.db…\n');
  const result = await ensureStructuralIndexDb({ force: true });
  result.db.exec('PRAGMA wal_checkpoint(FULL)');
  result.db.close();
  process.stdout.write(
    `Indexed ${result.frameCount.toLocaleString()} frames → ${result.dbPath}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
