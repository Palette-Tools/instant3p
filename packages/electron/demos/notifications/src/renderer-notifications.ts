import { init, id } from '@instantdb/core';

const APP_ID = process.env.INSTANT_APP_ID!;
if (!APP_ID) throw new Error('INSTANT_APP_ID required in environment');

const db = init({ appId: APP_ID });

let currentUser: any = null;
let notifications: any[] = [];

// DOM elements
const statusEl = document.getElementById('status')!;
const authFormEl = document.getElementById('auth-form')!;
const signedInEl = document.getElementById('signed-in')!;
const emailEl = document.getElementById('email') as HTMLInputElement;
const codeFormEl = document.getElementById('code-form')!;
const codeEl = document.getElementById('code') as HTMLInputElement;
const notificationCountEl = document.getElementById('notification-count')!;

// Subscribe to auth changes
db.subscribeAuth((auth) => {
  currentUser = auth.user;
  updateAuthUI(auth);
});

// Subscribe to notifications
db.subscribeQuery(
  { notifications: {} },
  (result) => {
    if (result.error) return;
    notifications = result.data?.notifications || [];
    updateNotificationsCount();
  }
);

// Event listeners
document.getElementById('send-code')!.addEventListener('click', sendMagicCode);
document.getElementById('sign-in')!.addEventListener('click', signInWithCode);
document.getElementById('sign-out')!.addEventListener('click', signOut);
document.getElementById('add-notification')!.addEventListener('click', addTestNotification);

function updateAuthUI(auth: any) {
  if (auth.user) {
    statusEl.textContent = `✅ Signed in as ${auth.user.email}`;
    statusEl.className = 'status signed-in';
    authFormEl.style.display = 'none';
    signedInEl.style.display = 'block';
  } else {
    statusEl.textContent = '❌ Not signed in';
    statusEl.className = 'status signed-out';
    authFormEl.style.display = 'block';
    signedInEl.style.display = 'none';
    codeFormEl.style.display = 'none';
  }
}

function updateNotificationsCount() {
  const unreadCount = notifications.filter(n => !n.read).length;
  notificationCountEl.textContent = `${notifications.length} notification${notifications.length !== 1 ? 's' : ''} (${unreadCount} unread)`;
}

async function sendMagicCode() {
  const email = emailEl.value;
  if (!email) {
    alert('Please enter an email address');
    return;
  }
  
  try {
    await db.auth.sendMagicCode({ email });
    codeFormEl.style.display = 'block';
  } catch (error) {
    alert(`Failed to send magic code: ${(error as Error).message}`);
  }
}

async function signInWithCode() {
  const email = emailEl.value;
  const code = codeEl.value;
  
  if (!email || !code) {
    alert('Please enter both email and code');
    return;
  }
  
  try {
    await db.auth.signInWithMagicCode({ email, code });
  } catch (error) {
    alert(`Sign in failed: ${(error as Error).message}`);
  }
}

async function signOut() {
  try {
    await db.auth.signOut();
  } catch (error) {
    alert(`Sign out failed: ${(error as Error).message}`);
  }
}

async function addTestNotification() {
  if (!currentUser) {
    alert('Please sign in first');
    return;
  }

  const testNotifications = [
    { title: '🎉 Welcome!', body: 'Thanks for trying InstantDB notifications!' },
    { title: '📬 New Message', body: 'You have received a new message.' },
    { title: '🔄 System Update', body: 'Your app has been updated.' },
    { title: '⏰ Reminder', body: 'Don\'t forget to check your notifications!' },
  ];
  
  const randomNotification = testNotifications[Math.floor(Math.random() * testNotifications.length)];
  
  try {
    await db.transact([
      db.tx.notifications[id()].update({
        ...randomNotification,
        read: false,
        createdAt: Date.now()
      })
    ]);
  } catch (error) {
    alert(`Failed to add notification: ${(error as Error).message}`);
  }
} 