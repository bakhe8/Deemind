import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: Number(process.env.DASHBOARD_PORT || process.env.npm_package_config_dashboard_port || 5758),
    strictPort: true,
    host: 'localhost'
  },
  define: {
    __SERVICE_URL__: JSON.stringify(process.env.VITE_SERVICE_URL || 'http://localhost:5757')
  }
});
