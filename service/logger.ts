import { FileLogger, type StructuredLogEntry, type LogLevel } from '../core/logger/index.js';

type ServiceLogContext = Omit<StructuredLogEntry, 'time' | 'level' | 'message'>;

export class ServiceLogger extends FileLogger {
  constructor(root: string) {
    super(root);
  }

  write(
    message: string,
    options: {
      level?: LogLevel;
      category?: string;
      stage?: string;
      theme?: string;
      sessionId?: string;
      durationMs?: number;
      meta?: Record<string, any>;
    } = {},
  ) {
    this.log(options.level || 'info', message, {
      category: options.category || options.stage || 'service',
      stage: options.stage,
      theme: options.theme,
      sessionId: options.sessionId,
      durationMs: options.durationMs,
      meta: options.meta,
    } as ServiceLogContext);
  }
}
