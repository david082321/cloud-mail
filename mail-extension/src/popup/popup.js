import { apiRequest, clearSession, getSession, login } from '../api.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;
let accounts = [];
let currentEmailId = null;

function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  $$('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  $$('[data-i18n-title]').forEach(element => {
    const label = t(element.dataset.i18nTitle);
    element.title = label;
    element.setAttribute('aria-label', label);
  });
}

function showStatus(message, error = false) {
  const status = $('#status');
  status.textContent = message;
  status.classList.toggle('error', error);
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 3500);
}

function showView(connected) {
  $('#login-view').classList.toggle('hidden', connected);
  $('#app-view').classList.toggle('hidden', !connected);
}

function showPanel(name) {
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
  ['inbox', 'detail', 'compose', 'devices'].forEach(panel => {
    $(`#${panel}-panel`).classList.toggle('hidden', panel !== name);
  });
  if (name === 'devices') loadDevices().catch(error => showStatus(error.message, true));
}

function formatTime(value) {
  if (!value) return '';
  const utcValue = /(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(utcValue);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

async function loadAccounts() {
  accounts = await apiRequest('/extension/accounts');
  const options = accounts.map(account => {
    const option = document.createElement('option');
    option.value = account.accountId;
    option.textContent = account.name ? `${account.name} (${account.email})` : account.email;
    return option;
  });
  const all = document.createElement('option');
  all.value = '';
  all.textContent = t('allMailboxes');
  $('#account-select').replaceChildren(all, ...options.map(option => option.cloneNode(true)));
  $('#compose-account').replaceChildren(...options);
}

function renderMailList(list) {
  const container = $('#mail-list');
  container.replaceChildren(...[...list].reverse().map(email => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mail-item${email.unread === 0 ? ' unread' : ''}`;
    button.dataset.emailId = email.emailId;

    const top = document.createElement('span');
    top.className = 'mail-top';
    const sender = document.createElement('span');
    sender.className = 'mail-sender';
    sender.textContent = email.name || email.sendEmail || t('unknownSender');
    const time = document.createElement('span');
    time.className = 'mail-time';
    time.textContent = formatTime(email.createTime);
    top.append(sender, time);

    const subject = document.createElement('span');
    subject.className = 'mail-subject';
    subject.textContent = email.subject || t('noSubject');
    const mailbox = document.createElement('span');
    mailbox.className = 'mail-account';
    mailbox.textContent = email.accountEmail;
    button.append(top, subject, mailbox);
    button.addEventListener('click', () => openDetail(email.emailId));
    return button;
  }));
  $('#mail-empty').classList.toggle('hidden', list.length > 0);
}

async function loadMail() {
  const accountId = $('#account-select').value;
  const query = accountId ? `&accountId=${encodeURIComponent(accountId)}` : '';
  const data = await apiRequest(`/extension/sync?cursor=0&size=50${query}`);
  renderMailList(data.list);
  return data;
}

async function openDetail(emailId) {
  const email = await apiRequest(`/extension/emails/${emailId}`);
  currentEmailId = email.emailId;
  $('#detail-subject').textContent = email.subject || t('noSubject');
  $('#detail-sender').textContent = `${t('from')}: ${email.name || ''} <${email.sendEmail || ''}>`;
  $('#detail-mailbox').textContent = `${t('to')}: ${email.accountEmail}`;
  $('#detail-time').textContent = formatTime(email.createTime);
  $('#detail-text').textContent = email.text || t('noTextContent');
  showPanel('detail');
  if (email.unread === 0) {
    await apiRequest('/extension/emails/read', { method: 'PUT', body: JSON.stringify({ emailIds: [emailId] }) });
    chrome.runtime.sendMessage({ type: 'sync-now' }).catch(() => {});
  }
}

async function loadDevices() {
  const devices = await apiRequest('/extension/devices');
  $('#device-list').replaceChildren(...devices.map(device => {
    const row = document.createElement('div');
    row.className = 'device';
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${device.name}${device.current ? ` · ${t('currentDevice')}` : ''}`;
    const time = document.createElement('small');
    time.textContent = `${t('lastUsed')}: ${formatTime(device.lastUsedTime)}`;
    info.append(name, time);
    row.append(info);
    if (!device.current) {
      const revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.textContent = t('revoke');
      revoke.addEventListener('click', async () => {
        await apiRequest(`/extension/devices/${encodeURIComponent(device.deviceId)}`, { method: 'DELETE' });
        await loadDevices();
      });
      row.append(revoke);
    }
    return row;
  }));
}

async function initializeApp() {
  const [session, profile] = await Promise.all([getSession(), apiRequest('/extension/profile')]);
  $('#profile-email').textContent = profile.email;
  showView(true);
  await loadAccounts();
  await loadMail();
  const push = await chrome.runtime.sendMessage({ type: 'session-ready' });
  $('#push-status').textContent = push?.available ? t('enabled') : t('notConfigured');
  const canSend = session.scopes.includes('mail.send');
  $('[data-tab="compose"]').disabled = !canSend;
  $('[data-tab="compose"]').title = canSend ? '' : t('sendScopeUnavailable');
  const canDelete = session.scopes.includes('mail.delete');
  $('#detail-delete').disabled = !canDelete;
  $('#detail-delete').title = canDelete ? '' : t('deleteScopeUnavailable');
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await login({
      serverUrl: $('#server-url').value,
      email: $('#login-email').value,
      password: $('#login-password').value,
      deviceName: $('#device-name').value,
      allowSend: $('#allow-send').checked,
      allowDelete: $('#allow-delete').checked
    });
    $('#login-password').value = '';
    await initializeApp();
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$$('.tab').forEach(tab => tab.addEventListener('click', () => showPanel(tab.dataset.tab)));
$('#detail-back').addEventListener('click', () => { showPanel('inbox'); loadMail().catch(() => {}); });
$('#detail-delete').addEventListener('click', async event => {
  if (!currentEmailId || !confirm(t('deleteConfirm'))) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await apiRequest(`/extension/emails/${currentEmailId}`, { method: 'DELETE' });
    await chrome.notifications.clear(`mail-${currentEmailId}`).catch(() => {});
    currentEmailId = null;
    showPanel('inbox');
    await loadMail();
    await chrome.runtime.sendMessage({ type: 'sync-now' }).catch(() => {});
    showStatus(t('deletedSuccessfully'));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    const session = await getSession();
    button.disabled = !session?.scopes.includes('mail.delete');
  }
});
$('#account-select').addEventListener('change', () => loadMail().catch(error => showStatus(error.message, true)));
$('#refresh-button').addEventListener('click', async () => {
  try { await loadMail(); await chrome.runtime.sendMessage({ type: 'sync-now' }); showStatus(t('refreshed')); }
  catch (error) { showStatus(error.message, true); }
});
$('#open-web').addEventListener('click', async () => {
  const session = await getSession();
  if (session) chrome.tabs.create({ url: `${session.serverUrl}/inbox` });
});
$$('.open-window-button').forEach(button => button.addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'open-popup-window' });
    if (result?.error) throw new Error(result.error);
  } catch {
    showStatus(t('openWindowFailed'), true);
  }
}));

$('#compose-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await apiRequest('/extension/emails/send', {
      method: 'POST',
      body: JSON.stringify({
        accountId: Number($('#compose-account').value),
        receiveEmail: $('#compose-to').value.split(',').map(value => value.trim()).filter(Boolean),
        subject: $('#compose-subject').value,
        text: $('#compose-text').value
      })
    });
    $('#compose-to').value = '';
    $('#compose-subject').value = '';
    $('#compose-text').value = '';
    showStatus(t('sentSuccessfully'));
    showPanel('inbox');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#logout-button').addEventListener('click', async () => {
  const session = await getSession();
  try {
    if (session) await apiRequest(`/extension/devices/${encodeURIComponent(session.deviceId)}`, { method: 'DELETE' });
  } catch (error) {
    console.warn(error);
  }
  await clearSession();
  showView(false);
});

const windowMode = new URLSearchParams(location.search).get('mode') === 'window';
document.body.classList.toggle('window-mode', windowMode);
$$('.open-window-button').forEach(button => button.classList.toggle('hidden', windowMode));
localize();
getSession().then(session => {
  if (!session) return showView(false);
  initializeApp().catch(async error => {
    showStatus(error.message, true);
    if (error.code === 401) { await clearSession(); showView(false); }
  });
});
