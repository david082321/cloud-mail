import test from 'node:test';
import assert from 'node:assert/strict';
import { base64UrlToBytes, normalizeServerUrl, requestedScopes } from '../src/api.js';

globalThis.chrome = { i18n: { getMessage: key => key } };

test('normalizes HTTPS and local development service URLs', () => {
  assert.equal(normalizeServerUrl('https://mail.example.com/'), 'https://mail.example.com');
  assert.equal(normalizeServerUrl('http://localhost:8787/'), 'http://localhost:8787');
  assert.throws(() => normalizeServerUrl('http://mail.example.com'), /httpsRequired/);
});
test('decodes URL-safe VAPID public keys', () => {
  assert.deepEqual([...base64UrlToBytes('AQIDBA')], [1, 2, 3, 4]);
});
test('requests destructive mail access only when explicitly enabled', () => {
  assert.deepEqual(requestedScopes(), ['mail.read', 'notification.receive']);
  assert.deepEqual(requestedScopes({ allowSend: true, allowDelete: true }), [
    'mail.read', 'notification.receive', 'mail.send', 'mail.delete'
  ]);
});
