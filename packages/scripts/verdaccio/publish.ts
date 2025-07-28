#!/usr/bin/env tsx

import { logger, execCommand, updatePackageJson, getVersionSuffix } from './utils';
import path from 'path';
import { promises as fs } from 'fs';

// All packages to publish
const PACKAGES = [
  'core-offline',
  'react-offline', 
  'cli',
  'electron',
  'storybook'
];

let originalVersions: Record<string, string> = {};

async function updateVersions(): Promise<void> {
  logger.info('Updating package versions...');
  
  const versionSuffix = getVersionSuffix();
  
  for (const pkg of PACKAGES) {
    const pkgPath = `../${pkg}/package.json`;
    const pkgJson = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    originalVersions[pkg] = JSON.stringify(pkgJson, null, 2); // Store full package.json for restoration
    
    if (!pkgJson.version) {
      logger.error(`Package ${pkg} has no version in package.json`);
      throw new Error(`Missing version for package ${pkg}`);
    }
    
    const newVersion = pkgJson.version + versionSuffix;
    
    // Convert workspace:* dependencies to actual versions
    const updates: any = { version: newVersion };
    
    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      if (pkgJson[depType]) {
        const updatedDeps = { ...pkgJson[depType] };
        let hasWorkspaceDeps = false;
        
        for (const [depName, depVersion] of Object.entries(updatedDeps)) {
          if (depName.startsWith('@instant3p/') && depVersion === 'workspace:*') {
            updatedDeps[depName] = newVersion;
            hasWorkspaceDeps = true;
            logger.info(`Converting workspace dependency: ${pkg} -> ${depName}@${newVersion}`);
          }
        }
        
        if (hasWorkspaceDeps) {
          updates[depType] = updatedDeps;
        }
      }
    }
    
    await updatePackageJson(pkgPath, updates);
    logger.info(`Updated ${pkg}: ${pkgJson.version} -> ${newVersion}`);
  }
  
  logger.success(`Packages updated with suffix: ${versionSuffix}`);
}

async function restoreVersions(): Promise<void> {
  logger.info('Restoring original package versions...');
  
  for (const pkg of PACKAGES) {
    const pkgPath = `../${pkg}/package.json`;
    if (originalVersions[pkg]) {
      // Restore full package.json content
      await fs.writeFile(pkgPath, originalVersions[pkg]);
    }
  }
  
  logger.success('Original versions restored');
}

async function buildPackages(): Promise<void> {
  logger.info('Building packages...');
  
  // Clean all build artifacts first
  logger.info('Cleaning all build artifacts...');
  execCommand('npm run clean', { cwd: '../..' });
  
  // Build packages sequentially to ensure proper dependency resolution
  logger.info('Building packages in dependency order...');
  execCommand('npm run build', { cwd: '../..' });
  
  logger.success('Packages built successfully');
}

async function publishPackages(): Promise<void> {
  logger.info('Publishing packages...');
  
  for (const pkg of PACKAGES) {
    logger.info(`Publishing ${pkg}...`);
    execCommand('npm publish --force', { cwd: `../${pkg}` });
  }
  
  logger.success('Packages published to local registry');
}

async function main(): Promise<void> {
  try {
    // Build first with original versions to ensure workspace dependencies work
    await buildPackages();
    
    // Then update versions for publishing (without rebuilding)
    await updateVersions();
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