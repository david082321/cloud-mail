const SESSION_KEY = 'cloudMailSession';
const SYNC_KEY = 'cloudMailSync';
let refreshPromise = null;

export function normalizeServerUrl(value) {
  const url = new URL(String(value || '').trim());
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error(chrome.i18n.getMessage('httpsRequired'));
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export async function requestServerPermission(serverUrl) {
  const origin = `${new URL(serverUrl).origin}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

export async function getSession() {
  return (await chrome.storage.local.get(SESSION_KEY))[SESSION_KEY] || null;
}

export async function setSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove([SESSION_KEY, SYNC_KEY]);
  await chrome.action.setBadgeText({ text: '' });
}

export async function getSyncState() {
  return (await chrome.storage.local.get(SYNC_KEY))[SYNC_KEY] || { cursor: 0, initialized: false };
}

export async function setSyncState(state) {
  await chrome.storage.local.set({ [SYNC_KEY]: state });
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(chrome.i18n.getMessage('invalidServerResponse'));
  }
  const payload = await response.json();
  if (!response.ok || payload.code !== 200) {
    const error = new Error(payload.message || `${response.status}`);
    error.code = payload.code || response.status;
    throw error;
  }
  return payload.data;
}

async function rawRequest(serverUrl, path, options = {}) {
  return parseResponse(await fetch(`${serverUrl}/api${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Accept-Language': chrome.i18n.getUILanguage(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  }));
}

export function requestedScopes({ allowSend = false, allowDelete = false } = {}) {
  return ['mail.read', 'notification.receive', ...(allowSend ? ['mail.send'] : []), ...(allowDelete ? ['mail.delete'] : [])];
}

export async function login({ serverUrl, email, password, deviceName, allowSend, allowDelete }) {
  const normalizedUrl = normalizeServerUrl(serverUrl);
  if (!await requestServerPermission(normalizedUrl)) {
    throw new Error(chrome.i18n.getMessage('serverPermissionDenied'));
  }
  const data = await rawRequest(normalizedUrl, '/extension/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      deviceName,
      scopes: requestedScopes({ allowSend, allowDelete })
    })
  });
  const session = {
    serverUrl: normalizedUrl,
    accessToken: data.accessToken,
    accessTokenExpiresAt: Date.now() + data.accessTokenExpiresIn * 1000,
    refreshToken: data.refreshToken,
    refreshTokenExpiresTime: data.refreshTokenExpiresTime,
    deviceId: data.deviceId,
    scopes: data.scopes,
    user: data.user
  };
  await setSession(session);
  await setSyncState({ cursor: 0, initialized: false });
  return session;
}

async function refreshSession(session) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const data = await rawRequest(session.serverUrl, '/extension/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
      const next = {
        ...session,
        accessToken: data.accessToken,
        accessTokenExpiresAt: Date.now() + data.accessTokenExpiresIn * 1000,
        refreshToken: data.refreshToken,
        refreshTokenExpiresTime: data.refreshTokenExpiresTime,
        scopes: data.scopes
      };
      await setSession(next);
      return next;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}, canRetry = true) {
  let session = await getSession();
  if (!session) throw new Error(chrome.i18n.getMessage('notConnected'));
  if (session.accessTokenExpiresAt <= Date.now() + 60_000) {
    session = await refreshSession(session);
  }

  try {
    return await rawRequest(session.serverUrl, path, {
      ...options,
      headers: { Authorization: `Bearer ${session.accessToken}`, ...(options.headers || {}) }
    });
  } catch (error) {
    if (canRetry && error.code === 401) {
      session = await refreshSession(session);
      return rawRequest(session.serverUrl, path, {
        ...options,
        headers: { Authorization: `Bearer ${session.accessToken}`, ...(options.headers || {}) }
      });
    }
    throw error;
  }
}

export async function subscribeToPush(registration = self.registration) {
  const config = await apiRequest('/extension/config');
  if (!config.pushAvailable || !config.vapidPublicKey) return { available: false };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: false,
      applicationServerKey: base64UrlToBytes(config.vapidPublicKey)
    });
  }
  await apiRequest('/extension/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON())
  });
  return { available: true, subscribed: true };
}

export function base64UrlToBytes(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
