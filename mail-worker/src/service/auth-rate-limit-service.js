import BizError from '../error/biz-error';
import reqUtils from '../utils/req-utils';
import { t } from '../i18n/i18n';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

async function hashKey(value) {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
	return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function keys(c, email) {
	const normalizedEmail = String(email || '').trim().toLowerCase();
	const ip = String(reqUtils.getIp(c) || 'unknown').slice(0, 128);
	return Promise.all([
		hashKey(`email:${normalizedEmail}`),
		hashKey(`ip:${ip}`),
		hashKey(`pair:${ip}:${normalizedEmail}`)
	]);
}

const authRateLimitService = {
	async assertAllowed(c, email) {
		const rateKeys = await keys(c, email);
		const placeholders = rateKeys.map(() => '?').join(',');
		const row = await c.env.db.prepare(`
			SELECT 1 AS blocked
			FROM auth_rate_limit
			WHERE rate_key IN (${placeholders})
			  AND blocked_until > CURRENT_TIMESTAMP
			LIMIT 1
		`).bind(...rateKeys).first();
		if (row) throw new BizError(t('loginRateLimited'), 429);
	},

	async recordFailure(c, email) {
		const rateKeys = await keys(c, email);
		for (let index = 0; index < rateKeys.length; index++) {
			const rateKey = rateKeys[index];
			const threshold = index === 1 ? 50 : MAX_ATTEMPTS;
			await c.env.db.prepare(`
				INSERT INTO auth_rate_limit (rate_key, attempts, window_start, blocked_until)
				VALUES (?, 1, CURRENT_TIMESTAMP, NULL)
				ON CONFLICT(rate_key) DO UPDATE SET
					attempts = CASE
						WHEN window_start <= datetime('now', ?) THEN 1
						ELSE attempts + 1
					END,
					window_start = CASE
						WHEN window_start <= datetime('now', ?) THEN CURRENT_TIMESTAMP
						ELSE window_start
					END,
					blocked_until = CASE
						WHEN (CASE WHEN window_start <= datetime('now', ?) THEN 1 ELSE attempts + 1 END) >= ?
						THEN datetime('now', ?)
						ELSE blocked_until
					END
			`).bind(
				rateKey,
				`-${WINDOW_SECONDS} seconds`,
				`-${WINDOW_SECONDS} seconds`,
				`-${WINDOW_SECONDS} seconds`,
				threshold,
				`+${WINDOW_SECONDS} seconds`
			).run();
		}
	},

	async clear(c, email) {
		const allKeys = await keys(c, email);
		const rateKeys = [allKeys[0], allKeys[2]];
		const placeholders = rateKeys.map(() => '?').join(',');
		await c.env.db.prepare(`DELETE FROM auth_rate_limit WHERE rate_key IN (${placeholders})`).bind(...rateKeys).run();
	},

	async cleanup(c) {
		await c.env.db.prepare(`DELETE FROM auth_rate_limit WHERE window_start < datetime('now', '-1 day')`).run();
	}
};

export default authRateLimitService;
