# Environment Dependency Injection for InstantDB Core

## The Problem: Global Namespace Pollution

When using InstantDB in non-browser Javascript environments like Electron, developers are forced to pollute the global namespace with browser-specific polyfills:

```typescript
// Current hack required in @instant3p/electron
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    location: { href: 'electron://main-process' },
    document: {},
    navigator: { userAgent: 'Electron' },
  };
}

if (typeof globalThis.addEventListener === 'undefined') {
  (globalThis as any).addEventListener = () => {}; // Silently ignore
}

globalThis.BroadcastChannel = BroadcastChannelPolyfill; // Works in-process only
globalThis.WebSocket = BrowserCompatibleWebSocket;
globalThis.fetch = nodeFetch.default;
```

This approach has several problems:
- **Global pollution** - Modifies the global namespace with environment-specific implementations
- **Maintenance burden** - Each environment needs its own set of global hacks  
- **Type safety issues** - Casting to `any` to bypass TypeScript checks

## The Growing JavaScript Client Ecosystem

The need for InstantDB Clients in non-browser JavaScript environments extends beyond just Electron. Consider the variety of client-side JavaScript runtimes that could benefit from InstantDB's local-first real-time capabilities:
- **Electron & NW.js** - Desktop apps
- **NodeJS, Deno & Bun** - Interactive CLI / TUI tools
- **QuickJS & Duktape** - Embedded devices
- **Ultralight** - Popular JS runtime for video game UIs 

## The Solution: Environment Dependency Injection

InstantDB already uses dependency injection for `Storage` and `NetworkListener`. Let's add a third adapter for environment-specific APIs, following the same proven pattern.

## Step 1: HTTP Client

The first global dependency we eliminate is `fetch()`. Different environments need different implementations:

```typescript
// Browser: Use native fetch
function browserFetch(input: RequestInfo | URL, init?: RequestInit) {
  return globalThis.fetch(input, init);
}

// Electron: Use node-fetch
function electronFetch(input: RequestInfo | URL, init?: RequestInit) {
  return nodeFetch.default(input, init);
}
```

## Step 2: Network Transport

Next, we eliminate WebSocket hijacking by providing the right transport for each environment:

```typescript
// Browser: Use native WebSocket
function createBrowserWebSocket(url: string, protocols?: string | string[]) {
  return new WebSocket(url, protocols);
}

// Electron: Use Node.js WebSocket with browser-compatible headers
function createElectronWebSocket(url: string, protocols?: string | string[]) {
  return new NodeWebSocket(url, protocols, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://app.instantdb.com',
      'Sec-WebSocket-Version': '13',
    }
  });
}
```

## Step 3: Cross-Context Messaging

Next, we eliminate the dependency on the global `BroadcastChannel`. Different environments need different messaging strategies:

```typescript
interface IMessenger {
  postMessage(data: any): void;
  addEventListener(listener: (data: any) => void): () => void;
}

// Browser: Use native BroadcastChannel
function createBrowserMessenger(channel: string): IMessenger {
  const bc = new BroadcastChannel(channel);
  return {
    postMessage: (data) => bc.postMessage(data),
    addEventListener: (listener) => {
      bc.addEventListener('message', (e) => listener(e.data));
      return () => bc.close();
    }
  };
}

// Electron: Use in-process communication (could be enhanced with IPC)
function createElectronMessenger(channel: string): IMessenger {
  // Simple in-process messenger (current implementation)
  // Could be enhanced with real IPC for cross-process communication
  const instances = new Map();
  return {
    postMessage: (data: any) => {
      const listeners = instances.get(channel) || [];
      listeners.forEach((listener: any) => {
        setTimeout(() => listener({ data }), 0);
      });
    },
    addEventListener: (listener: (data: any) => void) => {
      if (!instances.has(channel)) instances.set(channel, []);
      instances.get(channel).push(listener);
      return () => {
        const listeners = instances.get(channel) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    }
  };
}
```

## Step 4: Lifecycle Events

Finally, handle environment lifecycle events without global event listeners:

```typescript
// Browser: Use beforeunload for cleanup
function onBrowserBeforeUnload(handler: () => void) {
  globalThis.addEventListener('beforeunload', handler);
  return () => globalThis.removeEventListener('beforeunload', handler);
}

// Electron: Use app quit events for cleanup
function onElectronBeforeUnload(handler: () => void) {
  app.on('before-quit', handler);
  return () => app.removeListener('before-quit', handler);
}
```

## Step 5: The Complete Interface

Now we can combine all these pieces into a clean interface:

```typescript
interface IEnvironmentAdapter {
  // Environment detection
  isClient(): boolean;
  
  // Lifecycle management
  onBeforeUnload?(handler: () => void): () => void;
  
  // Cross-context messaging (replaces BroadcastChannel)
  createMessenger(channel: string): IMessenger;
  
  // Network transport (replaces WebSocket hijacking)
  createWebSocket(url: string, protocols?: string | string[]): WebSocket;
  
  // HTTP client (replaces fetch hijacking)
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
```

Browser implementation (ships with InstantDB core):

```typescript
class BrowserEnvironmentAdapter implements IEnvironmentAdapter {
  isClient() { return typeof window !== 'undefined'; }
  
  onBeforeUnload(handler: () => void) {
    globalThis.addEventListener('beforeunload', handler);
    return () => globalThis.removeEventListener('beforeunload', handler);
  }
  
  createMessenger(channel: string) {
    const bc = new BroadcastChannel(channel);
    return {
      postMessage: (data) => bc.postMessage(data),
      addEventListener: (listener) => {
        bc.addEventListener('message', (e) => listener(e.data));
        return () => bc.close();
      }
    };
  }
  
  createWebSocket(url: string, protocols?: string | string[]) {
    return new WebSocket(url, protocols);
  }
  
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return globalThis.fetch(input, init);
  }
}
```

Electron implementation (in @instant3p/electron):

```typescript
class ElectronEnvironmentAdapter implements IEnvironmentAdapter {
  isClient() { return false; }
  
  onBeforeUnload(handler: () => void) {
    app.on('before-quit', handler);
    return () => app.removeListener('before-quit', handler);
  }
  
  createMessenger(channel: string) {
    return {
      postMessage: (data: any) => {
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send(`instant-${channel}`, data);
        });
      },
      addEventListener: (listener: (data: any) => void) => {
        const handler = (event: any, data: any) => listener(data);
        ipcMain.on(`instant-${channel}`, handler);
        return () => ipcMain.removeListener(`instant-${channel}`, handler);
      }
    };
  }
  
  createWebSocket(url: string, protocols?: string | string[]) {
    return new NodeWebSocket(url, protocols, {
      headers: {
        'User-Agent': 'Electron/MyApp',
        'Origin': 'https://app.instantdb.com',
      }
    });
  }
  
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return nodeFetch(input, init);
  }
}
```

## Step 6: Integration with InstantDB Core

Update the core init function to accept the third adapter:

```typescript
function init<Schema extends InstantSchemaDef<any, any, any>>(
  config: InstantConfig<Schema>,
  Storage?: any,
  NetworkListener?: any,
  EnvironmentAdapter?: any,  // <- NEW third adapter
  versions?: { [key: string]: string },
): InstantCoreDatabase<Schema>
```

## Step 7: Enhanced Network Event Access

While the existing `NetworkListener` handles connectivity detection well, developers sometimes need direct access to network events for custom handling. We can enhance it with two convenient methods that work seamlessly with our new environment pattern.

Currently, developers who need network events have to resort to global event listeners:

```typescript
// Current approach - uses globals
addEventListener('online', handleOnline);
addEventListener('offline', handleOffline);
```

We can add `onOnline` and `onOffline` methods to NetworkListener that leverage the existing `listen` functionality:

```typescript
// Enhanced Browser NetworkListener
class WindowNetworkListener {
  static async getIsOnline() { return navigator.onLine; }
  
  static listen(callback) {
    const onOnline = () => callback(true);
    const onOffline = () => callback(false);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    return () => {
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
    };
  }
  
  // NEW: Direct access for developers who need custom network handling
  static onOnline(handler) {
    return WindowNetworkListener.listen((isOnline) => {
      if (isOnline) handler();
    });
  }
  
  static onOffline(handler) {
    return WindowNetworkListener.listen((isOnline) => {
      if (!isOnline) handler();
    });
  }
}
```

## Step 8: Clean Usage

The result is clean, global-free usage:

```typescript
// Before: Global pollution required
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    location: { href: 'electron://main-process' },
    document: {},
    navigator: { userAgent: 'Electron' },
  };
}
globalThis.BroadcastChannel = BroadcastChannelPolyfill;
globalThis.WebSocket = BrowserCompatibleWebSocket;
globalThis.fetch = nodeFetch.default;

// After: Clean dependency injection
export class InstantElectronDatabase<Schema> implements IInstantDatabase<Schema> {
  static Storage = ElectronStorage;
  static NetworkListener = ElectronNetworkListener;
  static EnvironmentAdapter = ElectronEnvironmentAdapter;  // <- NEW

  constructor(config: InstantConfig<Schema>, versions?: { [key: string]: string }) {
    this._core = coreInit<Schema>(
      config,
      ElectronStorage,
      ElectronNetworkListener,
      ElectronEnvironmentAdapter,  // <- Inject our environment adapter
      versions,
    );
  }
}
```

## Benefits

- **Follows InstantDB patterns** - Same dependency injection as Storage/NetworkListener
- **Zero global pollution** - No more fake globals or type casting
- **Environment-optimized** - Each environment gets the best implementation for its context

## Final Architecture

This creates a clean separation of concerns:

- **EnvironmentAdapter** - Handles environment-specific APIs and cross-context messaging
- **NetworkListener** - Handles online/offline detection and network state changes
- **Storage** - Handles data persistence

Each adapter is focused on its specific domain while working together seamlessly, with zero global namespace pollution.