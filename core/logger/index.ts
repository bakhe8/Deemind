import fs from 'fs-extra';
import path from 'path';
import EventEmitter from 'events';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type StructuredLogEntry = {
  time: string;
  level: LogLevel;
  message: string;
  category?: string;
  stage?: string;
  theme?: string;
  durationMs?: number;
  sessionId?: string;
  meta?: Record<string, any>;
};

type StructuredLoggerOptions = {
  logDir?: string;
  executionFile?: string;
  debugFile?: string;
  errorFile?: string;
};

export class StructuredLogger extends EventEmitter {
  private logDir: string;
  private executionPath: string;
  private debugPath: string;
  private errorPath: string;
  private themeDir: string;

  constructor(rootDir: string, options: StructuredLoggerOptions = {}) {
    super();
    this.logDir = options.logDir || path.join(rootDir, 'logs');
    fs.ensureDirSync(this.logDir);
    this.executionPath = path.join(this.logDir, options.executionFile || 'deemind-execution.log');
    this.debugPath = path.join(this.logDir, options.debugFile || 'deemind-debug.jsonl');
    this.errorPath = path.join(this.logDir, options.errorFile || 'deemind-errors.log');
    this.themeDir = path.join(this.logDir, 'themes');
    fs.ensureDirSync(this.themeDir);
  }

  log(level: LogLevel, message: string, context: Omit<StructuredLogEntry, 'time' | 'level' | 'message'> = {}) {
    const entry: StructuredLogEntry = {
      time: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    this.writeExecutionLine(entry);
    this.writeDebugEntry(entry);
    if (level === 'error') {
      this.writeErrorLine(entry);
    }
    this.emit('entry', entry);
  }

  info(message: string, context?: Omit<StructuredLogEntry, 'time' | 'level' | 'message'>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Omit<StructuredLogEntry, 'time' | 'level' | 'message'>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Omit<StructuredLogEntry, 'time' | 'level' | 'message'>) {
    this.log('error', message, context);
  }

  debug(message: string, context?: Omit<StructuredLogEntry, 'time' | 'level' | 'message'>) {
    this.log('debug', message, context);
  }

  write(message: string, options: { level?: LogLevel; category?: string; stage?: string; meta?: Record<string, any>; theme?: string; sessionId?: string; durationMs?: number } = {}) {
    this.log(options.level || 'info', message, {
      category: options.category,
      stage: options.stage,
      meta: options.meta,
      theme: options.theme,
      sessionId: options.sessionId,
      durationMs: options.durationMs,
    });
  }

  async tail(limit = 200): Promise<StructuredLogEntry[]> {
    try {
      const contents = await fs.readFile(this.debugPath, 'utf8');
      const lines = contents.split(/\r?\n/).filter(Boolean);
      return lines.slice(-limit).map((line) => {
        try {
          return JSON.parse(line) as StructuredLogEntry;
        } catch {
          return {
            time: new Date().toISOString(),
            level: 'info',
            message: line,
          };
        }
      });
    } catch {
      return [];
    }
  }

  logThemeEntry(theme: string, entry: StructuredLogEntry) {
    const file = path.join(this.themeDir, `${theme.replace(/[^a-z0-9-_]/gi, '-')}-build.log`);
    const metaText = entry.meta && Object.keys(entry.meta).length ? ` ${JSON.stringify(entry.meta)}` : '';
    const line = `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.message}${metaText}\n`;
    fs.appendFileSync(file, line);
  }

  private writeExecutionLine(entry: StructuredLogEntry) {
    const parts: string[] = [];
    if (entry.category) parts.push(entry.category);
    if (entry.theme) parts.push(entry.theme);
    if (entry.sessionId) parts.push(`session:${entry.sessionId}`);
    const context = parts.length ? `[${parts.join(' • ')}] ` : '';
    const metaText = entry.meta && Object.keys(entry.meta).length ? ` ${JSON.stringify(entry.meta)}` : '';
    const durationText = typeof entry.durationMs === 'number' ? ` (${entry.durationMs}ms)` : '';
    const line = `[${entry.time}] [${entry.level.toUpperCase()}] ${context}${entry.message}${durationText}${metaText}\n`;
    fs.appendFileSync(this.executionPath, line);
  }

  private writeDebugEntry(entry: StructuredLogEntry) {
    fs.appendFileSync(this.debugPath, `${JSON.stringify(entry)}\n`);
  }

  private writeErrorLine(entry: StructuredLogEntry) {
    const metaText = entry.meta && Object.keys(entry.meta).length ? ` ${JSON.stringify(entry.meta)}` : '';
    const line = `[${entry.time}] ${entry.message}${metaText}\n`;
    fs.appendFileSync(this.errorPath, line);
  }
}

export const FileLogger = StructuredLogger;

export function createLogger(rootDir: string) {
  return new StructuredLogger(rootDir);
}
