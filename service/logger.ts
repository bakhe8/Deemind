import path from 'path';
import { FileLogger } from '../core/logger/index.js';

export class ServiceLogger extends FileLogger {
  constructor(root: string) {
    super(path.join(root, 'logs', 'service.log'));
  }
}
