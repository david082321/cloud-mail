import BizError from '../error/biz-error';
import JwtUtils from '../utils/jwt-utils';
import userService from './user-service';
import permService from './perm-service';
import cryptoUtils from '../utils/crypto-utils';
import { isDel, userConst } from '../const/entity-const';
import {
	EXTENSION_SCOPES,
	normalizeExtensionScopes,
	parseBearerToken,
	randomBase64Url,
	sha256Base64Url
} from '../utils/extension-utils';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;

function isoAfter(seconds) {
	return new Date(Date.now() + seconds * 1000).toISOString();
}

function assertActiveUser(userRow) {
	if (!userRow || userRow.isDel === isDel.DELETE || userRow.status === userConst.status.BAN) {
		throw new BizError('Account is unavailable', 401);
	}
}

async function getGrantedScopes(c, userRow, requestedScopes) {
	const scopes = normalizeExtensionScopes(requestedScopes);
	const isAdmin = userRow.email === c.env.admin;
	const permissions = isAdmin ? ['*'] : await permService.userPermKeys(c, userRow.userId);
	if (!isAdmin && !permissions.includes('account:query')) {
		throw new BizError('Mailbox access permission denied', 403);
	}
	return scopes.filter(scope => {
		if (scope === EXTENSION_SCOPES.SEND) return isAdmin || permissions.includes('email:send');
		if (scope === EXTENSION_SCOPES.DELETE) return isAdmin || permissions.includes('email:delete');
		return true;
	});
}

async function createAccessToken(c, device) {
	return JwtUtils.generateToken(c, {
		aud: 'cloud-mail-extension',
		deviceId: device.deviceId,
		userId: device.userId,
		scopes: device.scopes
	}, ACCESS_TOKEN_SECONDS);
}

function publicDevice(row, currentDeviceId) {
	return {
		deviceId: row.device_id,
		name: row.name,
		scopes: JSON.parse(row.scopes || '[]'),
		createdTime: row.create_time,
		lastUsedTime: row.last_used_time,
		expiresTime: row.expires_time,
		current: row.device_id === currentDeviceId
	};
}

const extensionAuthService = {
	async login(c, params) {
		const email = String(params?.email || '').trim();
		const password = String(params?.password || '');
		const deviceName = String(params?.deviceName || 'Chrome').trim().slice(0, 80) || 'Chrome';
		if (!email || !password) throw new BizError('Email and password are required', 400);

		const userRow = await userService.selectByEmailIncludeDel(c, email);
		assertActiveUser(userRow);
		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password)) {
			throw new BizError('Incorrect email or password', 401);
		}

		const deviceId = crypto.randomUUID();
		const refreshToken = randomBase64Url();
		const refreshTokenHash = await sha256Base64Url(refreshToken);
		const scopes = await getGrantedScopes(c, userRow, params?.scopes);
		const expiresTime = isoAfter(REFRESH_TOKEN_SECONDS);

		await c.env.db.prepare(`
			INSERT INTO extension_device (
				device_id, user_id, name, refresh_token_hash, scopes, expires_time
			) VALUES (?, ?, ?, ?, ?, ?)
		`).bind(deviceId, userRow.userId, deviceName, refreshTokenHash, JSON.stringify(scopes), expiresTime).run();

		const accessToken = await createAccessToken(c, { deviceId, userId: userRow.userId, scopes });
		return {
			accessToken,
			accessTokenExpiresIn: ACCESS_TOKEN_SECONDS,
			refreshToken,
			refreshTokenExpiresTime: expiresTime,
			deviceId,
			scopes,
			user: { userId: userRow.userId, email: userRow.email }
		};
	},

	async refresh(c, params) {
		const refreshToken = String(params?.refreshToken || '');
		if (!refreshToken) throw new BizError('Refresh token is required', 401);
		const tokenHash = await sha256Base64Url(refreshToken);
		const row = await c.env.db.prepare(`
			SELECT device_id, user_id, scopes, expires_time
			FROM extension_device
			WHERE refresh_token_hash = ? AND revoked = 0
		`).bind(tokenHash).first();

		if (!row || Date.parse(row.expires_time) <= Date.now()) {
			throw new BizError('Extension session expired', 401);
		}
		const userRow = await userService.selectById(c, row.user_id);
		assertActiveUser(userRow);

		const nextRefreshToken = randomBase64Url();
		const nextHash = await sha256Base64Url(nextRefreshToken);
		const expiresTime = isoAfter(REFRESH_TOKEN_SECONDS);
		const update = await c.env.db.prepare(`
			UPDATE extension_device
			SET refresh_token_hash = ?, expires_time = ?, last_used_time = CURRENT_TIMESTAMP
			WHERE device_id = ? AND refresh_token_hash = ?
		`).bind(nextHash, expiresTime, row.device_id, tokenHash).run();
		if (update.meta?.changes !== 1) throw new BizError('Extension session expired', 401);

		const scopes = JSON.parse(row.scopes || '[]');
		const accessToken = await createAccessToken(c, {
			deviceId: row.device_id,
			userId: row.user_id,
			scopes
		});
		return {
			accessToken,
			accessTokenExpiresIn: ACCESS_TOKEN_SECONDS,
			refreshToken: nextRefreshToken,
			refreshTokenExpiresTime: expiresTime,
			deviceId: row.device_id,
			scopes
		};
	},

	async authenticate(c, requiredScope) {
		const token = parseBearerToken(c.req.header('Authorization') || '');
		const payload = await JwtUtils.verifyToken(c, token);
		if (!payload || payload.aud !== 'cloud-mail-extension' || !payload.deviceId || !payload.userId) {
			throw new BizError('Extension authentication required', 401);
		}

		const row = await c.env.db.prepare(`
			SELECT device_id, user_id, name, scopes, expires_time, revoked
			FROM extension_device WHERE device_id = ? AND user_id = ?
		`).bind(payload.deviceId, payload.userId).first();
		if (!row || row.revoked || Date.parse(row.expires_time) <= Date.now()) {
			throw new BizError('Extension session expired', 401);
		}

		const scopes = JSON.parse(row.scopes || '[]');
		if (requiredScope && !scopes.includes(requiredScope)) {
			throw new BizError('Extension scope denied', 403);
		}

		const auth = { deviceId: row.device_id, userId: row.user_id, name: row.name, scopes };
		c.set('extensionAuth', auth);
		return auth;
	},

	async profile(c, auth) {
		const userRow = await userService.selectById(c, auth.userId);
		assertActiveUser(userRow);
		return { userId: userRow.userId, email: userRow.email, deviceId: auth.deviceId, scopes: auth.scopes };
	},

	async listDevices(c, auth) {
		const { results } = await c.env.db.prepare(`
			SELECT device_id, name, scopes, create_time, last_used_time, expires_time
			FROM extension_device
			WHERE user_id = ? AND revoked = 0
			ORDER BY last_used_time DESC, create_time DESC
		`).bind(auth.userId).all();
		return results.map(row => publicDevice(row, auth.deviceId));
	},

	async revokeDevice(c, auth, deviceId) {
		await c.env.db.prepare(`
			UPDATE extension_device SET revoked = 1, refresh_token_hash = ?
			WHERE device_id = ? AND user_id = ?
		`).bind(`revoked:${deviceId}`, deviceId, auth.userId).run();
		await c.env.db.prepare(`DELETE FROM extension_push_subscription WHERE device_id = ?`).bind(deviceId).run();
	}
};

export default extensionAuthService;
