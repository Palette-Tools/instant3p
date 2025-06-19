import { init } from '@instantdb/core';

const APP_ID = process.env.INSTANT_APP_ID!;
const db = init({ appId: APP_ID });

interface User {
  email: string;
  id: string;
}

interface AuthState {
  user?: User;
}

let currentUser: User | null = null;

// Get DOM elements
const status = document.getElementById('status') as HTMLDivElement;
const authForm = document.getElementById('auth-form') as HTMLDivElement;
const codeForm = document.getElementById('code-form') as HTMLDivElement;
const signedIn = document.getElementById('signed-in') as HTMLDivElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const codeInput = document.getElementById('code') as HTMLInputElement;
const sendCodeBtn = document.getElementById('send-code') as HTMLButtonElement;
const signInBtn = document.getElementById('sign-in') as HTMLButtonElement;
const signOutBtn = document.getElementById('sign-out') as HTMLButtonElement;

// Auth state handling
db.subscribeAuth((auth: AuthState) => {
  currentUser = auth?.user || null;
  updateUI();
  console.log('🖥️ Renderer auth:', currentUser ? currentUser.email : 'signed out');
});

function updateUI(): void {
  if (currentUser) {
    status.className = 'status signed-in';
    status.textContent = `✅ Signed in as ${currentUser.email}`;
    authForm.style.display = 'none';
    signedIn.style.display = 'block';
  } else {
    status.className = 'status signed-out';
    status.textContent = '❌ Not signed in';
    authForm.style.display = 'block';
    signedIn.style.display = 'none';
    codeForm.style.display = 'none';
  }
}

// Event handlers
sendCodeBtn.addEventListener('click', async (): Promise<void> => {
  const email: string = emailInput.value.trim();
  if (!email) return;
  
  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = 'Sending...';
  
  try {
    await db.auth.sendMagicCode({ email });
    codeForm.style.display = 'block';
    codeInput.focus();
  } catch (error: any) {
    alert(`Error: ${error.message}`);
  } finally {
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = 'Send Magic Code';
  }
});

signInBtn.addEventListener('click', async (): Promise<void> => {
  const email: string = emailInput.value.trim();
  const code: string = codeInput.value.trim();
  if (!email || !code) return;
  
  signInBtn.disabled = true;
  signInBtn.textContent = 'Signing in...';
  
  try {
    await db.auth.signInWithMagicCode({ email, code });
  } catch (error: any) {
    alert(`Error: ${error.message}`);
  } finally {
    signInBtn.disabled = false;
    signInBtn.textContent = 'Sign In';
  }
});

signOutBtn.addEventListener('click', async (): Promise<void> => {
  signOutBtn.disabled = true;
  signOutBtn.textContent = 'Signing out...';
  
  try {
    await db.auth.signOut();
  } catch (error: any) {
    alert(`Error: ${error.message}`);
  } finally {
    signOutBtn.disabled = false;
    signOutBtn.textContent = 'Sign Out';
  }
});

// Initialize
updateUI(); 