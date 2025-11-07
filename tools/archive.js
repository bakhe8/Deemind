import path from 'path';
import { archiveTheme } from './delivery-pipeline.js';

const theme = process.argv[2] || 'demo';
const outputPath = path.join(process.cwd(), 'output', theme);

archiveTheme(outputPath).then((p) => {
  console.log(`Archive note written: ${p}`);
}).catch((e) => {
  console.error('Archive failed', e);
  process.exit(1);
});

