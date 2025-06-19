#!/usr/bin/env tsx

import { logger, execCommand, updatePackageJson, getVersionSuffix } from './utils';
import path from 'path';

let originalVersions: { electron: string; cli: string } = { electron: '', cli: '' };

async function updateVersions(): Promise<void> {
  logger.info('Updating package versions...');
  
  const versionSuffix = getVersionSuffix();
  
  // Update electron package version
  const electronPkg = JSON.parse(await import('fs').then(fs => fs.promises.readFile('../electron/package.json', 'utf8')));
  originalVersions.electron = electronPkg.version;
  const electronNewVersion = electronPkg.version + versionSuffix;
  await updatePackageJson('../electron/package.json', { version: electronNewVersion });
  
  // Update CLI package version
  const cliPkg = JSON.parse(await import('fs').then(fs => fs.promises.readFile('../cli/package.json', 'utf8')));
  originalVersions.cli = cliPkg.version;
  const cliNewVersion = cliPkg.version + versionSuffix;
  await updatePackageJson('../cli/package.json', { version: cliNewVersion });
  
  logger.success(`Packages updated with suffix: ${versionSuffix}`);
}

async function restoreVersions(): Promise<void> {
  logger.info('Restoring original package versions...');
  
  // Restore electron package version
  await updatePackageJson('../electron/package.json', { version: originalVersions.electron });
  
  // Restore CLI package version
  await updatePackageJson('../cli/package.json', { version: originalVersions.cli });
  
  logger.success('Original versions restored');
}

async function buildPackages(): Promise<void> {
  logger.info('Building packages...');
  
  // Build electron package
  execCommand('npm run build', { cwd: '../electron' });
  
  // Build CLI package
  execCommand('npm run build', { cwd: '../cli' });
  
  logger.success('Packages built successfully');
}

async function publishPackages(): Promise<void> {
  logger.info('Publishing packages...');
  
  // Publish electron package (with force to allow overwrites)
  execCommand('npm publish --force', { cwd: '../electron' });
  
  // Publish CLI package (with force to allow overwrites)
  execCommand('npm publish --force', { cwd: '../cli' });
  
  logger.success('Packages published to local registry');
}

async function main(): Promise<void> {
  try {
    await updateVersions();
    await buildPackages();
    await publishPackages();
    await restoreVersions();
    logger.success('Publish process completed!');
  } catch (error) {
    logger.error(`Publish failed: ${error}`);
    // Still try to restore versions even if publish failed
    try {
      await restoreVersions();
    } catch (restoreError) {
      logger.warn('Failed to restore versions after error');
    }
    process.exit(1);
  }
}

main(); 