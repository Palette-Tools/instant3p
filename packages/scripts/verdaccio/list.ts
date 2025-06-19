#!/usr/bin/env tsx

import { logger, REGISTRY_URL, execCommand } from './utils';

async function checkRegistryConnection(): Promise<void> {
  try {
    const response = await fetch(REGISTRY_URL);
    if (!response.ok) {
      throw new Error(`Registry not accessible: ${response.status}`);
    }
  } catch (error) {
    logger.error(`Cannot connect to registry at ${REGISTRY_URL}`);
    logger.info('Make sure Verdaccio is running with: npm run verdaccio:start');
    throw error;
  }
}

async function listPackages(): Promise<void> {
  logger.info(`Listing all packages from registry: ${REGISTRY_URL}`);
  
  try {
    // Use npm search to list all packages from the local registry
    const result = execCommand(`npm search --registry ${REGISTRY_URL} --json`, { silent: true });
    
    if (!result.trim()) {
      logger.info('No packages found in the registry');
      return;
    }
    
    const packages = JSON.parse(result);
    
    if (!Array.isArray(packages) || packages.length === 0) {
      logger.info('No packages found in the registry');
      return;
    }
    
    logger.success(`Found ${packages.length} package(s) in the registry:`);
    console.log('\n📦 Available packages:\n');
    
    packages.forEach((pkg, index) => {
      console.log(`${index + 1}. ${pkg.name}`);
      if (pkg.version) {
        console.log(`   Version: ${pkg.version}`);
      }
      if (pkg.description) {
        console.log(`   Description: ${pkg.description}`);
      }
      if (pkg.author) {
        console.log(`   Author: ${typeof pkg.author === 'string' ? pkg.author : pkg.author.name}`);
      }
      console.log('');
    });
    
  } catch (error) {
    // Fallback: try to get package list via registry API
    logger.warn('npm search failed, trying registry API...');
    
    try {
      const response = await fetch(`${REGISTRY_URL}/-/all`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      const packageNames = Object.keys(data).filter(name => !name.startsWith('_'));
      
      if (packageNames.length === 0) {
        logger.info('No packages found in the registry');
        return;
      }
      
      logger.success(`Found ${packageNames.length} package(s) in the registry:`);
      console.log('\n📦 Available packages:\n');
      
      packageNames.forEach((name, index) => {
        const pkg = data[name];
        console.log(`${index + 1}. ${name}`);
        if (pkg['dist-tags'] && pkg['dist-tags'].latest) {
          console.log(`   Latest version: ${pkg['dist-tags'].latest}`);
        }
        if (pkg.description) {
          console.log(`   Description: ${pkg.description}`);
        }
        console.log('');
      });
      
    } catch (apiError) {
      logger.error('Failed to retrieve package list from registry');
      throw apiError;
    }
  }
}

async function main(): Promise<void> {
  try {
    await checkRegistryConnection();
    await listPackages();
  } catch (error) {
    logger.error(`Failed to list packages: ${error}`);
    process.exit(1);
  }
}

main(); 