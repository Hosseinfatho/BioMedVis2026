import fs from 'node:fs';
import path from 'node:path';
import { FRAME_INDEX_COLUMNS } from './buildFrameIndex.js';

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowToCsvLine(row, columns = FRAME_INDEX_COLUMNS) {
  return columns.map((col) => escapeCsv(row[col])).join(',');
}

export function writeFrameIndexCsv(rows, outputPath, columns = FRAME_INDEX_COLUMNS) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  stream.write(`${columns.join(',')}\n`);

  let count = 0;
  for (const row of rows) {
    stream.write(`${rowToCsvLine(row, columns)}\n`);
    count += 1;
  }

  return new Promise((resolve, reject) => {
    stream.end(() => resolve(count));
    stream.on('error', reject);
  });
}

export async function appendFrameIndexRows(rows, outputPath, columns = FRAME_INDEX_COLUMNS) {
  const stream = fs.createWriteStream(outputPath, {
    encoding: 'utf8',
    flags: 'a',
  });

  let count = 0;
  for (const row of rows) {
    stream.write(`${rowToCsvLine(row, columns)}\n`);
    count += 1;
  }

  return new Promise((resolve, reject) => {
    stream.end(() => resolve(count));
    stream.on('error', reject);
  });
}
