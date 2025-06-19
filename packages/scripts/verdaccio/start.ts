#!/usr/bin/env tsx

import { logger, REGISTRY_URL, execCommand, waitForService, killProcess, removeDirectory } from './utils';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

async function installVerdaccio(): Promise<void> {
  try {
    execCommand('verdaccio --version', { silent: true });
    logger.info('Verdaccio already installed');
  } catch {
    logger.info('Installing Verdaccio...');
    execCommand('npm install -g verdaccio');
    logger.success('Verdaccio installed');
  }
}

async function startVerdaccio(): Promise<void> {
  logger.info('Starting fresh Verdaccio instance...');
  
  // Kill any existing Verdaccio
  killProcess('verdaccio');
  
  // Clean up all Verdaccio storage (start completely fresh)
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
  
  // Start Verdaccio in background
  const verdaccioProcess = spawn('verdaccio', ['--listen', REGISTRY_URL], {
    detached: true,
    stdio: 'ignore',
  });
  
  verdaccioProcess.unref();
  
  // Wait for it to start
  const started = await waitForService(REGISTRY_URL);
  
  if (!started) {
    logger.error('Failed to start Verdaccio');
    process.exit(1);
  }
  
  logger.success(`Verdaccio started at ${REGISTRY_URL}`);
}

async function setupAuth(): Promise<void> {
  logger.info('Setting up npm authentication...');
  
  // Switch to local registry
  execCommand(`npm set registry "${REGISTRY_URL}"`);
  
  // Clear any existing auth tokens for this registry
  try {
    execCommand('npm logout', { silent: true });
    execCommand('npm config delete //localhost:4873/:_authToken', { silent: true });
  } catch {
    // Auth might not exist, that's okay
  }
  
  // Generate unique username to avoid conflicts
  const timestamp = Date.now();
  const username = `testuser${timestamp}`;
  const password = 'testpass';
  const email = 'test@example.com';
  
  logger.info(`Creating npm user "${username}"...`);
  
  try {
    execCommand(`npx npm-cli-adduser --username ${username} --password ${password} --email ${email} --registry "${REGISTRY_URL}"`);
    logger.success(`Authentication configured for user: ${username}`);
  } catch (error) {
    // If automated login fails, try manual approach
    logger.warn('Automated login failed, trying alternative approach...');
    
    try {
      // Alternative: use npm adduser command directly
      execCommand(`echo -e "${username}\\n${password}\\n${email}" | npm adduser --registry ${REGISTRY_URL}`, { silent: true });
      logger.success(`Authentication configured via alternative method for user: ${username}`);
    } catch (altError) {
      logger.warn('All automated login attempts failed. Please run manually:');
      console.log(`npm adduser --registry ${REGISTRY_URL}`);
      console.log(`Username: ${username}, Password: ${password}, Email: ${email}`);
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  try {
    await installVerdaccio();
    await startVerdaccio();
    await setupAuth();
    logger.success('Verdaccio setup complete!');
  } catch (error) {
    logger.error(`Setup failed: ${error}`);
    process.exit(1);
  }
}

main(); 