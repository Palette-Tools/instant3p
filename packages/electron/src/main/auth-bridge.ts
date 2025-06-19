import { BrowserWindow } from 'electron';
import ElectronStorage from './ElectronStorage.js';
import type { 
  ElectronAuthData, 
  ElectronAuthBridgeOptions, 
  IElectronAuthBridge,
  ElectronDatabase,
  UnsubscribeFn
} from './types.js';

export class ElectronAuthBridge implements IElectronAuthBridge {
  private options: Required<Omit<ElectronAuthBridgeOptions, 'mainProcessDb'>> & {
    mainProcessDb?: ElectronDatabase<any>;
  };
  private authCallbacks: ((auth: ElectronAuthData | null) => void)[] = [];
  private isDestroyed = false;
  private levelDbStorage: ElectronStorage;
  private mainProcessAuthState: ElectronAuthData | null = null;
  private mainProcessAuthUnsubscribe: UnsubscribeFn | null = null;
  private lastRendererAuthState: ElectronAuthData | null = null;
  private pollingTimeoutId: NodeJS.Timeout | null = null;
  private isPerformingAuthOperation = false;
  private mainProcessInitialized = false;
  private connectedWindows: Set<BrowserWindow> = new Set();

  constructor(options: ElectronAuthBridgeOptions) {
    this.options = {
      debug: false,
      pollingInterval: parseInt(process.env.ELECTRON_INSTANT_AUTH_POLLING_INTERVAL || '500'),
      ...options,
    };
    
    this.levelDbStorage = new ElectronStorage(`instant_auth_${options.appId}`);
  }

  /**
   * Connect a specific window to the auth bridge for sync
   */
  connect(window: BrowserWindow): () => void {
    if (this.connectedWindows.has(window)) {
      return () => {};
    }
    
    this.connectedWindows.add(window);
    
    const cleanup = () => this.connectedWindows.delete(window);
    window.once('closed', cleanup);
    
    // Immediately sync current auth state to this window
    this.syncCurrentStateToSpecificWindow(window).catch((error) => {
      console.error('[ElectronAuthBridge] Failed to sync auth state to newly connected window:', error);
    });
    
    return () => {
      this.connectedWindows.delete(window);
      window.removeListener('closed', cleanup);
    };
  }

  /**
   * Start monitoring auth changes with simple polling
   */
  async startAuthSync(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      await this.setupMainProcessAuthMonitoring();
      await this.waitForAuthOperationsToComplete();
      await this.syncCurrentState();
      this.startPolling();
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to start auth sync:', error);
    }
  }

  /**
   * Subscribe to auth changes
   */
  subscribeAuth(callback: (auth: ElectronAuthData | null) => void): () => void {
    this.authCallbacks.push(callback);
    
    this.getFullAuthData()
      .then(callback)
      .catch(() => callback(null));
    
    return () => {
      const index = this.authCallbacks.indexOf(callback);
      if (index > -1) this.authCallbacks.splice(index, 1);
    };
  }

  /**
   * Stop monitoring auth changes
   */
  stopAuthSync(): void {
    if (this.pollingTimeoutId) {
      clearTimeout(this.pollingTimeoutId);
      this.pollingTimeoutId = null;
    }
    
    if (this.mainProcessAuthUnsubscribe) {
      this.mainProcessAuthUnsubscribe();
      this.mainProcessAuthUnsubscribe = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.stopAuthSync();
    this.authCallbacks = [];
  }

  // Private methods

  private getConnectedWindows(): BrowserWindow[] {
    const activeWindows = Array.from(this.connectedWindows).filter(w => !w.isDestroyed());
    this.connectedWindows = new Set(activeWindows);
    return activeWindows;
  }

  private getMainWindow(): BrowserWindow | null {
    const connectedWindows = this.getConnectedWindows();
    return connectedWindows.length > 0 ? connectedWindows[0] : null;
  }

  private async waitForAuthOperationsToComplete(): Promise<void> {
    let retryCount = 0;
    const maxRetries = parseInt(process.env.ELECTRON_INSTANT_AUTH_RETRY_COUNT || '20');
    const retryDelay = parseInt(process.env.ELECTRON_INSTANT_AUTH_RETRY_DELAY || '100');
    
    while (this.isPerformingAuthOperation && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryCount++;
    }

    if (this.isPerformingAuthOperation) {
      console.error('[ElectronAuthBridge] Auth operations did not complete after maximum retries');
    }
  }

  private async setupMainProcessAuthMonitoring(): Promise<void> {
    if (!this.options.mainProcessDb) return;
    
    try {
      const currentAuth = await new Promise((resolve) => {
        if (!this.options.mainProcessDb) {
          resolve(null);
          return;
        }
        const unsubscribe = this.options.mainProcessDb.subscribeAuth((auth: any) => {
          unsubscribe();
          resolve(auth);
        });
      });
      
      if ((currentAuth as any)?.user) {
        this.mainProcessAuthState = (currentAuth as any).user;
      } else {
        await this.restoreAuthFromStorage();
      }
      
      this.mainProcessInitialized = true;
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to setup main process auth monitoring:', error);
      this.mainProcessAuthState = null;
      this.mainProcessInitialized = true;
    }
    
    this.mainProcessAuthUnsubscribe = this.options.mainProcessDb.subscribeAuth(async (auth: any) => {
      if (!this.mainProcessInitialized) return;
      
      const currentAuthState = auth?.user || null;
      const previousAuthState = this.mainProcessAuthState;
      this.mainProcessAuthState = currentAuthState;
      
      const wasSignedIn = !!previousAuthState;
      const isSignedIn = !!currentAuthState;
      
      try {
        if (wasSignedIn && !isSignedIn) {
          await this.performSynchronizedSignOut();
        } else if (!wasSignedIn && isSignedIn) {
          await this.performSynchronizedSignIn(currentAuthState);
        }
      } catch (error) {
        console.error('[ElectronAuthBridge] Failed to sync auth state change:', error);
      }
    });
  }

  private async restoreAuthFromStorage(): Promise<void> {
    const persistedAuth = await this.getAuthDataFromMainStorage();
    
    if (persistedAuth?.user) {
      try {
        const dbWithCore = this.options.mainProcessDb as any;
        if (dbWithCore._core?._reactor) {
          await dbWithCore._core._reactor.changeCurrentUser(persistedAuth.user);
          this.mainProcessAuthState = persistedAuth.user;
        } else {
          console.error('[ElectronAuthBridge] Main process database missing _core._reactor - cannot restore auth');
          this.mainProcessAuthState = null;
        }
      } catch (error) {
        console.error('[ElectronAuthBridge] Failed to restore auth from storage to main process:', error);
        this.mainProcessAuthState = null;
      }
    } else {
      this.mainProcessAuthState = null;
    }
  }

  private startPolling(): void {
    const poll = async () => {
      if (this.isDestroyed || this.isPerformingAuthOperation) {
        this.scheduleNextPoll();
        return;
      }
      
      try {
        const currentAuthData = await this.getFullAuthData();
        const hasChanged = JSON.stringify(currentAuthData) !== JSON.stringify(this.lastRendererAuthState);
        
        if (hasChanged) {
          this.lastRendererAuthState = currentAuthData;
          if (!this.isPerformingAuthOperation) {
            this.notifyAuthCallbacks(currentAuthData);
          }
        }
      } catch (error) {
        // Don't log polling errors as they're frequent when windows are destroyed
      }
      
      this.scheduleNextPoll();
    };
    
    poll();
  }

  private scheduleNextPoll(): void {
    if (!this.isDestroyed) {
      this.pollingTimeoutId = setTimeout(() => this.startPolling(), this.options.pollingInterval);
    }
  }

  private async getFullAuthData(): Promise<ElectronAuthData | null> {
    const window = this.getMainWindow();
    if (!window) return null;
    
    const dbName = `instant_${this.options.appId}_5`;
    
    try {
      return await window.webContents.executeJavaScript(`
        (async () => {
          const dbName = '${dbName}';
          const storeName = 'kv';
          const key = 'currentUser';
          
          return new Promise((resolve) => {
            const request = indexedDB.open(dbName, 1);
            
            request.onerror = () => resolve(null);
            request.onupgradeneeded = () => resolve(null);
            
            request.onsuccess = (event) => {
              const db = event.target.result;
              const transaction = db.transaction([storeName], 'readonly');
              const objectStore = transaction.objectStore(storeName);
              const getRequest = objectStore.get(key);
              
              getRequest.onerror = () => resolve(null);
              getRequest.onsuccess = () => {
                const userData = getRequest.result;
                if (userData) {
                  try {
                    const parsed = JSON.parse(userData);
                    resolve({ user: parsed });
                  } catch (error) {
                    resolve(null);
                  }
                } else {
                  resolve(null);
                }
              };
            };
          });
        })();
      `);
    } catch (error) {
      return null;
    }
  }

  private async executeAuthScript(windows: BrowserWindow[], operation: 'set' | 'delete', authValue?: string): Promise<void> {
    const dbName = `instant_${this.options.appId}_5`;
    const script = operation === 'set' 
      ? `objectStore.put('${authValue}', key)` 
      : `objectStore.delete(key)`;

    const promises = windows.map(async (window) => {
      try {
        await window.webContents.executeJavaScript(`
          (async () => {
            const dbName = '${dbName}';
            const storeName = 'kv';
            const key = 'currentUser';
            
            await new Promise((resolve, reject) => {
              const request = indexedDB.open(dbName, 1);
              
              request.onerror = () => reject(request.error);
              request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction([storeName], 'readwrite');
                const objectStore = transaction.objectStore(storeName);
                const authRequest = ${script};
                
                authRequest.onerror = () => reject(authRequest.error);
                authRequest.onsuccess = () => resolve(true);
              };
              
              request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                  db.createObjectStore(storeName);
                }
              };
            });
            
            const broadcastChannel = new BroadcastChannel('@instantdb');
            broadcastChannel.postMessage({ type: 'auth' });
            broadcastChannel.close();
          })();
        `);
      } catch (error) {
        console.error(`[ElectronAuthBridge] Failed to ${operation} auth data in renderer window:`, error);
      }
    });

    await Promise.all(promises);
  }

  private async syncMainProcessAuthToRenderer(authData: any): Promise<void> {
    const connectedWindows = this.getConnectedWindows();
    if (connectedWindows.length === 0) return;
    
    const authValue = JSON.stringify(authData);
    await this.executeAuthScript(connectedWindows, 'set', authValue);
  }

  private async clearRendererAuth(): Promise<void> {
    const connectedWindows = this.getConnectedWindows();
    if (connectedWindows.length === 0) return;
    
    await this.executeAuthScript(connectedWindows, 'delete');
  }

  private async syncCurrentStateToSpecificWindow(window: BrowserWindow): Promise<void> {
    if (!window || window.isDestroyed()) return;

    try {
      const currentAuth = this.lastRendererAuthState || await this.getFullAuthData();
      if (currentAuth?.user) {
        await this.executeAuthScript([window], 'set', JSON.stringify(currentAuth.user));
      }
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to sync current state to specific window:', error);
    }
  }

  private async performSynchronizedSignOut(): Promise<void> {
    this.isPerformingAuthOperation = true;

    try {
      await this.persistAuthDataToMainStorage(null);
      await this.clearRendererAuthWithRetry();
      this.lastRendererAuthState = null;
      this.notifyAuthCallbacks(null);
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to perform synchronized sign out:', error);
      this.notifyAuthCallbacks(null);
    } finally {
      this.isPerformingAuthOperation = false;
    }
  }

  private async performSynchronizedSignIn(authData: any): Promise<void> {
    this.isPerformingAuthOperation = true;

    try {
      const authPayload = { user: authData };
      
      await this.persistAuthDataToMainStorage(authPayload);
      await this.syncMainProcessAuthToRenderer(authData);
      
      this.lastRendererAuthState = authPayload;
      this.notifyAuthCallbacks(authPayload);
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to perform synchronized sign in:', error);
      this.notifyAuthCallbacks({ user: authData });
    } finally {
      this.isPerformingAuthOperation = false;
    }
  }

  private async clearRendererAuthWithRetry(maxRetries: number = parseInt(process.env.ELECTRON_INSTANT_AUTH_CLEAR_RETRIES || '3')): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.clearRendererAuth();
        
        const rendererAuth = await this.getFullAuthData();
        if (!rendererAuth) return;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error('[ElectronAuthBridge] Failed to clear renderer auth after maximum retries:', error);
        }
      }
      
      if (attempt < maxRetries) {
        const retryDelay = parseInt(process.env.ELECTRON_INSTANT_AUTH_CLEAR_RETRY_DELAY || '100');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  private async syncCurrentState(): Promise<void> {
    this.isPerformingAuthOperation = true;

    try {
      const mainProcessAuth = this.mainProcessAuthState;
      const rendererAuth = await this.getFullAuthData();
      const persistedAuth = await this.getAuthDataFromMainStorage();
      
      // Determine authoritative auth state
      let authoritativeAuth: ElectronAuthData | null = null;
      
      if (mainProcessAuth && this.mainProcessInitialized) {
        authoritativeAuth = mainProcessAuth;
      } else if (rendererAuth) {
        authoritativeAuth = rendererAuth;
      } else if (persistedAuth) {
        authoritativeAuth = persistedAuth;
      }
      
      if (authoritativeAuth) {
        await this.syncAuthToAllLocations(authoritativeAuth, mainProcessAuth, rendererAuth, persistedAuth);
      } else {
        await this.clearAllAuthLocations(rendererAuth);
      }
      
      this.lastRendererAuthState = authoritativeAuth;
      this.notifyAuthCallbacks(authoritativeAuth);
      
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to sync current auth state:', error);
      this.notifyAuthCallbacks(null);
    } finally {
      this.isPerformingAuthOperation = false;
    }
  }

  private async syncAuthToAllLocations(
    authoritativeAuth: ElectronAuthData,
    mainProcessAuth: ElectronAuthData | null,
    rendererAuth: ElectronAuthData | null,
    persistedAuth: ElectronAuthData | null
  ): Promise<void> {
    const needsMainSync = !mainProcessAuth && this.options.mainProcessDb;
    const needsRendererSync = !rendererAuth;
    const needsPersistenceSync = !persistedAuth || 
      JSON.stringify(persistedAuth) !== JSON.stringify(authoritativeAuth);
    
    try {
      if (needsMainSync) {
        await this.syncRendererAuthToMainProcess(authoritativeAuth.user);
      }
      
      if (needsRendererSync) {
        await this.syncMainProcessAuthToRenderer(authoritativeAuth.user);
      }
      
      if (needsPersistenceSync) {
        await this.persistAuthDataToMainStorage(authoritativeAuth);
      }
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to sync auth to all locations:', error);
    }
  }

  private async clearAllAuthLocations(rendererAuth: ElectronAuthData | null): Promise<void> {
    try {
      if (rendererAuth) {
        await this.clearRendererAuth();
      }
      await this.persistAuthDataToMainStorage(null);
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to clear all auth locations:', error);
    }
  }

  private async syncRendererAuthToMainProcess(userData: any): Promise<void> {
    if (!this.options.mainProcessDb) return;
    
    try {
      const dbWithCore = this.options.mainProcessDb as any;
      if (!dbWithCore._core?._reactor) {
        console.error('[ElectronAuthBridge] Main process database missing _core._reactor - cannot sync auth');
        this.mainProcessAuthState = userData;
        return;
      }
      
      await dbWithCore._core._reactor.changeCurrentUser(userData);
      this.mainProcessAuthState = userData;
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to sync renderer auth to main process:', error);
      this.mainProcessAuthState = userData;
    }
  }

  private async getAuthDataFromMainStorage(): Promise<ElectronAuthData | null> {
    try {
      const authString = await this.levelDbStorage.getItem('auth-data');
      return authString ? JSON.parse(authString) : null;
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to get auth data from main storage:', error);
      return null;
    }
  }

  private async persistAuthDataToMainStorage(authData: ElectronAuthData | null): Promise<void> {
    try {
      if (authData) {
        await this.levelDbStorage.setItem('auth-data', JSON.stringify(authData));
      } else {
        await this.levelDbStorage.removeItem('auth-data');
      }
    } catch (error) {
      console.error('[ElectronAuthBridge] Failed to persist auth data to main storage:', error);
    }
  }

  private notifyAuthCallbacks(authData: ElectronAuthData | null): void {
    if (this.isPerformingAuthOperation) {
      // Just notify callbacks directly during synchronized operations
      this.authCallbacks.forEach(callback => {
        try {
          callback(authData);
        } catch (error) {
          console.error('[ElectronAuthBridge] Auth callback error:', error);
        }
      });
      return;
    }
    
    // Persist then notify for legacy path
    this.persistAuthDataToMainStorage(authData)
      .then(() => this.notifyCallbacks(authData))
      .catch(() => this.notifyCallbacks(authData));
  }

  private notifyCallbacks(authData: ElectronAuthData | null): void {
    this.authCallbacks.forEach(callback => {
      try {
        callback(authData);
      } catch (error) {
        console.error('[ElectronAuthBridge] Auth callback error:', error);
      }
    });
  }
} 