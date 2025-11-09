// @reuse-from: fs-extra, core/logger/index.ts, src/validator.js
// @description: Centralizes common helpers so new code can import instead of redefining.
export { ensureDirSync, readJsonSync as readJson, writeJsonSync as writeJson, appendFileSync } from 'fs-extra';
export { FileLogger, createLogger } from '../logger/index.js';
export { validateTheme } from '../../src/validator.js';
