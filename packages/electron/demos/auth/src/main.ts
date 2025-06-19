import dotenv from 'dotenv';
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { init } from '@instant3p/electron';
import type { User, AuthState, InstantElectronDatabase } from '@instant3p/electron';
import { signInFlow } from './main-sign-in.js';
import path from 'path';

dotenv.config();

const APP_ID = process.env.INSTANT_APP_ID!;
if (!APP_ID) throw new Error('INSTANT_APP_ID required in .env');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentUser: User | null = null;
let db: InstantElectronDatabase | null = null;


async function initDb(): Promise<void> {
  db = await init({ appId: APP_ID });
  
  db.subscribeAuth((auth: AuthState) => {
    console.log('🔐 Auth state changed:', auth?.user?.email || 'null');
    currentUser = auth?.user || null;
    updateTray();
  });
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
  console.log('🚀 Setting up tray...');
  // Create initial tray with empty icon - will be set in updateTray
  const icon = nativeImage.createEmpty().resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  console.log('📋 Tray created, calling updateTray...');
  updateTray();
}

function updateTray(): void {
  if (!tray || !db) return;
  
  // Set icon based on auth state
  const iconPath = currentUser ? './instant3p-logged-in.png' : './instant3p-logged-out.png';
  console.log('🔧 updateTray called - currentUser:', currentUser?.email || 'null');
  console.log('🎨 Using icon path:', iconPath);
  console.log('🗂️ Current working directory:', process.cwd());
  console.log('🗂️ Resolved icon path:', path.resolve(iconPath));
  
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  console.log('📷 Icon created - isEmpty:', icon.isEmpty(), 'size:', icon.getSize());
  
  tray.setImage(icon);
  console.log('✅ Tray icon set successfully');
  
  const menu = currentUser ? [
    { label: `✅ ${currentUser.email}`, enabled: false },
    { type: 'separator' as const },
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'Sign Out', click: () => db?.auth.signOut() },
    { type: 'separator' as const },
    { label: 'Quit', click: () => app.quit() }
  ] : [
    { label: '❌ Not signed in', enabled: false },
    { type: 'separator' as const },
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'Sign In', click: () => db && signInFlow(db, mainWindow) },
    { type: 'separator' as const },
    { label: 'Quit', click: () => app.quit() }
  ];
  
  tray.setContextMenu(Menu.buildFromTemplate(menu));
  tray.setToolTip(`Auth Demo - ${currentUser ? 'Signed In' : 'Signed Out'}`);
}

app.whenReady().then(async () => {
  await initDb();
  setupTray();
  await createWindow();
});

app.on('window-all-closed', () => {
  // Keep app running via tray
}); 