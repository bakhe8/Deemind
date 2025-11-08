import express from 'express';
import cors, { CorsOptions } from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { TaskRunner } from './task-runner.js';
import { makeAuthMiddleware } from './security.js';
import { ServiceLogger } from './logger.js';

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), 'service', 'config.json');

async function loadConfig() {
  if (!(await fs.pathExists(CONFIG_PATH))) {
    throw new Error(`Missing service/config.json`);
  }
  return fs.readJson(CONFIG_PATH);
}

async function main() {
  const config = await loadConfig();
  const app = express();
  const rootDir = process.env.DEEMIND_ROOT || config.root || process.cwd();
  const logger = new ServiceLogger(rootDir);
  const runner = new TaskRunner();
  const token = process.env.DEEMIND_SERVICE_TOKEN || config.token || '';
  const auth = makeAuthMiddleware(token);

  const allowedOriginsEnv = process.env.DASHBOARD_ORIGIN
    ? process.env.DASHBOARD_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : undefined;
  const configuredOrigins = allowedOriginsEnv || config.allowedOrigins;

  const corsOptions: CorsOptions = {
    origin: (_origin, callback) => {
      if (!configuredOrigins || configuredOrigins === '*' || configuredOrigins === '*') {
        return callback(null, true);
      }
      const list = Array.isArray(configuredOrigins) ? configuredOrigins : [configuredOrigins];
      if (!_origin || list.includes(_origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Deemind-Token'],
  };
  app.use(cors(corsOptions));
  app.use(express.json());

  runner.on('task-started', (task) => logger.write(`Task started: ${task?.label}`));
  runner.on('task-finished', ({ id, code }) => logger.write(`Task finished: ${id} exit=${code}`));
  runner.on('log', (line) => logger.write(line.trim()));

  app.post('/api/run', auth, (req, res) => {
    const { task = 'build-all' } = req.body || {};
    const def = config.tasks?.[task];
    if (!def) {
      return res.status(400).json({ error: `Unknown task: ${task}` });
    }
    const id = uuid();
    runner.enqueue({
      id,
      label: task,
      command: def.command,
      args: def.args || [],
      cwd: config.root || process.cwd(),
    });
    res.json({ enqueued: true, id });
  });

  app.get('/api/status', auth, (_req, res) => {
    res.json({
      current: runner.getCurrent(),
      queue: runner.getQueue(),
    });
  });

  const reportsDir = path.join(rootDir, config.reportsDir || 'reports');
  const outputDir = path.join(rootDir, config.outputDir || 'output');

  app.get('/api/reports', auth, async (_req, res) => {
    if (!(await fs.pathExists(reportsDir))) {
      return res.json([]);
    }
    const entries = await fs.readdir(reportsDir);
    const detailed = await Promise.all(
      entries.map(async (name) => {
        const full = path.join(reportsDir, name);
        const stat = await fs.stat(full);
        if (!stat.isFile()) return null;
        return {
          name,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          url: `/reports/${encodeURIComponent(name)}`,
        };
      }),
    );
    res.json(detailed.filter(Boolean).sort((a, b) => (a!.name < b!.name ? 1 : -1)));
  });

  app.get('/api/outputs', auth, async (_req, res) => {
    if (!(await fs.pathExists(outputDir))) {
      return res.json([]);
    }
    const entries = await fs.readdir(outputDir);
    const detailed = await Promise.all(
      entries.map(async (name) => {
        const full = path.join(outputDir, name);
        const stat = await fs.stat(full);
        const isDir = stat.isDirectory();
        const encoded = encodeURIComponent(name);
        const manifestPath = path.join(full, 'manifest.json');
        const reportPath = path.join(full, 'report-extended.json');
        const manifestExists = isDir && (await fs.pathExists(manifestPath));
        const reportExists = isDir && (await fs.pathExists(reportPath));
        return {
          name,
          type: isDir ? 'theme' : 'file',
          size: stat.size,
          modified: stat.mtime.toISOString(),
          manifestUrl: manifestExists ? `/output/${encoded}/manifest.json` : null,
          reportUrl: reportExists ? `/output/${encoded}/report-extended.json` : null,
          browseUrl: isDir ? `/output/${encoded}` : `/output/${encoded}`,
        };
      }),
    );
    res.json(detailed.filter(Boolean).sort((a, b) => (a!.modified < b!.modified ? 1 : -1)));
  });

  app.get('/api/log/history', auth, async (_req, res) => {
    const lines = await logger.tail(200);
    res.json(lines);
  });

  app.get('/api/log/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const listener = (line: string) => {
      res.write(`data: ${line}\n\n`);
    };
    runner.on('log', listener);

    req.on('close', () => {
      runner.off('log', listener);
    });
  });

  app.use('/reports', auth, express.static(reportsDir));
  app.use('/output', auth, express.static(outputDir));

  const port = Number(process.env.SERVICE_PORT || config.port || 5757);
  app.listen(port, () => logger.write(`Service listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
