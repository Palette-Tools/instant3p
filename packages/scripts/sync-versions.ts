#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './verdaccio/utils';

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

async function readPackageJson(path: string): Promise<PackageJson> {
  const content = await fs.readFile(path, 'utf8');
  return JSON.parse(content);
}

async function updateVersionOnly(path: string, newVersion: string): Promise<void> {
  const content = await fs.readFile(path, 'utf8');
  const pkg = JSON.parse(content);
  
  // Only update if version actually changed
  if (pkg.version === newVersion) return;
  
  // Replace only the version field while preserving formatting
  const versionRegex = /("version":\s*")[^"]*(")/;
  const updatedContent = content.replace(versionRegex, `$1${newVersion}$2`);
  
  await fs.writeFile(path, updatedContent);
}

async function updateDependencyOnly(path: string, depName: string, newVersion: string): Promise<void> {
  const content = await fs.readFile(path, 'utf8');
  
  // Create regex to find the specific dependency in any dependency section
  const depRegex = new RegExp(`("${depName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":\\s*")[^"]*(")`);
  
  if (depRegex.test(content)) {
    const updatedContent = content.replace(depRegex, `$1${newVersion}$2`);
    await fs.writeFile(path, updatedContent);
  }
}

async function writePackageJson(path: string, pkg: PackageJson): Promise<void> {
  await fs.writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
}

async function getInstantVersions(): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  // Go up two levels from packages/scripts to monorepo root
  const instantPackagesDir = join(process.cwd(), '../../instant/client/packages');
  
  try {
    const packages = await fs.readdir(instantPackagesDir);
    
    for (const packageName of packages) {
      const packageJsonPath = join(instantPackagesDir, packageName, 'package.json');
      try {
        const pkg = await readPackageJson(packageJsonPath);
        if (pkg.name.startsWith('@instantdb/')) {
          // Keep the original version format (with 'v' if present) for @instantdb dependencies
          // since that's how they're published
          versions[pkg.name] = pkg.version;
        }
      } catch (error) {
        // Skip if package.json doesn't exist or can't be read
      }
    }
  } catch (error) {
    logger.error('Could not read instant packages directory');
    throw error;
  }
  
  return versions;
}

async function updatePackageDependencies(packagePath: string, instantVersions: Record<string, string>): Promise<boolean> {
  const pkg = await readPackageJson(packagePath);
  let updated = false;
  
  // Update dependencies, devDependencies, and peerDependencies
  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    if (pkg[depType]) {
      for (const [depName, currentVersion] of Object.entries(pkg[depType]!)) {
        if (instantVersions[depName] && currentVersion !== instantVersions[depName]) {
          logger.info(`Updating ${pkg.name}: ${depName} ${currentVersion} → ${instantVersions[depName]}`);
          await updateDependencyOnly(packagePath, depName, instantVersions[depName]);
          updated = true;
        }
      }
    }
  }
  
  return updated;
}

async function getUniversalVersion(): Promise<string> {
  // Get the version from InstantDB core package as our universal version
  const instantCorePackagePath = join(process.cwd(), '../../instant/client/packages/core/package.json');
  try {
    const pkg = await readPackageJson(instantCorePackagePath);
    // Strip 'v' prefix if present to get proper semver format
    return pkg.version.startsWith('v') ? pkg.version.substring(1) : pkg.version;
  } catch (error) {
    logger.error('Could not read InstantDB core package version');
    throw error;
  }
}

async function updatePackageVersion(packagePath: string, universalVersion: string): Promise<boolean> {
  const pkg = await readPackageJson(packagePath);
  
  if (pkg.name.startsWith('@instant3p/') && pkg.version !== universalVersion) {
    logger.info(`Updating ${pkg.name} version: ${pkg.version} → ${universalVersion}`);
    await updateVersionOnly(packagePath, universalVersion);
    return true;
  }
  
  return false;
}

async function updateInternalDependencies(packagePath: string, universalVersion: string): Promise<boolean> {
  const pkg = await readPackageJson(packagePath);
  let updated = false;
  
  // Update dependencies, devDependencies, and peerDependencies for @instant3p packages
  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    if (pkg[depType]) {
      for (const [depName, currentVersion] of Object.entries(pkg[depType]!)) {
        if (depName.startsWith('@instant3p/')) {
          // Always preserve workspace:* dependencies - package manager resolves them during publish
          if (currentVersion === 'workspace:*') {
            logger.info(`Preserving workspace dependency: ${pkg.name}: ${depName}@${currentVersion}`);
            continue;
          }
          
          // Only update non-workspace dependencies that have version mismatches
          if (currentVersion !== universalVersion) {
            logger.info(`Updating ${pkg.name}: ${depName} ${currentVersion} → ${universalVersion}`);
            await updateDependencyOnly(packagePath, depName, universalVersion);
            updated = true;
          }
        }
      }
    }
  }
  
  return updated;
}

async function updateVersionFile(versionFilePath: string, universalVersion: string): Promise<boolean> {
  try {
    const content = await fs.readFile(versionFilePath, 'utf8');
    
    // Extract current version from the file
    const versionMatch = content.match(/const version = '([^']+)';/);
    if (!versionMatch) {
      logger.warn(`Could not find version in ${versionFilePath}`);
      return false;
    }
    
    const currentVersion = versionMatch[1];
    const newVersion = `v${universalVersion}`;
    
    if (currentVersion !== newVersion) {
      logger.info(`Updating version.js: ${currentVersion} → ${newVersion}`);
      
      // Replace the version while preserving the rest of the file
      const updatedContent = content.replace(
        /const version = '[^']+';/,
        `const version = '${newVersion}';`
      );
      
      await fs.writeFile(versionFilePath, updatedContent);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.warn(`Could not update version file ${versionFilePath}: ${error}`);
    return false;
  }
}

async function main(): Promise<void> {
  try {
    // Check for command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
Usage: tsx sync-versions.ts

Syncs package versions and dependencies:
  - Updates @instantdb dependencies to match the instant submodule versions
  - Updates @instant3p package versions to match InstantDB core version  
  - Preserves workspace:* dependencies (package manager resolves them during publish)

Options:
  --help, -h            Show this help message
      `);
      return;
    }
    
    logger.info('Reading versions from instant submodule...');
    const instantVersions = await getInstantVersions();
    
    if (Object.keys(instantVersions).length === 0) {
      logger.warn('No @instantdb packages found in submodule');
      return;
    }
    
    logger.info(`Found InstantDB versions: ${JSON.stringify(instantVersions, null, 2)}`);
    
    // Get universal version for our packages
    const universalVersion = await getUniversalVersion();
    logger.info(`Using universal version for @instant3p packages: ${universalVersion}`);
    
    // Update our packages  
    const packagesDir = join(process.cwd(), '../../packages');
    const packages = await fs.readdir(packagesDir);
    
    let totalUpdated = 0;
    
    for (const packageName of packages) {
      if (packageName === 'scripts') continue; // Skip scripts package
      
      const packageJsonPath = join(packagesDir, packageName, 'package.json');
      try {
        // Update package version to universal version
        const versionUpdated = await updatePackageVersion(packageJsonPath, universalVersion);
        
        // Update @instantdb dependencies to match submodule
        const instantDepsUpdated = await updatePackageDependencies(packageJsonPath, instantVersions);
        
        // Update internal @instant3p dependencies to use universal version
        const internalDepsUpdated = await updateInternalDependencies(packageJsonPath, universalVersion);
        
        if (versionUpdated || instantDepsUpdated || internalDepsUpdated) {
          totalUpdated++;
        }
      } catch (error) {
        logger.warn(`Could not update ${packageName}: ${error}`);
      }
    }
    
    // Update CLI version file
    const versionFilePath = join(packagesDir, 'cli', 'src', 'version.js');
    const versionFileUpdated = await updateVersionFile(versionFilePath, universalVersion);
    if (versionFileUpdated) {
      totalUpdated++;
    }
    
    if (totalUpdated > 0) {
      logger.success(`Updated ${totalUpdated} packages with universal versioning`);
    } else {
      logger.info('All packages already have matching versions');
    }
    
  } catch (error) {
    logger.error(`Version sync failed: ${error}`);
    process.exit(1);
  }
}

main(); 