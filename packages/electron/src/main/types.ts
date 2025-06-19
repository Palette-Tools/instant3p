import type { User, InstantSchemaDef, InstantUnknownSchema } from '@instantdb/core';

import type { BrowserWindow } from 'electron';

// UnsubscribeFn type is defined locally in core
export type UnsubscribeFn = () => void;

/**
 * Auth data structure used by the auth bridge
 */
export interface ElectronAuthData {
  /** The authenticated user */
  user?: User;
  /** Additional auth properties */
  [key: string]: any;
}

/**
 * Configuration options for the Electron auth bridge
 */
export interface ElectronAuthBridgeOptions {
  /** InstantDB app ID */
  appId: string;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Main process InstantDB instance for monitoring auth changes */
  mainProcessDb?: ElectronDatabase<any>;
  
  /** Polling interval in milliseconds (default: 500) */
  pollingInterval?: number;
}

/**
 * Auth bridge interface for managing authentication between main and renderer processes
 */
export interface IElectronAuthBridge {
  /**
   * Connect a BrowserWindow to receive auth updates
   * @param window - The BrowserWindow to connect
   * @returns Disconnect function
   */
  connect(window: BrowserWindow): UnsubscribeFn;

  /**
   * Subscribe to authentication state changes
   * @param callback - Callback function to handle auth changes
   * @returns Unsubscribe function
   */
  subscribeAuth(callback: (auth: ElectronAuthData | null) => void): UnsubscribeFn;

  /**
   * Start the authentication synchronization process
   */
  startAuthSync(): Promise<void>;

  /**
   * Stop the authentication synchronization process
   */
  stopAuthSync(): void;

  /**
   * Clean up and destroy the auth bridge
   */
  destroy(): void;
}

/**
 * Clean type alias for the Electron database instance
 * Use this instead of the verbose Awaited<ReturnType<typeof init>>
 */
export type ElectronDatabase<Schema extends InstantSchemaDef<any, any, any> = InstantUnknownSchema> = 
  import('./init').InstantElectronDatabase<Schema>; 