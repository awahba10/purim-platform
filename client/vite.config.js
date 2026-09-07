import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local dev the React app runs on :5173 and proxies API calls to the
// Express server on :3001. In production the Express server serves the built
// files directly, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
