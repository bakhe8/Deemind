// Very basic conflict detection: duplicate basenames and empty pages

/**
 * Detect simple conflicts across pages.
 * Why: Duplicate basenames often hide divergent versions of the same
 * page (platform reviewers dislike this), and empty files pass silently
 * unless we flag them here for early correction.
 */
export function detectConflicts(pages) {
  const issues = [];
  const seen = new Map();
  for (const p of pages) {
    const base = p.rel.replace(/\\/g, '/').split('/').pop();
    const key = base.toLowerCase();
    if (seen.has(key)) {
      issues.push({ type: 'duplicate-basename', files: [seen.get(key), p.rel] });
    } else {
      seen.set(key, p.rel);
    }
    if (!p.html || !p.html.trim()) {
      issues.push({ type: 'empty-file', file: p.rel });
    }
  }
  return issues;
}
