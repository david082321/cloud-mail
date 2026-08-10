const WINDOW_ID_KEY = 'cloudMailPopupWindowId';

export const POPUP_WINDOW_OPTIONS = Object.freeze({
  type: 'popup',
  width: 640,
  height: 650,
  focused: true
});

export async function openPopupWindow(chromeApi = globalThis.chrome) {
  const stored = await chromeApi.storage.session.get(WINDOW_ID_KEY);
  const existingWindowId = stored[WINDOW_ID_KEY];

  if (Number.isInteger(existingWindowId)) {
    try {
      await chromeApi.windows.update(existingWindowId, {
        width: POPUP_WINDOW_OPTIONS.width,
        height: POPUP_WINDOW_OPTIONS.height,
        focused: true
      });
      return { windowId: existingWindowId, reused: true };
    } catch {
      await chromeApi.storage.session.remove(WINDOW_ID_KEY);
    }
  }

  const createdWindow = await chromeApi.windows.create({
    ...POPUP_WINDOW_OPTIONS,
    url: chromeApi.runtime.getURL('src/popup/popup.html?mode=window')
  });
  if (!Number.isInteger(createdWindow?.id)) throw new Error('Chrome did not return a window id');
  await chromeApi.storage.session.set({ [WINDOW_ID_KEY]: createdWindow.id });
  return { windowId: createdWindow.id, reused: false };
}

export async function forgetPopupWindow(windowId, chromeApi = globalThis.chrome) {
  const stored = await chromeApi.storage.session.get(WINDOW_ID_KEY);
  if (stored[WINDOW_ID_KEY] === windowId) await chromeApi.storage.session.remove(WINDOW_ID_KEY);
}
