import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const workspaceRoot = path.resolve(__dirname, '..');

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@contracts': path.resolve(workspaceRoot, 'core/contracts')
    }
  },
  server: {
    port: Number(process.env.DASHBOARD_PORT || process.env.npm_package_config_dashboard_port || 5758),
    strictPort: true,
    host: 'localhost',
    fs: {
      allow: [workspaceRoot]
    }
  },
  define: {
    __SERVICE_URL__: JSON.stringify(process.env.VITE_SERVICE_URL || 'http://localhost:5757')
  }
});
