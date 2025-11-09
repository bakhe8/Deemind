import fs from 'fs-extra';
import path from 'path';
import EventEmitter from 'events';

export type LogEntry = {
  ts: string;
  level: 'info' | 'warn' | 'error' | string;
  message: string;
  stage?: string;
  meta?: Record<string, any>;
};

export class FileLogger extends EventEmitter {
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    fs.ensureDirSync(path.dirname(filePath));
  }

  write(message: string, options: { level?: string; stage?: string; meta?: Record<string, any> } = {}) {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level: (options.level || 'info') as LogEntry['level'],
      stage: options.stage,
      message,
      meta: options.meta,
    };
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`);
    this.emit('entry', entry);
    // Mirror to console for local visibility
    const consoleLine = `[${entry.ts}] ${entry.stage ? `${entry.stage} • ` : ''}${entry.message}`;
    console.log(consoleLine);
  }

  async tail(limit = 200): Promise<LogEntry[]> {
    try {
      const contents = await fs.readFile(this.filePath, 'utf8');
      const lines = contents.split(/\r?\n/).filter(Boolean);
      return lines.slice(-limit).map((line) => {
        try {
          return JSON.parse(line) as LogEntry;
        } catch {
          return {
            ts: new Date().toISOString(),
            level: 'info',
            message: line,
          };
        }
      });
    } catch {
      return [];
    }
  }
}

export function createLogger(rootDir: string, fileName = 'deemind.log') {
  const logDir = path.join(rootDir, 'logs');
  const file = path.join(logDir, fileName);
  return new FileLogger(file);
}
