import dotenv from 'dotenv';
import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import { init } from '@instant3p/electron';
import type { User, AuthState, InstantElectronDatabase, InstaQLEntity } from '@instant3p/electron';
import schema, { type AppSchema } from '../instant.schema.js';

// Load environment variables
dotenv.config();
const APP_ID = process.env.INSTANT_APP_ID!;
if (!APP_ID) throw new Error('INSTANT_APP_ID required in .env');

// Components
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// State
let db: InstantElectronDatabase<AppSchema> | null = null;
let currentUser: User | null = null;
let notifications: InstaQLEntity<AppSchema, 'notifications'>[] = [];
let unread: InstaQLEntity<AppSchema, 'notifications'>[] = [];
let active: Map<string, Notification> = new Map();
let unsubscribe: () => void = () => {};


async function initDb(): Promise<void> {

  db = await init({ appId: APP_ID, schema });
  
  db.subscribeAuth((auth: AuthState) => {
    currentUser = auth?.user || null;
    updateTray();
  });

  let prevIds: Set<string> = new Set();
  unsubscribe = db.subscribeQuery(
    { notifications: {} },
    ({ data }) => {
      notifications = data?.notifications || [];
      unread = notifications.filter(n => !n.read);
      
      const newUnread = unread.filter(n => !prevIds.has(n.id));
      newUnread.forEach((notificationData) => { 
        const { id, title, body } = notificationData;
        if (title && body && Notification.isSupported()) {

          // Close any active notification for this ID to prevent duplicates
          active.get(id)?.close();
          
          const notification = new Notification({ title, body });
          active.set(id, notification);
          
          notification.on('click', async () => {
            await db?.transact([db?.tx.notifications[id].update({ read: true })]);
            active.delete(id);
          });
          
          notification.show();
        }
      });
      
      prevIds = new Set(notifications.map(n => n.id));
      updateTray();
    }
  );

}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false
  });

  await mainWindow.loadFile('renderer.html');
  mainWindow.once('ready-to-show', () => mainWindow!.show());
  
  if (db) {
    const disconnect = db.bridge.connect(mainWindow);
    mainWindow.once('closed', disconnect);
  }
}

function setupTray(): void {
  // Create initial tray with empty icon - will be set in updateTray
  const icon = nativeImage.createEmpty().resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  updateTray();
}

async function markAllNotificationsAsRead(): Promise<void> {
  if (db) {
    const transactions = unread.map(n => db!.tx.notifications[n.id].update({ read: true }));
    await db.transact(transactions);
  }
}

function updateTray(): void {
  if (!tray || !db) return;
  
  // Set icon based on auth state
  const iconPath = currentUser ? './instant3p-logged-in.png' : './instant3p-logged-out.png';
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray.setImage(icon);
  
  const menu = currentUser ? [
    { label: `✅ ${currentUser.email}`, enabled: false },
    { type: 'separator' as const },
    unread.length > 0 ? {
      label: `Mark ${unread.length} as Read`,
      click: () => markAllNotificationsAsRead()
    } : {
      label: 'No unread notifications',
      enabled: false
    },
    { type: 'separator' as const },
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'Sign Out', click: () => db?.auth.signOut() },
    { type: 'separator' as const },
    { label: 'Quit', click: () => app.quit() }
  ] : [
    { label: '❌ Not signed in', enabled: false },
    { type: 'separator' as const },
    { label: 'Show Window', click: () => mainWindow?.show() },
    { type: 'separator' as const },
    { label: 'Quit', click: () => app.quit() }
  ];
  
  tray.setContextMenu(Menu.buildFromTemplate(menu));
}

app.whenReady().then(async () => {
  await initDb();
  setupTray();
  await createWindow();
});

app.on('window-all-closed', () => {
  // Keep app running via tray
});

app.on('before-quit', () => {
  unsubscribe();
});