import test from 'node:test';
import assert from 'node:assert/strict';
import { openPopupWindow, POPUP_WINDOW_OPTIONS } from '../src/window.js';

function chromeMock(initialWindowId) {
  const state = initialWindowId === undefined ? {} : { cloudMailPopupWindowId: initialWindowId };
  const calls = { create: [], update: [] };
  return {
    calls,
    state,
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    storage: {
      session: {
        get: async key => ({ [key]: state[key] }),
        set: async values => Object.assign(state, values),
        remove: async key => { delete state[key]; }
      }
    },
    windows: {
      create: async options => { calls.create.push(options); return { id: 42 }; },
      update: async (windowId, options) => { calls.update.push({ windowId, options }); return { id: windowId }; }
    }
  };
}

test('creates and stores a standalone popup window', async () => {
  const chrome = chromeMock();
  const result = await openPopupWindow(chrome);

  assert.deepEqual(result, { windowId: 42, reused: false });
  assert.deepEqual(chrome.calls.create, [{
    ...POPUP_WINDOW_OPTIONS,
    url: 'chrome-extension://test/src/popup/popup.html?mode=window'
  }]);
  assert.equal(chrome.state.cloudMailPopupWindowId, 42);
});

test('focuses the existing standalone popup window', async () => {
  const chrome = chromeMock(17);
  const result = await openPopupWindow(chrome);

  assert.deepEqual(result, { windowId: 17, reused: true });
  assert.deepEqual(chrome.calls.update, [{ windowId: 17, options: { focused: true } }]);
  assert.equal(chrome.calls.create.length, 0);
});

test('replaces a standalone window id that is no longer valid', async () => {
  const chrome = chromeMock(17);
  chrome.windows.update = async () => { throw new Error('Window not found'); };

  const result = await openPopupWindow(chrome);

  assert.deepEqual(result, { windowId: 42, reused: false });
  assert.equal(chrome.calls.create.length, 1);
});
