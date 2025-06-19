# InstantDB Electron Notifications Demo

Minimal demo demonstrating InstantDB real-time notifications with native system integration in Electron applications.

## Purpose

This demo shows four key technical capabilities:

1. **Real-time notification system** - Live notification sync using InstantDB subscriptions
2. **Native system notifications** - Desktop notification integration via Electron's Notification API
3. **System tray management** - Background operation with tray UI
4. **Notification state handling** - Read/unread tracking with database updates

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
├── main.ts                    # Main process with tray & notifications
├── renderer-notifications.ts  # Renderer UI and notification creation
├── renderer.html              # Browser notification interface
instant.schema.ts              # Notification data model
instant.perms.ts              # Database permissions
```

## Implementation Details

### Main Process (`main.ts`)
- Initializes `db` using `init` from `@instant3p/electron`
- Subscribes to notification changes via real-time queries
- Creates native system notifications using Electron's `Notification` API
- Manages system tray with dynamic notification count
- Handles notification click events and read state updates
- Implements background operation (app persists when window closed)

### Renderer Process (`renderer-notifications.ts`)
- Initializes `db` using `@instantdb/core`
- Provides UI for creating test notifications
- Displays live notification counts and status
- Handles authentication flow for notification creation

## How It Works

1. User authenticates via magic link in renderer process
2. Auth state syncs to main process via bridge connection
3. User creates notifications through renderer UI
4. InstantDB real-time subscription immediately detects new notifications
5. Main process receives notification data and creates native system notifications
6. User clicks notification → marks as read in database
7. Read state syncs back to renderer UI in real-time
8. System tray updates to reflect current unread count

## Development

### Prerequisites
- Node.js and npm
- An InstantDB app ID ([get one here](https://instantdb.com))
- Understanding of Electron main/renderer process architecture
- Basic familiarity with real-time subscriptions

### Build System
- **TypeScript**: Full type safety with InstantDB schema types
- **ESBuild**: Fast bundling via `build.js`
- **Hot reload**: Use `npm run dev` for development with auto-restart

### Environment Setup
Create `.env` file:
```bash
INSTANT_APP_ID=your_app_id_here
```

The app will continue running in the system tray even when the window is closed.

---
**Made with ❤️ by the InstantDB community**