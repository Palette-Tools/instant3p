# InstantDB Electron Auth Demo

Minimal demo demonstrating InstantDB authentication in Electron applications.

## Purpose

This demo shows three key technical capabilities:

1. **`@instant3p/electron` API usage** - Basic implementation of the Electron-specific InstantDB API
2. **Main process connectivity** - The main process can directly connect to InstantDB
3. **Auth state syncing** - Authentication state automatically syncs between main and renderer processes

## Quick Start

1. Set your app ID:
   ```bash
   export INSTANT_APP_ID=your_app_id_here
   ```

2. Install and run:
   ```bash
   npm install
   npm start
   ```

## Project Structure

```
src/
├── main.ts              # Entry point
├── main-sign-in.ts      # Main process auth flow
├── renderer-sign-in.ts  # Renderer process auth flow
└── renderer.html        # Browser UI
```

## Implementation Details

### Main Process (`main.ts`)
- Initializes `db` using `init` from `@instant3p/electron`
- Users sign in via system tray
- Updates system tray based on auth state

### Renderer Process
- Initializes `db` using `init` from `@instantdb/core`
- Users sign in via browser UI
- Updates browser UI based on auth state

### Auth Bridge
- `db.bridge.connect(mainWindow)` for bi-directional sync
- Auth in main process appears in renderer
- Auth in renderer appears in main process

## How It Works

1. Main process connects to InstantDB using `@instant3p/electron`
2. Renderer process connects to InstantDB using `@instantdb/core`
3. Bridge syncs auth state bi-directionally between both processes
4. User can authenticate from either process (tray or browser UI)
5. Auth state changes in either process appear in the other automatically

## Technical Notes

- Both processes maintain independent InstantDB connections
- Auth state syncs bi-directionally via the bridge
- System tray provides auth interface in main process
- Browser UI provides auth interface in renderer process
- Magic codes work from either interface

## Prerequisites

- Node.js and npm
- An InstantDB app ID ([get one here](https://instantdb.com))
- Basic understanding of Electron architecture

## Development

### Build System
- **TypeScript**: Full type safety with InstantDB types
- **ESBuild**: Fast bundling for renderer process
- **Hot reload**: Use `npm run dev` for development

---
**Made with ❤️ by the InstantDB community**