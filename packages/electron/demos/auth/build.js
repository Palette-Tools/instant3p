import esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const APP_ID = process.env.INSTANT_APP_ID;

if (!APP_ID) {
  console.error('❌ INSTANT_APP_ID is required in .env file');
  process.exit(1);
}

console.log('📦 Building renderer with APP_ID...');

// Ensure dist directory exists
mkdirSync('dist', { recursive: true });
mkdirSync('dist/renderer', { recursive: true });

// Build JS bundle to the same directory as HTML
esbuild.build({
      entryPoints: ['src/renderer-sign-in.ts'],
    bundle: true,
    outfile: 'dist/src/renderer.bundle.js',
  format: 'esm',
  external: ['electron'],
  define: {
    'process.env.INSTANT_APP_ID': `"${APP_ID}"`
  }
}).then(() => {
  // Copy HTML file
  copyFileSync('src/renderer.html', 'dist/src/renderer.html');
  console.log('✅ Build complete');
}).catch(() => {
  console.error('❌ Build failed');
  process.exit(1);
}); 