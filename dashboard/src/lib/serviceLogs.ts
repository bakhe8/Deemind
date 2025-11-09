export type ServiceLogEntry = {
  ts: string;
  level: string;
  message: string;
  stage?: string;
  meta?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const coerceMessage = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const baseEntry = (): ServiceLogEntry => ({
  ts: new Date().toISOString(),
  level: 'info',
  message: '',
});

const LEVEL_LABELS: Record<string, string> = {
  error: 'Error',
  warn: 'Warn',
  warning: 'Warn',
  info: 'Info',
  debug: 'Debug',
  trace: 'Trace',
};

export function toServiceLogEntry(value: unknown): ServiceLogEntry | null {
  if (isRecord(value)) {
    const entry = baseEntry();
    if (typeof value.ts === 'string') entry.ts = value.ts;
    if (typeof value.level === 'string') entry.level = value.level;
    entry.message = coerceMessage(value.message);
    if (typeof value.stage === 'string') entry.stage = value.stage;
    if (isRecord(value.meta)) entry.meta = value.meta;
    return entry;
  }
  if (typeof value === 'string') {
    return {
      ts: new Date().toISOString(),
      level: 'info',
      message: value,
    };
  }
  return null;
}

export function normalizeLogEntries(entries: unknown[]): ServiceLogEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => toServiceLogEntry(entry))
    .filter((entry): entry is ServiceLogEntry => Boolean(entry));
}

const coerceStage = (entry: ServiceLogEntry) => {
  if (entry.stage && typeof entry.stage === 'string') return entry.stage;
  const metaStage =
    (isRecord(entry.meta) && typeof entry.meta.stage === 'string' && entry.meta.stage) ||
    (isRecord(entry.meta) && typeof entry.meta.category === 'string' && entry.meta.category);
  return metaStage || null;
};

export function parseLogStreamPayload(payload: string): ServiceLogEntry | null {
  const trimmed = payload?.trim();
  if (!trimmed) return null;
  try {
    return toServiceLogEntry(JSON.parse(trimmed));
  } catch {
    return toServiceLogEntry(trimmed);
  }
}

export function getLogStage(entry: ServiceLogEntry) {
  return coerceStage(entry);
}

export function getLogLevelLabel(level: string) {
  const normalized = level?.toLowerCase();
  return LEVEL_LABELS[normalized] || (level ? level.toUpperCase() : 'INFO');
}

export function formatServiceLogEntry(
  entry: ServiceLogEntry,
  options: { includeStage?: boolean } = {},
) {
  const { includeStage = true } = options;
  const timestamp = new Date(entry.ts).toLocaleTimeString([], { hour12: false });
  const stage = includeStage ? getLogStage(entry) : null;
  const stagePrefix = stage ? `${stage} • ` : '';
  return `[${timestamp}] ${stagePrefix}${entry.message}`;
}
