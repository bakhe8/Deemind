type RawIssue = {
  code?: string;
  message?: string;
  page?: string;
  file?: string;
  template?: string;
  type?: string;
};

export type IssueEntry = {
  id: string;
  level: 'error' | 'warning';
  code: string;
  message: string;
  page?: string | null;
  type?: string | null;
};

export type IssueGroup = {
  key: string;
  label: string;
  level: 'error' | 'warning';
  entries: IssueEntry[];
  remediation?: string | null;
};

export type ReportDigest = {
  errors: IssueEntry[];
  warnings: IssueEntry[];
  groups: IssueGroup[];
  totals: {
    errors: number;
    warnings: number;
  };
};

const toEntry = (issue: RawIssue, level: 'error' | 'warning', idx: number): IssueEntry => {
  const code = issue.code || issue.type || 'general';
  const page = issue.page || issue.file || issue.template || null;
  const message = issue.message || `[${code}]`;
  return {
    id: `${level}-${code}-${idx}`,
    level,
    code,
    message,
    page,
    type: issue.type || null,
  };
};

function normalizeIssues(list: unknown, level: 'error' | 'warning') {
  if (!Array.isArray(list)) return [];
  return list
    .map((issue, idx) => {
      if (!issue || typeof issue !== 'object') return null;
      return toEntry(issue as RawIssue, level, idx);
    })
    .filter(Boolean) as IssueEntry[];
}

/**
 * Normalizes raw validator output into grouped issue summaries the UI can filter.
 */
export function digestReport(report: Record<string, any> | null): ReportDigest {
  const errors = normalizeIssues(report?.errors, 'error');
  const warnings = normalizeIssues(report?.warnings, 'warning');

  const groupsMap = new Map<string, IssueGroup>();
  const addToGroup = (entry: IssueEntry) => {
    const key = entry.code || entry.type || 'general';
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        label: key,
        level: entry.level,
        entries: [],
      });
    }
    groupsMap.get(key)!.entries.push(entry);
  };

  [...errors, ...warnings].forEach(addToGroup);

  const groups = Array.from(groupsMap.values())
    .map((group) => ({
      ...group,
      remediation: getRemediationLink(group.key),
    }))
    .sort((a, b) => b.entries.length - a.entries.length);

  return {
    errors,
    warnings,
    groups,
    totals: {
      errors: errors.length,
      warnings: warnings.length,
    },
  };
}

const REMEDIATION_BASE = 'https://docs.deemind.dev/validator/';
const REMEDIATION_MAP: Record<string, string> = {
  'missing-slot': 'missing-slot',
  'missing-component': 'missing-component',
  'invalid-schema': 'schema',
  'unused-asset': 'assets',
  'unknown-component': 'components',
};

/**
 * Returns a documentation URL for the given issue code, if known.
 */
export function getRemediationLink(code: string | null | undefined) {
  if (!code) return null;
  const normalized = code.toLowerCase();
  const slug = REMEDIATION_MAP[normalized] || normalized.replace(/[^a-z0-9-]/g, '-');
  return `${REMEDIATION_BASE}${slug}`;
}
