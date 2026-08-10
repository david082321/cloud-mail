import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import saltHashUtils from '../src/utils/crypto-utils';

const api = async (path, options = {}) => {
	const response = await SELF.fetch(`http://example.com/api${path}`, {
		...options,
		headers: {
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers || {})
		}
	});
	return response.json();
};

describe('Chrome extension API', () => {
	beforeAll(async () => {
		const initResponse = await SELF.fetch(`http://example.com/api/init/${env.jwt_secret}`);
		expect(await initResponse.text()).toBe('success');

		const { salt, hash } = await saltHashUtils.hashPassword('extension-test-password');
		await env.db.prepare(`
			INSERT INTO user (email, type, password, salt, status, is_del)
			VALUES (?, 1, ?, ?, 0, 0)
		`).bind('extension@example.com', hash, salt).run();
		const user = await env.db.prepare(`SELECT user_id FROM user WHERE email = ?`).bind('extension@example.com').first();
		await env.db.prepare(`
			INSERT INTO account (email, name, user_id, is_del)
			VALUES (?, ?, ?, 0)
		`).bind('extension@example.com', 'Extension', user.user_id).run();
		const account = await env.db.prepare(`SELECT account_id FROM account WHERE email = ?`).bind('extension@example.com').first();
		await env.db.prepare(`
			INSERT INTO email (
				send_email, name, account_id, user_id, subject, text,
				type, status, unread, is_del
			) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
		`).bind('sender@example.net', 'Sender', account.account_id, user.user_id, 'Extension test', 'Hello from the integration test').run();
	});

	it('creates, refreshes, uses and revokes a scoped device session', async () => {
		const login = await api('/extension/auth/login', {
			method: 'POST',
			body: JSON.stringify({
				email: 'extension@example.com',
				password: 'extension-test-password',
				deviceName: 'Integration Chrome',
				scopes: ['mail.read', 'mail.send', 'mail.delete', 'notification.receive']
			})
		});
		expect(login.code).toBe(200);
		expect(login.data.scopes).toContain('mail.read');
		expect(login.data.scopes).toContain('mail.send');
		expect(login.data.scopes).toContain('mail.delete');

		const authorization = { Authorization: `Bearer ${login.data.accessToken}` };
		const profile = await api('/extension/profile', { headers: authorization });
		expect(profile.data.email).toBe('extension@example.com');

		const accounts = await api('/extension/accounts', { headers: authorization });
		expect(accounts.data).toHaveLength(1);

		const sync = await api('/extension/sync?cursor=0&size=30', { headers: authorization });
		expect(sync.data.list).toHaveLength(1);
		expect(sync.data.unreadCount).toBe(1);
		const emailId = sync.data.list[0].emailId;

		const detail = await api(`/extension/emails/${emailId}`, { headers: authorization });
		expect(detail.data.text).toBe('Hello from the integration test');

		const read = await api('/extension/emails/read', {
			method: 'PUT',
			headers: authorization,
			body: JSON.stringify({ emailIds: [emailId] })
		});
		expect(read.code).toBe(200);

		const deleted = await api(`/extension/emails/${emailId}`, {
			method: 'DELETE',
			headers: authorization
		});
		expect(deleted.code).toBe(200);

		const syncAfterDelete = await api('/extension/sync?cursor=0&size=30', { headers: authorization });
		expect(syncAfterDelete.data.list).toHaveLength(0);
		expect(syncAfterDelete.data.unreadCount).toBe(0);

		const missingDetail = await api(`/extension/emails/${emailId}`, { headers: authorization });
		expect(missingDetail.code).toBe(404);

		const refreshed = await api('/extension/auth/refresh', {
			method: 'POST',
			body: JSON.stringify({ refreshToken: login.data.refreshToken })
		});
		expect(refreshed.code).toBe(200);
		expect(refreshed.data.refreshToken).not.toBe(login.data.refreshToken);

		const secondLogin = await api('/extension/auth/login', {
			method: 'POST',
			body: JSON.stringify({
				email: 'extension@example.com',
				password: 'extension-test-password',
				deviceName: 'Second Chrome',
				scopes: ['mail.read', 'notification.receive']
			})
		});
		expect(secondLogin.code).toBe(200);

		const deleteDenied = await api(`/extension/emails/${emailId}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${secondLogin.data.accessToken}` }
		});
		expect(deleteDenied.code).toBe(403);

		const revoke = await api(`/extension/devices/${login.data.deviceId}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${refreshed.data.accessToken}` }
		});
		expect(revoke.code).toBe(200);

		const denied = await api('/extension/profile', {
			headers: { Authorization: `Bearer ${refreshed.data.accessToken}` }
		});
		expect(denied.code).toBe(401);

		const secondRevoke = await api(`/extension/devices/${secondLogin.data.deviceId}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${secondLogin.data.accessToken}` }
		});
		expect(secondRevoke.code).toBe(200);
	});
});
