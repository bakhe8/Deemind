import path from 'path';
import net from 'net';
import { spawn } from 'child_process';
import open from 'open';

let previewProcess = null;

function hashTheme(theme) {
  return theme.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

async function findPort(basePort, theme, multi) {
  if (!multi) {
    if (await isPortFree(basePort)) return basePort;
    let candidate = basePort + 1;
    for (let i = 0; i < 20; i += 1) {
      if (await isPortFree(candidate)) return candidate;
      candidate += 1;
    }
    return basePort;
  }
  const offset = hashTheme(theme) % 50;
  let candidate = basePort + offset;
  for (let i = 0; i < 50; i += 1) {
    const port = candidate + i;
    if (await isPortFree(port)) return port;
  }
  return basePort + offset;
}

export async function runPreviewServer(themeName, previewConfig = {}) {
  if (!previewConfig.enabled) return null;
  const basePort = previewConfig.port || 3000;
  const port = await findPort(basePort, themeName, previewConfig.multiTheme);

  if (previewProcess) {
    previewProcess.kill();
    previewProcess = null;
  }

  const serverPath = path.resolve('server', 'preview.js');
  const args = [serverPath, themeName, `--port=${port}`];
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
  });
  previewProcess = child;
  child.on('exit', () => {
    previewProcess = null;
  });

  const url = `http://localhost:${port}/`;
  if (previewConfig.autoOpen !== false) {
    setTimeout(() => {
      open(url).catch(() => undefined);
    }, 1500);
  }
  return { url, port };
}
