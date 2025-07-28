#!/usr/bin/env tsx

import { logger, execCommand, TEST_DIR, removeDirectory, killProcess, removeUserFromHtpasswd, fileExists } from './utils';
import path from 'path';
import os from 'os';

async function restoreRegistry(): Promise<void> {
  logger.info('Restoring original npm registry...');
  execCommand('npm set registry "https://registry.npmjs.org/"');
  logger.success('Registry restored');
}

async function clearNpmAuth(): Promise<void> {
  logger.info('Clearing npm authentication tokens...');
  try {
    // Clear any auth tokens for the local registry
    execCommand('npm logout --registry http://localhost:4873', { silent: true });
  } catch {
    // Token might not exist, that's okay
  }
  
  try {
    // Remove .npmrc entries for the local registry
    execCommand('npm config delete //localhost:4873/:_authToken', { silent: true });
  } catch {
    // Config might not exist, that's okay
  }
  
  logger.success('NPM authentication cleared');
}

async function stopVerdaccio(): Promise<void> {
  logger.info('Stopping Verdaccio...');
  killProcess('verdaccio');
  logger.success('Verdaccio stopped');
}

async function cleanVerdaccioData(): Promise<void> {
  logger.info('Cleaning Verdaccio data and user storage...');
  
  // Clean up all possible Verdaccio storage locations
  const storagePaths = [
    path.join(os.homedir(), '.local/share/verdaccio'),
    path.join(os.homedir(), '.config/verdaccio'),
    path.join(os.homedir(), '.verdaccio'),
    path.join(process.cwd(), '.verdaccio'),
    path.join(process.cwd(), 'storage'),
  ];
  
  for (const storagePath of storagePaths) {
    await removeDirectory(storagePath);
  }
  
  logger.success('Verdaccio data cleaned');
}

async function cleanHtpasswdFiles(): Promise<void> {
  logger.info('Cleaning htpasswd files...');
  
  // Common htpasswd file locations
  const htpasswdPaths = [
    path.join(process.cwd(), 'htpasswd'),
    path.join(process.cwd(), './htpasswd'),
    path.join(os.homedir(), '.local/share/verdaccio/htpasswd'),
    path.join(os.homedir(), '.config/verdaccio/htpasswd'),
    path.join(os.homedir(), '.verdaccio/htpasswd'),
  ];
  
  for (const htpasswdPath of htpasswdPaths) {
    if (await fileExists(htpasswdPath)) {
      // Remove any testuser entries (including timestamped ones)
      try {
        const { promises: fs } = require('fs');
        const content = await fs.readFile(htpasswdPath, 'utf8');
        const lines = content.split('\n');
        const filteredLines = lines.filter((line: string) => {
          if (!line.trim()) return true; // Keep empty lines
          const [user] = line.split(':');
          return !user.startsWith('testuser'); // Remove any testuser* entries
        });
        
        await fs.writeFile(htpasswdPath, filteredLines.join('\n'));
        logger.info(`Cleaned htpasswd file: ${htpasswdPath}`);
      } catch (error) {
        // File might not be writable, that's okay
      }
    }
  }
  
  logger.success('Htpasswd files cleaned');
}

async function cleanTestDirectory(): Promise<void> {
  logger.info('Cleaning test directory...');
  await removeDirectory(TEST_DIR);
  logger.success('Test directory cleaned');
}

async function uninstallGlobalPackages(): Promise<void> {
  logger.info('Uninstalling global packages...');
  const globalPackages = [
    '@instant3p/cli',
    '@instant3p/core-offline',
    '@instant3p/react-offline',
    '@instant3p/electron',
    '@instant3p/storybook'
  ];
  
  for (const pkg of globalPackages) {
    try {
      execCommand(`npm uninstall -g ${pkg}`, { silent: true });
    } catch {
      // Package might not be installed, that's okay
    }
  }
  logger.success('Global packages cleaned up');
}

async function main(): Promise<void> {
  try {
    await restoreRegistry();
    await clearNpmAuth();
    await stopVerdaccio();
    await cleanVerdaccioData();
    await cleanHtpasswdFiles();
    await uninstallGlobalPackages();
    await cleanTestDirectory();
    logger.success('Cleanup completed!');
  } catch (error) {
    logger.error(`Cleanup failed: ${error}`);
    process.exit(1);
  }
}

main(); 