import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // During development, requests to /api/... are forwarded to the backend.
    // The browser thinks it is talking to one server, so no CORS trouble.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
