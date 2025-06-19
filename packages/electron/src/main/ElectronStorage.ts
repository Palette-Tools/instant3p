import { Level } from 'level';
import { app } from 'electron';
import path from 'path';

export default class ElectronStorage {
  private db: Level<string, string>;
  private dbName: string;
  private initPromise: Promise<void>;

  constructor(dbName: string, storagePath?: string) {
    this.dbName = dbName;
    
    // Use provided storage path or default to userData directory
    const basePath = storagePath || app.getPath('userData');
    const dbPath = path.join(basePath, 'instantdb', dbName);
    
    this.db = new Level(dbPath, { valueEncoding: 'utf8' });
    this.initPromise = this.db.open();
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }

  async getItem(key: string): Promise<string | null> {
    await this.ensureReady();
    
    try {
      const value = await this.db.get(key);
      
      // Handle edge cases that can cause JSON parsing issues
      if (value === null || value === undefined || value === 'undefined' || value === 'null') {
        return null;
      }
      
      return value;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.ensureReady();
    
    try {
      // Prevent storing invalid values that would cause JSON parsing issues
      if (value === null || value === undefined || typeof value !== 'string') {
        return;
      }
      
      // Don't store the literal string "undefined" or "null"
      if (value === 'undefined' || value === 'null') {
        await this.removeItem(key);
        return;
      }
      
      await this.db.put(key, value);
    } catch (error) {
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    await this.ensureReady();
    
    try {
      await this.db.del(key);
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return;
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.ensureReady();
    
    try {
      await this.db.clear();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      // Silently ignore close errors
    }
  }
} 