import {
  apiRequest,
  clearSession,
  getSession,
  getSyncState,
  setSyncState,
  subscribeToPush
} from './api.js';

const SYNC_ALARM = 'cloud-mail-fallback-sync';
let syncPromise = null;

async function updateBadge(unreadCount) {
  const count = Number(unreadCount || 0);
  await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  await chrome.action.setBadgeText({ text: count > 99 ? '99+' : count ? String(count) : '' });
}

async function showMailNotification(email) {
  const sender = email.name || email.sendEmail || chrome.i18n.getMessage('unknownSender');
  await chrome.notifications.create(`mail-${email.emailId}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: sender,
    message: email.subject || chrome.i18n.getMessage('noSubject'),
    contextMessage: email.accountEmail || '',
    priority: 1
  });
}

export async function synchronize({ notify = true } = {}) {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const session = await getSession();
    if (!session) return null;
    const state = await getSyncState();
    const data = await apiRequest(`/extension/sync?cursor=${state.cursor || 0}&size=50`);
    const shouldNotify = notify && state.initialized;
    if (shouldNotify) {
      for (const email of data.list) await showMailNotification(email);
    }
    await setSyncState({ cursor: data.cursor, initialized: true });
    await updateBadge(data.unreadCount);
    return data;
  })().catch(async error => {
    console.error('Cloud Mail sync failed:', error);
    if (error.code === 401) await clearSession();
    throw error;
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}

async function initializeSession() {
  await synchronize({ notify: false });
  const push = await subscribeToPush(self.registration);
  return push;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 5 });
  initializeSession().catch(error => console.warn('Cloud Mail initialization skipped:', error));
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 5 });
  initializeSession().catch(error => console.warn('Cloud Mail startup sync skipped:', error));
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === SYNC_ALARM) synchronize().catch(() => {});
});

self.addEventListener('push', event => {
  event.waitUntil(synchronize().catch(() => {}));
});

chrome.notifications.onClicked.addListener(async notificationId => {
  if (!notificationId.startsWith('mail-')) return;
  const session = await getSession();
  if (session) await chrome.tabs.create({ url: `${session.serverUrl}/inbox` });
  await chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'session-ready') {
    initializeSession().then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === 'sync-now') {
    synchronize({ notify: false }).then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  return false;
});
