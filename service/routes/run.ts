import type express from 'express';
import path from 'path';
import type { RunMode, RunRequest, JobStatus } from '../../core/contracts/api.contract.js';
import type { TaskRunner } from '../task-runner.js';
import type { ServiceLogger } from '../logger.js';
import { sanitizeThemeName } from '../lib/sanitize.js';

type RegisterRunRouteOptions = {
  app: express.Express;
  auth: express.RequestHandler;
  config: any;
  runner: TaskRunner;
  rootDir: string;
  logger: ServiceLogger;
};

type LegacyRunRequest = RunRequest & { task?: string; cmd?: string; theme?: string; args?: string[] };

type SimpleCommand = {
  command: string;
  args: string[];
};

const MODE_TASK_MAP: Record<RunMode, string> = {
  build: 'build-all',
  validate: 'validate',
  doctor: 'doctor',
};

export function registerRunRoutes(options: RegisterRunRouteOptions) {
  const { app, auth, config, runner, rootDir, logger } = options;
  const jobStatusMap = new Map<string, JobStatus>();

  const recordJob = (job: JobStatus) => {
    jobStatusMap.set(job.id, job);
    if (jobStatusMap.size > 50) {
      const oldest = jobStatusMap.keys().next().value;
      jobStatusMap.delete(oldest);
    }
  };

  const updateJobStatus = (id: string, patch: Partial<JobStatus>) => {
    const current = jobStatusMap.get(id);
    if (!current) return;
    const next = { ...current, ...patch };
    jobStatusMap.set(id, next);
  };

  const resolveRunTask = (req: LegacyRunRequest) => {
    if (req.mode && MODE_TASK_MAP[req.mode]) {
      return { task: MODE_TASK_MAP[req.mode], mode: req.mode };
    }
    if (req.task) {
      return { task: req.task, mode: undefined };
    }
    return null;
  };

  app.post('/api/run', auth, (req, res) => {
    const payload = (req.body || {}) as LegacyRunRequest;
    if (payload.cmd) {
      const theme = payload.theme ? sanitizeThemeName(payload.theme) : undefined;
      const derived = resolveSimpleCommand(payload.cmd, { theme, args: payload.args });
      if (!derived) {
        return res.status(400).json({ error: 'unsupported cmd or theme missing' });
      }
      const id = cryptoId();
      const job: JobStatus = {
        id,
        status: 'queued',
        startedAt: undefined,
        finishedAt: undefined,
        message: `${payload.cmd}${theme ? `:${theme}` : ''}`,
      };
      recordJob(job);
      logger.write(`enqueue cmd ${payload.cmd} (${id})`);
      runner.enqueue({
        id,
        label: `${payload.cmd}${theme ? `:${theme}` : ''}`,
        command: derived.command,
        args: derived.args,
        cwd: rootDir,
        meta: { jobId: id, cmd: payload.cmd, theme },
      });
      return res.json(job);
    }
    const resolved = resolveRunTask(payload);
    const taskKey = resolved?.task;
    if (!taskKey) {
      return res.status(400).json({ error: 'mode or task is required' });
    }
    const def = config.tasks?.[taskKey];
    if (!def) {
      return res.status(400).json({ error: `Unknown task: ${taskKey}` });
    }
    const args = Array.isArray(def.args) ? [...def.args] : [];
    if (payload.inputFolder) {
      args.push(payload.inputFolder);
    }
    const id = cryptoId();
    const job: JobStatus = {
      id,
      status: 'queued',
      startedAt: undefined,
      finishedAt: undefined,
      message: resolved?.mode ? `mode:${resolved.mode}` : undefined,
    };
    recordJob(job);
    logger.write(`enqueue task ${taskKey} (${id})`);
    runner.enqueue({
      id,
      label: taskKey,
      command: def.command,
      args,
      cwd: rootDir,
      meta: { jobId: id, mode: resolved?.mode, task: taskKey },
      env: def.env,
    });
    res.json(job);
  });

  app.get('/api/run/jobs', auth, (_req, res) => {
    res.json({ jobs: Array.from(jobStatusMap.values()) });
  });

  app.get('/api/run/jobs/:id', auth, (req, res) => {
    const job = jobStatusMap.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'job not found' });
    }
    res.json(job);
  });

  runner.on('task-started', (task) => {
    const jobId = task?.meta?.jobId;
    if (!jobId) return;
    updateJobStatus(jobId, { status: 'running', startedAt: new Date().toISOString() });
  });

  runner.on('task-finished', ({ id, code, meta }) => {
    const jobId = meta?.jobId || id;
    if (!jobId) return;
    updateJobStatus(jobId, {
      status: code === 0 ? 'ok' : 'failed',
      finishedAt: new Date().toISOString(),
    });
  });
}

function resolveSimpleCommand(cmd: string, options: { theme?: string; args?: string[] }): SimpleCommand | null {
  const { theme, args = [] } = options;
  switch ((cmd || '').toLowerCase()) {
    case 'build':
      if (!theme) return null;
      return { command: 'node', args: ['cli.js', theme, ...args] };
    case 'package':
      if (!theme) return null;
      return { command: 'node', args: ['tools/salla-cli.js', 'zip', theme, ...args] };
    case 'deploy':
      if (!theme) return null;
      return { command: 'node', args: ['tools/salla-cli.js', 'push', theme, ...args] };
    default:
      return null;
  }
}

function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
}
