import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5758
  },
  define: {
    __SERVICE_URL__: JSON.stringify(process.env.VITE_SERVICE_URL || 'http://localhost:5757')
  }
});
