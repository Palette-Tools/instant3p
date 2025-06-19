# @instant3p/electron

InstantDB for Electron main process with auth synchronization bridge.

## Purpose

This package provides two key capabilities:

1. **Full InstantDB client for Electron main process** - Complete database connectivity with storage, subscriptions, and transactions
2. **Auth bridge** - Automatic authentication synchronization between main and renderer processes

## Quick Start

### Main Process

```typescript
import { init } from '@instant3p/electron';

const db = await init({
  appId: 'your-app-id'
});

// Full InstantDB functionality in main process
const posts = await db.queryOnce({ posts: {} });

// Connect renderer windows for auth sync
db.bridge.connect(mainWindow);

// Subscribe to auth changes
db.bridge.subscribeAuth((auth) => {
  console.log('Auth state:', auth?.user?.email || 'signed out');
});
```

### Renderer Process

```typescript
// Standard InstantDB - no changes needed
import { init } from '@instantdb/core';

const db = init({ appId: 'your-app-id' });

// Auth automatically syncs with main process
await db.auth.sendMagicCode({ email: 'user@example.com' });
```

## Installation

```bash
npm install @instant3p/electron
# or
yarn add @instant3p/electron
# or 
pnpm add @instant3p/electron
```

## API Reference

### Main Process

#### `init(config)`

Initialize InstantDB for Electron main process.

```typescript
import { init } from '@instant3p/electron';

const db = await init({
  appId: 'your-app-id'
});
```

**Returns:** `InstantElectronDatabase` - Full InstantDB client with auth bridge

#### Database Methods

All standard InstantDB methods are available:

```typescript
// Queries
const result = await db.queryOnce({ posts: {} });
const unsubscribe = db.subscribeQuery({ posts: {} }, (result) => {
  console.log(result.data.posts);
});

// Transactions
await db.transact([
  db.tx.posts[id()].update({ title: 'Hello' })
]);

// Auth
const unsubscribe = db.subscribeAuth((auth) => {
  console.log('User:', auth?.user);
});
```

#### Auth Bridge Methods

```typescript
// Connect renderer windows for auth sync
const disconnect = db.bridge.connect(browserWindow);
```

### Renderer Process

Use standard `@instantdb/core` - no special configuration needed:

```typescript
import { init } from '@instantdb/core';

const db = init({ appId: 'your-app-id' });

// All standard InstantDB methods work
// Auth changes automatically sync to main process
```

## How Auth Sync Works

1. **Main process** initializes `@instant3p/electron` with auth bridge
2. **Renderer process** uses standard web clients such as `@instantdb/core` or `@instantdb/react`
3. **Bridge connects** renderer windows via `db.bridge.connect(window)`
4. **Auth changes** in either process automatically sync to the other
5. **Subscriptions** in both processes receive auth updates

The bridge uses Electron's `webContents.executeJavaScript()` to access InstantDB's localStorage directly, enabling true bidirectional sync.

## Implementation Details

### Storage
- **Main process**: Uses LevelDB via `level` package for persistent storage
- **Renderer process**: Uses standard browser localStorage
- **Auth sync**: Bridge polls and synchronizes auth tokens between processes

### Network
- **Main process**: Uses `ws` WebSocket library with browser-compatible headers
- **Renderer process**: Uses standard browser WebSocket API
- **Compatibility**: Server treats both as standard web clients

### Security
Works with all Electron security configurations:

```typescript
// Maximum security (recommended)
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true
  }
});
```

## Examples

See the `/demos` directory for complete examples:

- **[Auth Demo](./demos/auth/)** - Basic auth synchronization between main and renderer
- **[Notifications Demo](./demos/notifications/)** - Real-time notifications with system tray integration

## TypeScript Support

Full TypeScript support with InstantDB schema types:

```typescript
import { init } from '@instant3p/electron';
import type { InstantSchemaDef } from '@instant3p/electron';

type Schema = InstantSchemaDef<{
  posts: { id: string; title: string; };
}>;

const db = await init<Schema>({ appId: 'your-app-id' });

// Fully typed queries
const posts = await db.queryOnce({ posts: {} });
```

## Environment Variables

Optional configuration via environment variables:

```bash
# Auth bridge polling interval (default: 500ms)
ELECTRON_INSTANT_AUTH_POLLING_INTERVAL=500

# Auth operation retry settings
ELECTRON_INSTANT_AUTH_RETRY_COUNT=20
ELECTRON_INSTANT_AUTH_RETRY_DELAY=100
ELECTRON_INSTANT_AUTH_CLEAR_RETRIES=3

# Debug mode
NODE_ENV=development
```

## Troubleshooting

### "Window destroyed" errors
Clean up the bridge when windows close:

```typescript
mainWindow.on('closed', () => {
  db.bridge.destroy();
});
```

### Auth not syncing
Ensure you connect renderer windows:

```typescript
// After window loads
mainWindow.webContents.on('did-finish-load', () => {
  db.bridge.connect(mainWindow);
});
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev
```

---

**Made with ❤️ by the InstantDB community**
