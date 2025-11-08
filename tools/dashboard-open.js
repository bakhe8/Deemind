#!/usr/bin/env node
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const file = path.resolve('reports', 'dashboard', 'index.html');
const url = pathToFileURL(file).href;
console.log(`📊 Deemind dashboard: ${url}`);

try {
  if (process.platform === 'win32') {
    execSync(`start "" "${file}"`, { stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    execSync(`open "${file}"`, { stdio: 'ignore' });
  } else {
    execSync(`xdg-open "${file}"`, { stdio: 'ignore' });
  }
  console.log('✅ Dashboard opened in your default browser.');
} catch (error) {
  console.warn('⚠️ Auto-open failed. Please open the path above manually.');
}
