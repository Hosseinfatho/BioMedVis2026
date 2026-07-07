import fs from 'node:fs';
import path from 'node:path';
import { SYSTEMS, MODELS } from '../config/dataFiles.js';
import { buildFrameIndexRowsForSystemModel, FRAME_INDEX_COLUMNS } from './buildFrameIndex.js';
import { OUTPUT_DIR } from './paths.js';

const OUTPUT_FILE = path.join(OUTPUT_DIR, 'frame_index.csv');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${FRAME_INDEX_COLUMNS.join(',')}\n`, 'utf8');

  let totalRows = 0;

  for (const systemId of Object.keys(SYSTEMS)) {
    for (const modelId of Object.keys(MODELS)) {
      const label = `${systemId}/${modelId}`;
      process.stdout.write(`Building ${label}… `);

      const rows = buildFrameIndexRowsForSystemModel(systemId, modelId);
      const body = rows.map((row) =>
        FRAME_INDEX_COLUMNS.map((col) => {
          const value = row[col];
          const text = String(value ?? '');
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(',')
      );

      fs.appendFileSync(OUTPUT_FILE, `${body.join('\n')}\n`, 'utf8');
      totalRows += rows.length;
      process.stdout.write(`${rows.length.toLocaleString()} rows\n`);
    }
  }

  process.stdout.write(`Wrote ${totalRows.toLocaleString()} rows → ${OUTPUT_FILE}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
