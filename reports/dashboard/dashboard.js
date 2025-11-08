const noop = () => {};

async function fetchJSON(path) {
  try {
    const res = await fetch(`${path}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return await res.json();
  } catch (error) {
    console.warn(`[dashboard] ${error.message}`);
    return null;
  }
}

function formatTimestamp(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function badgeForStatus(status) {
  const normalized = (status || '').toLowerCase();
  if (['success', 'done', 'complete'].includes(normalized)) return 'badge-success';
  if (['warning', 'pending', 'degraded'].includes(normalized)) return 'badge-warning';
  return 'badge-muted';
}

function badgeForScore(score) {
  if (score >= 95) return 'badge-success';
  if (score >= 85) return 'badge-warning';
  return 'badge-muted';
}

function decorateThemes(themes = []) {
  return themes.map((theme) => {
    const score = theme.score ?? 0;
    return {
      ...theme,
      scoreText: `${score || '—'}`,
      badgeClass: badgeForScore(score),
      statusLabel: score >= 95 ? 'Healthy' : score >= 85 ? 'Review' : 'Needs attention',
    };
  });
}

function decorateRequests(requests = []) {
  return requests.map((req) => ({
    ...req,
    badge: badgeForStatus(req.status),
  }));
}

function decorateTasks(tasks = []) {
  return tasks.map((task) => ({
    ...task,
    badge: badgeForStatus(task.status),
  }));
}

function decorateLighthouse(entries = []) {
  return entries.map((entry) => ({
    ...entry,
    badge: badgeForScore(Number(entry.score)),
  }));
}

function defaultDocStats() {
  return { count: 0, directives: 0, reports: 0, missing: [], directiveEntries: [] };
}

window.dashboardApp = function dashboardApp() {
  return {
    loading: true,
    healthScore: 0,
    harmonyAverage: 0,
    docsCoverage: 0,
    docStats: defaultDocStats(),
    ciSummary: 'Awaiting run',
    themes: [],
    schemaDrift: [],
    customRequests: [],
    lighthouse: [],
    visualReports: [],
    directives: [],
    taskLog: [],
    systemLog: '',
    lastSyncedLabel: 'Never',
    uiVersion: '0.0.0',
    harmonyChart: null,
    async init() {
      await this.refresh();
    },
    async refresh() {
      this.loading = true;
      const payload = await fetchJSON('./data/observatory.json');
      if (!payload) {
        this.loading = false;
        return;
      }
      this.healthScore = payload.healthScore ?? 0;
      this.harmonyAverage = payload.harmonyAverage ?? 0;
      this.docsCoverage = payload.docsCoverage ?? 0;
      this.docStats = payload.docStats || defaultDocStats();
      this.themes = decorateThemes(payload.themes);
      this.schemaDrift = payload.schemaDrift || [];
      this.customRequests = decorateRequests(payload.customRequests);
      this.lighthouse = decorateLighthouse(payload.lighthouse);
      this.visualReports = payload.visualReports || [];
      this.directives = (this.docStats.directiveEntries || []).map((entry) => ({
        name: entry.title || entry.name,
        summary: entry.summary || '',
        path: entry.path || '#',
      }));
      this.taskLog = decorateTasks(payload.taskLog);
      this.systemLog = payload.systemLog || '';
      this.ciSummary = payload.ciSummary || 'Awaiting run';
      this.uiVersion = payload.uiVersion || '0.0.0';
      this.lastSyncedLabel = formatTimestamp(payload.generatedAt);
      this.renderCharts();
      this.loading = false;
    },
    renderCharts() {
      const ctx = document.getElementById('harmonyChart');
      if (!ctx || typeof Chart === 'undefined') return;
      if (this.harmonyChart) {
        this.harmonyChart.destroy();
      }
      this.harmonyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.themes.map((theme) => theme.name),
          datasets: [
            {
              label: 'Harmony Score',
              data: this.themes.map((theme) => theme.score || 0),
              borderColor: '#22d3ee',
              backgroundColor: 'rgba(34, 211, 238, 0.2)',
              tension: 0.35,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: {
                color: '#94a3b8',
              },
            },
            x: {
              ticks: {
                color: '#94a3b8',
              },
            },
          },
          plugins: {
            legend: {
              labels: {
                color: '#cbd5f5',
              },
            },
          },
        },
      });
    },
  };
};
