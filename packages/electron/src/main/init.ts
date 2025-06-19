import { 
  init as coreInit,
  type InstantConfig, 
  type InstantSchemaDef,
  type InstantUnknownSchema,
  type IInstantDatabase,
  type InstantCoreDatabase,
  type InstaQLParams,
  type InstaQLSubscriptionState,
  id,
} from '@instantdb/core';
import { createRequire } from 'module';
import ElectronStorage from './ElectronStorage.js';
import ElectronNetworkListener from './ElectronNetworkListener.js';
import { ElectronAuthBridge } from './auth-bridge.js';
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

// Required WebSocket for InstantDB network connectivity
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

async function obliterateStaleLocks(): Promise<void> {
  try {
    const userDataPath = app.getPath('userData');
    const lockDirs = [
      path.join(userDataPath, 'instantdb'),  // LevelDB storage location
      path.join(userDataPath, 'IndexedDB'),  // Legacy/renderer storage cleanup
    ];

    for (const dir of lockDirs) {
      try {
        const exists = await fs.access(dir).then(() => true).catch(() => false);
        if (!exists) continue;

        const lockFiles = await findLockFiles(dir);
        await Promise.allSettled(lockFiles.map(file => fs.unlink(file)));
      } catch {}
    }
  } catch {}
}

async function findLockFiles(dirPath: string): Promise<string[]> {
  const lockFiles: string[] = [];
  
  const scan = async (currentPath: string): Promise<void> => {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name === 'LOCK' || entry.name.endsWith('.ldb-journal')) {
          lockFiles.push(fullPath);
        }
      }
    } catch {}
  };
  
  await scan(dirPath);
  return lockFiles;
}

/**
 * Patch global environment for InstantDB compatibility AND add deep debugging
 * 
 * InstantDB's Reactor checks isClient() which looks for window or chrome objects.
 * In Electron main process (Node.js), these don't exist, so the Reactor returns early
 * and never initializes storage. We need to make it think we're in a client environment.
 */
function patchGlobalsForInstantDB() {
  // Create a minimal window-like object to satisfy isClient() check
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      // Minimal window object - just enough to pass isClient() check
      location: { href: 'electron://main-process' },
      document: {},
      navigator: { userAgent: 'Electron' },
    };
  }
  
  // Also patch addEventListener for beforeunload handler
  if (typeof globalThis.addEventListener === 'undefined') {
    (globalThis as any).addEventListener = () => {};
  }
  
  // Patch WebSocket for InstantDB network connectivity (REQUIRED)
  // Node.js has built-in WebSocket support, but it sends Node.js-style headers
  // that InstantDB's server rejects. We need to force a browser-compatible implementation.
  
  // Create a WebSocket wrapper that sends browser-like headers
  class BrowserCompatibleWebSocket extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      // Configure WebSocket with browser-like headers to ensure server compatibility
      super(url, protocols, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Origin': 'https://app.instantdb.com',
          'Sec-WebSocket-Version': '13',
        }
      });
    }
  }
  
  (globalThis as any).WebSocket = BrowserCompatibleWebSocket;
}

export class InstantElectronDatabase<
  Schema extends InstantSchemaDef<any, any, any> = InstantUnknownSchema,
> implements IInstantDatabase<Schema> {
  
  // CRITICAL: These static properties tell the core which adapters to use
  static Storage = ElectronStorage;
  static NetworkListener = ElectronNetworkListener;
  
  protected _core: InstantCoreDatabase<Schema>;
  public readonly bridge: ElectronAuthBridge;
  
  constructor(config: InstantConfig<Schema>, versions?: { [key: string]: string }) {
    // CRITICAL: Patch globals BEFORE calling coreInit
    patchGlobalsForInstantDB();
    
    // Initialize core database with our custom adapters  
    this._core = coreInit<Schema>(
      config,
      ElectronStorage,  
      ElectronNetworkListener,
      versions,
    );
    
    // Initialize auth bridge automatically with every db instance
    this.bridge = new ElectronAuthBridge({
      appId: config.appId,
      debug: process.env.NODE_ENV !== 'production',
      mainProcessDb: this as any, // Type workaround for circular dependency
    });
    
    // Guard to prevent circular updates when bridge is syncing
    let bridgeIsSyncing = false;
    
    this.bridge.subscribeAuth((bridgeAuthData: any) => {
      // Only update main process if this isn't a circular update from the bridge's own restoration
      if (!bridgeIsSyncing && this._core?._reactor?.changeCurrentUser) {
        bridgeIsSyncing = true;
        
        // When bridge reports auth changes, update the main database's auth state
        // This ensures db.subscribeAuth() callbacks fire for ALL auth changes
        this._core._reactor.changeCurrentUser(bridgeAuthData?.user || null)
          .finally(() => {
            bridgeIsSyncing = false;
          });
      }
    });
    
    // Auto-start auth sync (users can still control which windows to connect)
    this.bridge.startAuthSync();
  }
  
  // Proxy all methods to the core database
  get storage() { return this._core.storage; }
  get auth() { return this._core.auth; }
  get tx() { return this._core.tx; }
  
  subscribeQuery<Q extends InstaQLParams<Schema>>(
    query: Q, 
    callback: (result: InstaQLSubscriptionState<Schema, Q>) => void
  ) { 
    return this._core.subscribeQuery(query, callback); 
  }
  
  queryOnce<Q extends InstaQLParams<Schema>>(query: Q) { 
    return this._core.queryOnce(query); 
  }
  
  transact(chunks: any) { 
    return this._core.transact(chunks); 
  }
  
  // Add missing methods that might be expected
  getAuth() { 
    return this._core.getAuth(); 
  }
  
  subscribeAuth(callback: (auth: any) => void) { 
    return this._core.subscribeAuth(callback); 
  }
  
  subscribeConnectionStatus(callback: (status: any) => void) { 
    return this._core.subscribeConnectionStatus(callback); 
  }
}

/**
 * Initialize InstantDB for Electron main process
 * 
 * @example
 * ```typescript
 * import { init, id } from '@instant3p/electron';
 * 
 * const db = await init({
 *   appId: 'your-app-id'
 * });
 * 
 * // Use standard InstantDB methods
 * const result = await db.transact([
 *   db.tx.posts[id()].update({ title: 'Hello World' })
 * ]);
 * ```
 */
export async function init<Schema extends InstantSchemaDef<any, any, any> = InstantUnknownSchema>(
  config: InstantConfig<Schema>,
  versions?: { [key: string]: string }
): Promise<InstantElectronDatabase<Schema>> {
  await obliterateStaleLocks();
  
  return new InstantElectronDatabase(config, versions);
}

// Export the id function for convenience
export { id }; 