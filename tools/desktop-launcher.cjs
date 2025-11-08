require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
const appPath = path.resolve(__dirname, '..');

const child = spawn(electronPath, ['.'], {
  cwd: appPath,
  stdio: 'inherit',
  env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
