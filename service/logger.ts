import fs from 'fs-extra';
import path from 'path';

export class ServiceLogger {
  private logFile: string;

  constructor(private root: string) {
    const logDir = path.join(root, 'logs');
    fs.ensureDirSync(logDir);
    this.logFile = path.join(logDir, 'service.log');
  }

  write(line: string) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${line}\n`;
    fs.appendFileSync(this.logFile, entry);
    console.log(entry.trim());
  }
}
