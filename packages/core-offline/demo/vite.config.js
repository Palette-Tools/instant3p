import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true
  },
  define: {
    // Define globals for compatibility
    global: 'globalThis',
  },
  build: {
    target: 'es2020',
    // Ensure proper bundling for modern browsers
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
}); 