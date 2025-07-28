<p align="center">
  # @instant3p/core-offline
</p>

<p align="center">
  <a 
    href="https://discord.com/invite/VU53p7uQcE" >
    <img height=20 src="https://img.shields.io/discord/1031957483243188235" />
  </a>
  <img src="https://img.shields.io/github/stars/instantdb/instant" alt="stars">
</p>

<p align="center">
   <a href="https://www.instantdb.com/docs/start-vanilla">Get Started</a> · 
   <a href="https://instantdb.com/examples">Examples</a> · 
   <a href="https://instantdb.com/tutorial">Try the Demo</a> · 
   <a href="https://www.instantdb.com/docs/start-vanilla">Docs</a> · 
   <a href="https://discord.com/invite/VU53p7uQcE">Discord</a>
<p>

3rd party offline-first fork of Instant's vanilla javascript SDK.

```javascript
db.subscribeQuery({ todos: {} }, (resp) => {
  if (resp.error) {
    renderError(resp.error.message);
    return;
  }
  if (resp.data) {
    render(resp.data); // wohoo!
  }
});
```

# Get Started

This is a 3rd party fork providing offline-first capabilities. See the sections below for usage.

# Questions?

If you have any questions, feel free to drop us a line on our [Discord](https://discord.com/invite/VU53p7uQcE)

An offline-only fork of Instant's core package that pretends to be online while operating entirely offline.

## Overview

This package is a minimal fork of Instant's core that makes the following key changes:
1. **Always reports offline status** - Uses `OfflineNetworkListener` instead of `WindowNetworkListener`
2. **Works with cached data** - Queries work with locally cached data from IndexedDB
3. **Enqueues transactions** - All transactions are marked as "enqueued" and stored locally
4. **Improved queryOnce** - Returns cached data when offline instead of rejecting

## Key Changes Made

### 1. OfflineNetworkListener.js (New)
```javascript
// Always reports offline, never attempts WebSocket connections
export default class OfflineNetworkListener {
  static async getIsOnline() {
    return false; // Always offline
  }
  
  static listen(f) {
    f(false); // Always report offline
    return () => {}; // No-op unsubscribe
  }
}
```

### 2. Modified index.ts
```typescript
// Uses OfflineNetworkListener by default instead of WindowNetworkListener
import OfflineNetworkListener from './OfflineNetworkListener.js';

// Changed default network listener
NetworkListener || OfflineNetworkListener
```

### 3. Enhanced Reactor.js
```javascript
// Enhanced queryOnce to work with cached data when offline
if (!this._isOnline) {
  const cachedResult = this.getPreviousResult(q);
  if (cachedResult) {
    dfd.resolve(cachedResult);
    return dfd.promise;
  }
}
```

## How It Works

1. **Initialization**: Creates a Reactor instance that never attempts WebSocket connections
2. **Data Storage**: All data is stored in IndexedDB like normal InstantDB
3. **Query Engine**: Uses InstantDB's existing query engine with cached data
4. **Transactions**: Transactions are stored locally and marked as "enqueued"
5. **Relationships**: Full support for deep nested relationships using InstantDB's link system

## Installation

```bash
# Build the package
cd packages/core-offline
npm run build
```

## Usage

### Basic Usage
```javascript
import { init } from '@instant3p/core-offline';

const db = init({
  appId: 'your-app-id',
  schema: {
    entities: {
      users: {
        id: { type: 'string', unique: true },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  }
});

// Subscribe to queries (works with cached data)
db.subscribeQuery({ users: {} }, (result) => {
  console.log('Users:', result.data);
});

// Transactions (will be enqueued)
await db.transact([
  db.tx.users['user-1'].update({
    name: 'John Doe',
    email: 'john@example.com'
  })
]);
```

### With Relationships
```javascript
const db = init({
  appId: 'your-app-id',
  schema: {
    entities: {
      users: { /* ... */ },
      posts: { /* ... */ },
      comments: { /* ... */ }
    },
    links: {
      authoredPosts: {
        from: { entity: 'users', has: 'many', label: 'posts' },
        to: { entity: 'posts', has: 'one', label: 'author' }
      },
      postComments: {
        from: { entity: 'posts', has: 'many', label: 'comments' },
        to: { entity: 'comments', has: 'one', label: 'post' }
      }
    }
  }
});

// Deep nested queries work!
db.subscribeQuery({
  users: {
    posts: {
      comments: {
        author: {}
      }
    }
  }
}, (result) => {
  console.log('Deep nested data:', result.data);
});
```

## Testing

### Integration Test
A comprehensive integration test suite is included in the `__tests__` directory:

```bash
# Run all tests
npm test

# Run only integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch
```

The integration test covers:
- ✅ **Connection Status** - Verifies offline status
- ✅ **Query Subscriptions** - Tests deep nested relationship queries
- ✅ **Transactions** - Tests creating entities and linking them
- ✅ **QueryOnce** - Tests one-time queries with cached data
- ✅ **Data Persistence** - Tests data survival across restarts
- ✅ **Real Browser Environment** - Uses `fake-indexeddb` for IndexedDB simulation

### Test Features
- **Vitest Framework** - Fast, modern test runner
- **Browser Environment Simulation** - Uses `fake-indexeddb` for realistic testing
- **Comprehensive Coverage** - Tests all major offline functionality
- **Automated** - Runs in CI/CD pipelines
- **Watch Mode** - Automatically reruns tests on changes

## Differences from Original InstantDB

### What Works
- ✅ All query patterns (simple, nested, relationships)
- ✅ Transactions (stored locally)
- ✅ Schema management
- ✅ IndexedDB persistence
- ✅ Subscription system
- ✅ Deep relationship traversal

### What's Different
- 🔄 **Always offline** - Never attempts server connections
- 🔄 **Transactions enqueued** - All transactions marked as "enqueued"
- 🔄 **No real-time sync** - Data only exists locally
- 🔄 **No auth** - Authentication features don't work
- 🔄 **No presence** - Presence features don't work
- 🔄 **No file storage** - File upload/download doesn't work

## Architecture

This fork maintains InstantDB's core architecture while removing server dependencies:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                    @instantdb/core-offline                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │   Query Engine  │  │  Transaction    │  │   Link System   ││
│  │                 │  │   Processing    │  │                 ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Storage Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   IndexedDB     │  │ OfflineNetwork  │                   │
│  │   Storage       │  │   Listener      │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Why This Approach?

Instead of reimplementing InstantDB's query engine from scratch, this fork:
1. **Leverages existing code** - Uses 99% of InstantDB's existing functionality
2. **Minimal changes** - Only ~50 lines of code changed
3. **Maintains compatibility** - Same API, same behavior
4. **Proven query engine** - Uses InstantDB's battle-tested query system
5. **Easy to maintain** - Simple to merge updates from upstream

This approach gives you a fully functional offline database with InstantDB's powerful query capabilities while maintaining the exact same API.
