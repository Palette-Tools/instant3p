#!/usr/bin/env node

import { execSync } from 'child_process';
import { platform } from 'process';

console.log('🧹 Starting cross-platform node_modules cleanup...');

try {
  if (platform === 'win32') {
    console.log('🪟 Windows detected - Using PowerShell nuke script');
    execSync('powershell.exe -ExecutionPolicy Bypass -File ./packages/scripts/nuke.ps1', { 
      stdio: 'inherit' 
    });
  } else {
    console.log(`🐧 ${platform} detected - Using rimraf`);
    execSync('npx rimraf "**/node_modules"', { 
      stdio: 'inherit' 
    });
  }
  
  console.log('✅ Cleanup completed successfully!');
} catch (error) {
  console.error('❌ Cleanup failed:', error.message);
  process.exit(1);
} 