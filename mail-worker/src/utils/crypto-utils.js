const encoder = new TextEncoder();
// Cloudflare Workers currently rejects PBKDF2 iteration counts above 100,000.
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_PREFIX = 'pbkdf2-sha256';

function toBase64(bytes) {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
	return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function constantTimeEqual(left, right) {
	const a = encoder.encode(String(left));
	const b = encoder.encode(String(right));
	let mismatch = a.length ^ b.length;
	const length = Math.max(a.length, b.length);
	for (let index = 0; index < length; index++) mismatch |= (a[index] || 0) ^ (b[index] || 0);
	return mismatch === 0;
}

const saltHashUtils = {

	generateSalt(length = 16) {
		const array = new Uint8Array(length);
		crypto.getRandomValues(array);
		return btoa(String.fromCharCode(...array));
	},


	async hashPassword(password) {
		const salt = this.generateSalt();
		const hash = await this.genPbkdf2Password(password, salt, PBKDF2_ITERATIONS);
		return { salt, hash };
	},

	async genPbkdf2Password(password, salt, iterations) {
		const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits({
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: fromBase64(salt),
			iterations
		}, key, 256);
		return `${PBKDF2_PREFIX}$${iterations}$${toBase64(new Uint8Array(bits))}`;
	},

	async genHashPassword(password, salt) {
		const data = encoder.encode(salt + password);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return btoa(String.fromCharCode(...hashArray));
	},

	async verifyPassword(inputPassword, salt, storedHash) {
		if (String(storedHash).startsWith(`${PBKDF2_PREFIX}$`)) {
			const [, iterationValue] = storedHash.split('$');
			const iterations = Number(iterationValue);
			if (!Number.isSafeInteger(iterations) || iterations !== PBKDF2_ITERATIONS) return false;
			const hash = await this.genPbkdf2Password(inputPassword, salt, iterations);
			return constantTimeEqual(hash, storedHash);
		}
		const hash = await this.genHashPassword(inputPassword, salt);
		return constantTimeEqual(hash, storedHash);
	},

	needsRehash(storedHash) {
		return !String(storedHash).startsWith(`${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$`);
	},

	genRandomPwd(length = 32) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);
		return [...bytes].map(byte => chars[byte % chars.length]).join('');
	}
};

export default saltHashUtils;
