import { BrowserWindow, ipcMain, dialog, IpcMainEvent } from 'electron';
import type { InstantElectronDatabase } from '@instant3p/electron';


export async function showInputDialog(
  title: string, 
  label: string, 
  defaultValue: string = '',
  parentWindow?: BrowserWindow | null
): Promise<string | null> {
  return new Promise((resolve) => {
    const inputWindow = new BrowserWindow({
      width: 400,
      height: 200,
      modal: true,
      parent: parentWindow || undefined,
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      title,
      show: false
    });

    // Create simple HTML for input
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 20px; 
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
          }
          .container {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 500;
          }
          input { 
            width: 100%; 
            padding: 8px; 
            margin-bottom: 16px; 
            border: 1px solid #ccc; 
            border-radius: 4px;
            font-size: 14px;
          }
          .buttons { 
            display: flex; 
            gap: 8px; 
            justify-content: flex-end;
          }
          button { 
            padding: 8px 16px; 
            border: 1px solid #ccc; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 14px;
          }
          .primary { 
            background: #007AFF; 
            color: white; 
            border-color: #007AFF;
          }
          .primary:hover { 
            background: #0056CC; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <label for="input">${label}</label>
          <input type="text" id="input" value="${defaultValue}" autofocus>
          <div class="buttons">
            <button onclick="cancel()">Cancel</button>
            <button class="primary" onclick="submit()">OK</button>
          </div>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          
          function submit() {
            const value = document.getElementById('input').value;
            ipcRenderer.send('input-dialog-result', value);
          }
          
          function cancel() {
            ipcRenderer.send('input-dialog-result', null);
          }
          
          // Submit on Enter key
          document.getElementById('input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              submit();
            }
          });
          
          // Cancel on Escape key
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              cancel();
            }
          });
        </script>
      </body>
      </html>
    `;

    // Handle the response
    const handleResult = (event: IpcMainEvent, result: string | null) => {
      inputWindow.close();
      resolve(result);
      ipcMain.removeListener('input-dialog-result', handleResult);
    };

    ipcMain.on('input-dialog-result', handleResult);

    // Load the HTML content
    inputWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    inputWindow.once('ready-to-show', () => {
      inputWindow.show();
    });

    // Handle window close without result
    inputWindow.on('closed', () => {
      if (!inputWindow.isDestroyed()) {
        resolve(null);
        ipcMain.removeListener('input-dialog-result', handleResult);
      }
    });
  });
}


export async function signInFlow(db: InstantElectronDatabase, parentWindow?: BrowserWindow | null): Promise<void> {
  try {
    // Get email
    const email = await showInputDialog('Sign In', 'Enter your email address:', '', parentWindow);
    if (!email) return;
    
    console.log('📧 Sending magic code to:', email);
    await db.auth.sendMagicCode({ email });
    
    // Immediately show code input dialog
    const code = await showInputDialog('Enter Magic Code', `Enter the code sent to ${email}:`, '', parentWindow);
    if (!code) return;
    
    console.log('🔑 Attempting sign-in with magic code');
    await db.auth.signInWithMagicCode({ email, code });
    
    console.log('✅ Sign-in successful');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Sign-in failed:', error);
    dialog.showErrorBox('Sign In Error', errorMessage);
  }
} 