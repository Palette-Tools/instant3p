import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

export const REGISTRY_URL = 'http://localhost:4873';
export const TEST_DIR = join(process.env.HOME || '/tmp', 'tmp/instant3p-user-test');

export const logger = {
  info: (msg: string) => console.log(chalk.blue('[INFO]'), msg),
  success: (msg: string) => console.log(chalk.green('[SUCCESS]'), msg),
  warn: (msg: string) => console.log(chalk.yellow('[WARN]'), msg),
  error: (msg: string) => console.log(chalk.red('[ERROR]'), msg),
};

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function execCommand(command: string, options: { cwd?: string; silent?: boolean } = {}): string {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd || process.cwd(),
    });
    return result;
  } catch (error) {
    logger.error(`Command failed: ${command}`);
    throw error;
  }
}

export async function waitForService(url: string, maxAttempts: number = 20): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Service not ready yet
    }
    await sleep(1000);
  }
  return false;
}

export function killProcess(name: string): void {
  try {
    execCommand(`pkill -f ${name}`, { silent: true });
  } catch {
    // Process might not exist, that's okay
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function removeDirectory(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch {
    // Directory might not exist, that's okay
  }
}

export async function updatePackageJson(path: string, updates: Record<string, any>): Promise<void> {
  const content = await fs.readFile(path, 'utf8');
  const pkg = JSON.parse(content);
  
  Object.assign(pkg, updates);
  
  await fs.writeFile(path, JSON.stringify(pkg, null, 2));
}

export function getVersionSuffix(): string {
  return `-test.${Date.now()}`;
}

export async function removeUserFromHtpasswd(htpasswdPath: string, username: string): Promise<void> {
  try {
    if (!await fileExists(htpasswdPath)) {
      return; // File doesn't exist, nothing to do
    }
    
    const content = await fs.readFile(htpasswdPath, 'utf8');
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      if (!line.trim()) return true; // Keep empty lines
      const [user] = line.split(':');
      return user !== username;
    });
    
    await fs.writeFile(htpasswdPath, filteredLines.join('\n'));
  } catch (error) {
    // File might not exist or be readable, that's okay
  }
} 