import { describe, expect, it } from 'vitest';
import {
	EXTENSION_SCOPES,
	isSafePushEndpoint,
	normalizeExtensionScopes,
	parseBearerToken,
	randomBase64Url,
	sha256Base64Url
} from '../src/utils/extension-utils';

describe('extension utilities', () => {
	it('normalizes scopes and always grants read and notification access', () => {
		expect(normalizeExtensionScopes(['mail.send', 'mail.delete', 'unknown', 'mail.send'])).toEqual([
			EXTENSION_SCOPES.SEND,
			EXTENSION_SCOPES.DELETE,
			EXTENSION_SCOPES.READ,
			EXTENSION_SCOPES.NOTIFY
		]);
	});

	it('parses bearer and legacy raw authorization values', () => {
		expect(parseBearerToken('Bearer token-value')).toBe('token-value');
		expect(parseBearerToken('raw-value')).toBe('raw-value');
	});

	it('accepts only HTTPS push endpoints', () => {
		expect(isSafePushEndpoint('https://fcm.googleapis.com/push/123')).toBe(true);
		expect(isSafePushEndpoint('http://example.com/push')).toBe(false);
		expect(isSafePushEndpoint('not-a-url')).toBe(false);
	});

	it('generates random URL-safe secrets and stable hashes', async () => {
		const first = randomBase64Url();
		const second = randomBase64Url();
		expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(second).not.toBe(first);
		expect(await sha256Base64Url(first)).toBe(await sha256Base64Url(first));
	});
});
