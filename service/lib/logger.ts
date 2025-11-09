// @reuse-from: fs-extra
// @description: Brand-specific logger used by the Brand Wizard routes and tools.
import fs from 'fs-extra';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logsDir);

/**
 * Records Brand Wizard operations into logs/brands.log for traceability.
 * Keeps payload flexible so routes/tools can pass contextual data.
 */
export function brandLog(entry: Record<string, any>) {
  const line = `${JSON.stringify({
    ts: new Date().toISOString(),
    channel: 'brand',
    ...entry,
  })}\n`;
  fs.appendFileSync(path.join(logsDir, 'brands.log'), line, 'utf8');
}
