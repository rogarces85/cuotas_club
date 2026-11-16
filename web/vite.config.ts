import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
    watch: {
      // En Windows, escribir un archivo de forma atómica (editor o agente) crea
      // una carpeta temporal .tmpdir que el watcher intenta abrir y falla con
      // EBUSY, matando el servidor de desarrollo. Se ignoran esos temporales.
      ignored: ['**/*.tmpdir/**', '**/*.tmp', '**/node_modules/**'],
    },
  },
});
