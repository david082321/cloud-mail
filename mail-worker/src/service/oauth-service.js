import BizError from "../error/biz-error";
import orm from "../entity/orm";
import {oauth} from "../entity/oauth";
import { eq, inArray } from 'drizzle-orm';
import userService from "./user-service";
import loginService from "./login-service";
import cryptoUtils from "../utils/crypto-utils";
import {t} from '../i18n/i18n.js';
import { randomBase64Url, sha256Base64Url } from '../utils/extension-utils';

const oauthService = {

	async bindUser(c, params) {

		const { email, bindGrant, code } = params;
		if (!bindGrant) throw new BizError(t('oauthGrantInvalid'), 401);
		const grantHash = await sha256Base64Url(bindGrant);
		const transaction = await c.env.db.prepare(`
			UPDATE oauth_bind_transaction
			SET used = 1
			WHERE grant_hash = ? AND used = 0 AND expires_time > CURRENT_TIMESTAMP
			RETURNING oauth_user_id
		`).bind(grantHash).first();
		if (!transaction) throw new BizError(t('oauthGrantInvalid'), 401);

		const oauthRow = await this.getById(c, transaction.oauth_user_id);
		if (!oauthRow) throw new BizError(t('oauthGrantInvalid'), 401);

		let userRow = await userService.selectByIdIncludeDel(c, oauthRow.userId);

		if (userRow) {
			throw new BizError(t('oauthAlreadyBound'))
		}

		await loginService.register(c, { email, password: cryptoUtils.genRandomPwd(), code }, true);

		userRow = await userService.selectByEmail(c, email);

		await orm(c).update(oauth).set({ userId: userRow.userId }).where(eq(oauth.oauthUserId, transaction.oauth_user_id)).run();
		const jwtToken = await loginService.login(c, { email, password: null }, true);

		return { userInfo: this.publicUser(oauthRow), token: jwtToken}
	},

	async linuxDoLogin(c, params) {

		const code = String(params?.code || '');
		const codeVerifier = String(params?.codeVerifier || '');
		if (!code || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) throw new BizError(t('oauthGrantInvalid'), 400);

		let token = '';
		let userInfo = {}

		const reqParams = new URLSearchParams()
		reqParams.append('client_id', c.env.linuxdo_client_id)
		reqParams.append('client_secret', c.env.linuxdo_client_secret)
		reqParams.append('code', code)
		reqParams.append('redirect_uri', c.env.linuxdo_callback_url)
		reqParams.append('grant_type', 'authorization_code')
		reqParams.append('code_verifier', codeVerifier)

		const tokenRes = await fetch("https://connect.linux.do/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: reqParams.toString()
		})

		if (!tokenRes.ok) {
			throw new BizError(tokenRes.statusText)
		}

		token = await tokenRes.json()

		const userRes = await fetch('https://connect.linux.do/api/user', {
			headers: {
				Authorization: 'Bearer ' + token.access_token
			}
		});

		if (!userRes.ok) {
			throw new BizError(userRes.statusText)
		}

		userInfo = await userRes.json();

		userInfo.oauthUserId = String(userInfo.id);
		userInfo.active = userInfo.active ? 0 : 1;
		userInfo.silenced = userInfo.silenced ? 0 : 1;
		userInfo.trustLevel = userInfo.trust_level;
		userInfo.avatar = userInfo.avatar_url;

		const  oauthRow = await this.saveUser(c, userInfo);
		const userRow = await userService.selectByIdIncludeDel(c, oauthRow.userId);

		if (!userRow) {
			const bindGrant = randomBase64Url();
			const grantHash = await sha256Base64Url(bindGrant);
			await c.env.db.prepare(`
				INSERT INTO oauth_bind_transaction (grant_hash, oauth_user_id, expires_time)
				VALUES (?, ?, datetime('now', '+10 minutes'))
			`).bind(grantHash, oauthRow.oauthUserId).run();
			return { userInfo: this.publicUser(oauthRow), bindGrant, token: null }
		}

		const JwtToken = await loginService.login(c, { email: userRow.email, password: null }, true);
		return { userInfo: this.publicUser(oauthRow), bindGrant: null, token: JwtToken }
	},

	async saveUser(c, userInfo) {

		const userInfoRow = await this.getById(c, userInfo.oauthUserId);

		if (!userInfoRow) {
			return await orm(c).insert(oauth).values(userInfo).returning().get();
		} else {
			return await orm(c).update(oauth).set(userInfo).where(eq(oauth.oauthUserId, userInfo.oauthUserId)).returning().get();
		}

	},

	async getById(c, oauthUserId) {
		return await orm(c).select().from(oauth).where(eq(oauth.oauthUserId, oauthUserId)).get();
	},

	async deleteByUserId(c, userId) {
		await this.deleteByUserIds(c, [userId]);
	},

	async deleteByUserIds(c, userIds) {
		await orm(c).delete(oauth).where(inArray(oauth.userId, userIds)).run();
	},

	//定时任务凌晨清除未绑定邮箱的oauth用户
	async clearNoBindOathUser(c) {
		await orm(c).delete(oauth).where(eq(oauth.userId, 0)).run();
		await c.env.db.prepare(`DELETE FROM oauth_bind_transaction WHERE used = 1 OR expires_time <= CURRENT_TIMESTAMP`).run();
	},

	publicUser(row) {
		return {
			username: row.username,
			name: row.name,
			avatar: row.avatar,
			trustLevel: row.trustLevel
		};
	},

}

export default  oauthService
