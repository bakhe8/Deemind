import { app, BrowserWindow, dialog } from 'electron';
import { spawnSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const dashboardDir = path.join(rootDir, 'dashboard');
let serviceProcess = null;

function buildDashboardIfNeeded() {
  const distIndex = path.join(dashboardDir, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) return;
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: dashboardDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error('Dashboard build failed');
  }
}

function startService() {
  serviceProcess = spawn('npm', ['run', 'service:start'], {
    cwd: rootDir,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  });
  win.loadFile(path.join(dashboardDir, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  try {
    buildDashboardIfNeeded();
    startService();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Deemind Desktop', `Failed to start: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serviceProcess) {
    serviceProcess.kill();
  }
});
