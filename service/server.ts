import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { TaskRunner } from './task-runner.js';
import { makeAuthMiddleware } from './security.js';
import { ServiceLogger } from './logger.js';

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
  const logger = new ServiceLogger(config.root || process.cwd());
  const runner = new TaskRunner();
  const token = config.token || process.env.DEEMIND_SERVICE_TOKEN || '';
  const auth = makeAuthMiddleware(token);

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

  app.get('/api/reports', auth, async (_req, res) => {
    const reportsDir = path.join(config.root || process.cwd(), config.reportsDir || 'reports');
    if (!(await fs.pathExists(reportsDir))) {
      return res.json([]);
    }
    const entries = await fs.readdir(reportsDir);
    res.json(entries);
  });

  app.get('/api/outputs', auth, async (_req, res) => {
    const outputDir = path.join(config.root || process.cwd(), config.outputDir || 'output');
    if (!(await fs.pathExists(outputDir))) {
      return res.json([]);
    }
    const entries = await fs.readdir(outputDir);
    res.json(entries);
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

  const port = config.port || 5757;
  app.listen(port, () => logger.write(`Service listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
