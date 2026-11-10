import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cardi/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: Number(process.env.PORT) || 4173,
    host: true,
    // Railway sirve detrás de un proxy en *.up.railway.app — hay que permitir
    // esos hosts o vite-preview responde 403 "Blocked request".
    allowedHosts: ['.up.railway.app', '.railway.app'],
  },
});
