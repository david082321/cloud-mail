const encoder = new TextEncoder();

export const EXTENSION_SCOPES = Object.freeze({
	READ: 'mail.read',
	SEND: 'mail.send',
	DELETE: 'mail.delete',
	NOTIFY: 'notification.receive'
});

const allowedScopes = new Set(Object.values(EXTENSION_SCOPES));

export function normalizeExtensionScopes(scopes = []) {
	const requested = Array.isArray(scopes) ? scopes : [];
	const normalized = requested.filter(scope => allowedScopes.has(scope));

	if (!normalized.includes(EXTENSION_SCOPES.READ)) {
		normalized.push(EXTENSION_SCOPES.READ);
	}
	if (!normalized.includes(EXTENSION_SCOPES.NOTIFY)) {
		normalized.push(EXTENSION_SCOPES.NOTIFY);
	}

	return [...new Set(normalized)];
}
export function randomBase64Url(byteLength = 32) {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function sha256Base64Url(value) {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
	let binary = '';
	for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function parseBearerToken(header = '') {
	const value = header.trim();
	if (!value) return '';
	return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : value;
}

export function isSafePushEndpoint(endpoint) {
	try {
		return new URL(endpoint).protocol === 'https:';
	} catch {
		return false;
	}
}
