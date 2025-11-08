import { spawn } from 'child_process';
import EventEmitter from 'events';

export type TaskRequest = {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
};

export class TaskRunner extends EventEmitter {
  private queue: TaskRequest[] = [];
  private current: TaskRequest | null = null;

  enqueue(task: TaskRequest) {
    this.queue.push(task);
    this.tryStartNext();
  }

  getCurrent() {
    return this.current;
  }

  getQueue() {
    return this.queue;
  }

  private tryStartNext() {
    if (this.current || this.queue.length === 0) return;
    this.current = this.queue.shift() || null;
    if (!this.current) return;

    const child = spawn(this.current.command, this.current.args, {
      cwd: this.current.cwd,
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.stdout.on('data', (chunk) => this.emit('log', chunk.toString()));
    child.stderr.on('data', (chunk) => this.emit('log', chunk.toString()));

    child.on('close', (code) => {
      this.emit('task-finished', {
        id: this.current?.id,
        code,
      });
      this.current = null;
      this.tryStartNext();
    });

    this.emit('task-started', this.current);
  }
}
