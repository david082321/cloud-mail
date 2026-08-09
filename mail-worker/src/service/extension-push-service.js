import { isSafePushEndpoint } from '../utils/extension-utils';
import BizError from '../error/biz-error';

let webPushPromise;

function getWebPush() {
	if (!webPushPromise) {
		webPushPromise = import('web-push').then(module => module.default || module);
	}
	return webPushPromise;
}

function vapidDetails(env) {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
	return {
		subject: env.VAPID_SUBJECT || `mailto:${env.admin}`,
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY
	};
}

const extensionPushService = {
	config(env) {
		return {
			pushAvailable: Boolean(vapidDetails(env)),
			vapidPublicKey: env.VAPID_PUBLIC_KEY || ''
		};
	},

	async subscribe(c, auth, subscription) {
		const endpoint = String(subscription?.endpoint || '');
		const p256dh = String(subscription?.keys?.p256dh || '');
		const authKey = String(subscription?.keys?.auth || '');
		if (!isSafePushEndpoint(endpoint) || !p256dh || !authKey) {
			throw new BizError('Invalid push subscription', 400);
		}

		await c.env.db.prepare(`
			INSERT INTO extension_push_subscription (
				device_id, user_id, endpoint, p256dh, auth_key, expiration_time, update_time
			) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(endpoint) DO UPDATE SET
				device_id = excluded.device_id,
				user_id = excluded.user_id,
				p256dh = excluded.p256dh,
				auth_key = excluded.auth_key,
				expiration_time = excluded.expiration_time,
				update_time = CURRENT_TIMESTAMP
		`).bind(
			auth.deviceId,
			auth.userId,
			endpoint,
			p256dh,
			authKey,
			subscription.expirationTime || null
		).run();
	},

	async unsubscribe(c, auth, endpoint) {
		await c.env.db.prepare(`
			DELETE FROM extension_push_subscription WHERE device_id = ? AND endpoint = ?
		`).bind(auth.deviceId, endpoint).run();
	},

	async sendNewMail(context, emailRow) {
		const env = context.env;
		const details = vapidDetails(env);
		if (!details || !emailRow?.userId || !emailRow?.emailId) return;

		const { results } = await env.db.prepare(`
			SELECT s.endpoint, s.p256dh, s.auth_key
			FROM extension_push_subscription s
			JOIN extension_device d ON d.device_id = s.device_id
			WHERE s.user_id = ? AND d.revoked = 0 AND datetime(d.expires_time) > CURRENT_TIMESTAMP
		`).bind(emailRow.userId).all();
		const webpush = await getWebPush();

		const expiredEndpoints = [];
		await Promise.all(results.map(async row => {
			try {
				await webpush.sendNotification({
					endpoint: row.endpoint,
					keys: { p256dh: row.p256dh, auth: row.auth_key }
				}, JSON.stringify({
					type: 'new-email',
					emailId: emailRow.emailId,
					accountId: emailRow.accountId
				}), {
					vapidDetails: details,
					TTL: 60 * 60,
					urgency: 'high',
					topic: `mail-${emailRow.emailId}`
				});
			} catch (error) {
				if (error?.statusCode === 404 || error?.statusCode === 410) {
					expiredEndpoints.push(row.endpoint);
					return;
				}
				console.error('Extension push failed:', error);
			}
		}));

		if (expiredEndpoints.length) {
			const placeholders = expiredEndpoints.map(() => '?').join(',');
			await env.db.prepare(`
				DELETE FROM extension_push_subscription WHERE endpoint IN (${placeholders})
			`).bind(...expiredEndpoints).run();
		}
	}
};

export default extensionPushService;
