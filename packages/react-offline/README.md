<p align="center">
  # @instant3p/react-offline
</p>

<p align="center">
  <a 
    href="https://discord.com/invite/VU53p7uQcE" >
    <img height=20 src="https://img.shields.io/discord/1031957483243188235" />
  </a>
  <img src="https://img.shields.io/github/stars/instantdb/instant" alt="stars">
</p>

<p align="center">
   <a href="https://instantdb.com/dash">Get Started</a> · 
   <a href="https://instantdb.com/examples">Examples</a> · 
   <a href="https://instantdb.com/tutorial">Try the Demo</a> · 
   <a href="https://instantdb.com/docs">Docs</a> · 
   <a href="https://discord.com/invite/VU53p7uQcE">Discord</a>
<p>

3rd party offline-first React hooks for Instant.

# @instant3p/react-offline

3rd party React hooks with offline-first capabilities. This package provides React hooks powered by `@instant3p/core-offline` for seamless offline-first functionality.

## Key Features

- 🔌 **Offline-First**: Works 100% offline with local storage
- 🔄 **Seamless Sync**: Automatically syncs when connectivity returns
- ⚡ **Familiar API**: React hooks inspired by Instant's patterns
- 🌐 **Dynamic Connectivity**: Switch between online/offline modes at runtime

## Installation

```bash
npm install @instant3p/react-offline
```

## Quick Start

```tsx
import { init, tx, id } from '@instant3p/react-offline';

const APP_ID = 'your-app-id';

const db = init({ 
  appId: APP_ID,
  isOnline: false // Start in offline mode
});

function App() {
  const { isLoading, error, data } = db.useQuery({ 
    users: {} 
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Users ({data.users.length})</h1>
      {data.users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      
      <button onClick={() => {
        const userId = id();
        db.transact(
          db.tx.users[userId].update({ name: 'New User' })
        );
      }}>
        Add User (Works Offline!)
      </button>
      
      <button onClick={() => db.setOnline(true)}>
        Go Online
      </button>
      
      <button onClick={() => db.setOnline(false)}>
        Go Offline
      </button>
    </div>
  );
}
```

## Documentation

This package provides React hooks with offline capabilities. The hooks work with cached data:

- `useQuery` - Query your data with real-time subscriptions
- `useAuth` - Handle authentication state
- `useConnectionStatus` - Monitor connectivity

The main difference is the enhanced `init` function that supports:

```tsx
const db = init({
  appId: 'your-app-id',
  schema: yourSchema,
  isOnline: false, // Start offline
});

// Switch modes at runtime
db.setOnline(true);  // Go online
db.setOnline(false); // Go offline
```

For more details on usage patterns, see the examples above.

## Development

This package is built on top of `@instant3p/core-offline` which provides the offline-first functionality. It's a 3rd party fork with enhanced offline capabilities.
