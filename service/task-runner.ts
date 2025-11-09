import { spawn } from 'child_process';
import EventEmitter from 'events';

export type TaskRequest = {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  meta?: Record<string, any>;
  env?: Record<string, string>;
};

export type TaskHistoryEntry = {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  meta?: Record<string, any>;
  startedAt?: string;
  finishedAt?: string;
  code?: number | null;
};

export class TaskRunner extends EventEmitter {
  private queue: TaskRequest[] = [];
  private current: TaskRequest | null = null;
  private history: TaskHistoryEntry[] = [];
  private historyLimit = 30;
  private historyMap = new Map<string, TaskHistoryEntry>();

  enqueue(task: TaskRequest) {
    this.queue.push(task);
    this.tryStartNext();
  }

  getCurrent() {
    return this.current;
  }

  getQueue() {
    return [...this.queue];
  }

  getHistory() {
    return [...this.history];
  }

  getHistoryEntry(id: string) {
    return this.historyMap.get(id) || null;
  }

  private recordHistory(entry: TaskHistoryEntry) {
    this.history.push(entry);
    this.historyMap.set(entry.id, entry);
    if (this.history.length > this.historyLimit) {
      const removed = this.history.shift();
      if (removed) {
        this.historyMap.delete(removed.id);
      }
    }
  }

  private tryStartNext() {
    if (this.current || this.queue.length === 0) return;
    this.current = this.queue.shift() || null;
    if (!this.current) return;

    const startedAt = new Date().toISOString();
    this.recordHistory({
      id: this.current.id,
      label: this.current.label,
      command: this.current.command,
      args: this.current.args,
      cwd: this.current.cwd,
      meta: this.current.meta,
      startedAt,
      code: null,
    });

    const child = spawn(this.current.command, this.current.args, {
      cwd: this.current.cwd,
      shell: process.platform === 'win32',
      env: this.current.env ? { ...process.env, ...this.current.env } : process.env,
    });

    child.stdout.on('data', (chunk) => this.emit('log', chunk.toString()));
    child.stderr.on('data', (chunk) => this.emit('log', chunk.toString()));

    const currentTask = this.current;
    child.on('close', (code) => {
      const entry = currentTask ? this.historyMap.get(currentTask.id) : null;
      if (entry) {
        entry.code = typeof code === 'number' ? code : null;
        entry.finishedAt = new Date().toISOString();
      }
      this.emit('task-finished', {
        id: currentTask?.id,
        code,
        meta: currentTask?.meta,
        label: currentTask?.label,
      });
      this.current = null;
      this.tryStartNext();
    });

    this.emit('task-started', { ...this.current, startedAt });
  }
}
