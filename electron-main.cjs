const dotenv = require('dotenv');
dotenv.config();

const electron = require('electron');
const electronApi = electron?.app ? electron : electron?.default || electron;
if (!electronApi || !electronApi.app) {
  throw new Error("Electron API unavailable. Ensure 'electron' is installed and run via npm run desktop:start.");
}
const { app, BrowserWindow, dialog } = electronApi;
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');

const rootDir = __dirname;
const dashboardDir = path.join(rootDir, 'dashboard');
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || '5758';
const SERVICE_PORT = process.env.SERVICE_PORT || '5757';
const DASHBOARD_MODE = process.env.DESKTOP_DASHBOARD_MODE || 'dev';
const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;
const SERVICE_STATUS_URL = `http://localhost:${SERVICE_PORT}/api/status`;

let serviceProcess = null;
let dashboardProcess = null;

function waitForUrl(targetUrl, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const req = http.get(targetUrl, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${targetUrl}`));
        } else {
          setTimeout(attempt, 1500);
        }
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for ${targetUrl}`));
        } else {
          setTimeout(attempt, 1500);
        }
      });
    };
    attempt();
  });
}

function buildDashboardIfNeeded() {
  const distIndex = path.join(dashboardDir, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) return;
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: dashboardDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error('Dashboard build failed');
}

function startService() {
  if (serviceProcess) return;
  serviceProcess = spawn('npm', ['run', 'service:start'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function startDashboardDev() {
  if (dashboardProcess || DASHBOARD_MODE === 'dist') return;
  dashboardProcess = spawn('npm', ['run', 'dev'], {
    cwd: dashboardDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DASHBOARD_PORT,
      VITE_SERVICE_URL: SERVICE_STATUS_URL.replace('/api/status', ''),
    },
  });
}

function createWindow() {
  const win = new BrowserWindow({ width: 1280, height: 800 });
  if (DASHBOARD_MODE === 'dist') {
    win.loadFile(path.join(dashboardDir, 'dist', 'index.html'));
  } else {
    win.loadURL(DASHBOARD_URL);
  }
}

app.whenReady().then(async () => {
  try {
    startService();
    await waitForUrl(SERVICE_STATUS_URL, Number(process.env.SERVICE_WAIT_TIMEOUT || 30000));

    if (DASHBOARD_MODE === 'dist') {
      buildDashboardIfNeeded();
    } else {
      startDashboardDev();
      await waitForUrl(DASHBOARD_URL, Number(process.env.DASHBOARD_WAIT_TIMEOUT || 30000));
    }

    createWindow();
  } catch (err) {
    dialog.showErrorBox('Deemind Desktop', err.message || String(err));
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serviceProcess) serviceProcess.kill();
  if (dashboardProcess) dashboardProcess.kill();
});
