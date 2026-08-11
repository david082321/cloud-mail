import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import emailUtils from '../utils/email-utils';
import roleService from './role-service';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n';
import reqUtils from '../utils/req-utils';
import dayjs from 'dayjs';
import { isDel, roleConst, userConst } from '../const/entity-const';
import email from '../entity/email';
import userService from './user-service';
import KvConst from '../const/kv-const';
import authRateLimitService from './auth-rate-limit-service';

const PUBLIC_TOKEN_TTL = 60 * 60;
const MAX_IMPORT_USERS = 10;

const publicService = {

	async emailList(c, params) {

		let { toEmail, content, subject, sendName, sendEmail, timeSort, num, size, type , isDel } = params || {}

		const query = orm(c).select({
				emailId: email.emailId,
				sendEmail: email.sendEmail,
				sendName: email.name,
				subject: email.subject,
				toEmail: email.toEmail,
				toName: email.toName,
				type: email.type,
				createTime: email.createTime,
				content: email.content,
				text: email.text,
				isDel: email.isDel,
		}).from(email)

		if (!size) {
			size = 20
		}

		if (!num) {
			num = 1
		}

		size = Math.min(100, Math.max(1, Number(size) || 20));
		num = Math.max(1, Number(num) || 1);

		num = (num - 1) * size;

		let conditions = []

		if (toEmail) {
			conditions.push(sql`${email.toEmail} COLLATE NOCASE LIKE ${toEmail}`)
		}

		if (sendEmail) {
			conditions.push(sql`${email.sendEmail} COLLATE NOCASE LIKE ${sendEmail}`)
		}

		if (sendName) {
			conditions.push(sql`${email.name} COLLATE NOCASE LIKE ${sendName}`)
		}

		if (subject) {
			conditions.push(sql`${email.subject} COLLATE NOCASE LIKE ${subject}`)
		}

		if (content) {
			conditions.push(sql`${email.content} COLLATE NOCASE LIKE ${content}`)
		}

		if (type || type === 0) {
			conditions.push(eq(email.type, type))
		}

		if (isDel || isDel === 0) {
			conditions.push(eq(email.isDel, isDel))
		}

		if (conditions.length === 1) {
			query.where(...conditions)
		} else if (conditions.length > 1) {
			query.where(and(...conditions))
		}

		if (timeSort === 'asc') {
			query.orderBy(asc(email.emailId));
		} else {
			query.orderBy(desc(email.emailId));
		}

		return query.limit(size).offset(num);

	},

	async addUser(c, params) {
		const list = params?.list;

		if (!Array.isArray(list) || list.length > MAX_IMPORT_USERS) throw new BizError(t('invalidParams'));
		if (list.length === 0) return;

		for (const emailRow of list) {
			if (!emailRow || typeof emailRow !== 'object') throw new BizError(t('invalidParams'));
			emailRow.email = String(emailRow.email || '').trim().toLowerCase();
			const suppliedPassword = emailRow.password == null || emailRow.password === '' ? null : String(emailRow.password);
			if (!verifyUtils.isEmail(emailRow.email)) {
				throw new BizError(t('notEmail'));
			}

			if (!c.env.domain.includes(emailUtils.getDomain(emailRow.email))) {
				throw new BizError(t('notEmailDomain'));
			}

			if (suppliedPassword && suppliedPassword.length < 12) throw new BizError(t('pwdMinLength'));
			if (suppliedPassword && suppliedPassword.length > 128) throw new BizError(t('pwdLengthLimit'));
			const { salt, hash } = await saltHashUtils.hashPassword(suppliedPassword || cryptoUtils.genRandomPwd());

			emailRow.salt = salt;
			emailRow.hash = hash;
		}


		const activeIp = reqUtils.getIp(c);
		const { os, browser, device } = reqUtils.getUserAgent(c);
		const activeTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

		const roleList = await roleService.roleSelectUse(c);
		const defRole = roleList.find(roleRow => roleRow.isDefault === roleConst.isDefault.OPEN);

		const userList = [];

		for (const emailRow of list) {
			let { email, hash, salt } = emailRow;
			const roleName = String(emailRow.roleName || '').slice(0, 100);
			let type = defRole.roleId;

			if (roleName) {
				const roleRow = roleList.find(role => role.name === roleName);
				type = roleRow ? roleRow.roleId : type;
			}

			userList.push(c.env.db.prepare(`
				INSERT INTO user (email, password, salt, type, os, browser, active_ip, create_ip, device, active_time, create_time)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(email, hash, salt, type, os, browser, activeIp, activeIp, device, activeTime, activeTime));
			userList.push(c.env.db.prepare(`
				INSERT INTO account (email, name, user_id) VALUES (?, ?, 0)
			`).bind(email, emailUtils.getName(email)));

		}

		userList.push(c.env.db.prepare(`UPDATE account SET user_id = (SELECT user_id FROM user WHERE user.email = account.email) WHERE user_id = 0;`))

		try {
			await c.env.db.batch(userList);
		} catch (e) {
			if(e.message.includes('SQLITE_CONSTRAINT')) {
				throw new BizError(t('emailExistDatabase'))
			} else {
				throw e
			}
		}

	},

	async genToken(c, params) {

		await this.verifyUser(c, params)

		const uuid = crypto.randomUUID();

		await c.env.kv.put(KvConst.PUBLIC_KEY, uuid, { expirationTtl: PUBLIC_TOKEN_TTL });

		return {token: uuid}
	},

	async verifyUser(c, params) {

		const email = String(params?.email || '').trim().toLowerCase();
		const password = String(params?.password || '');
		await authRateLimitService.assertAllowed(c, email);

		const userRow = await userService.selectByEmailIncludeDel(c, email);
		let passwordValid = false;
		if (userRow && password.length <= 128) {
			passwordValid = await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password);
		} else {
			await cryptoUtils.hashPassword(password.slice(0, 128) || 'invalid-password');
		}
		const accountActive = userRow && userRow.isDel !== isDel.DELETE && userRow.status !== userConst.status.BAN;
		if (email !== String(c.env.admin || '').toLowerCase() || !passwordValid || !accountActive) {
			await authRateLimitService.recordFailure(c, email);
			throw new BizError(t('loginFailed'), 401);
		}
		await authRateLimitService.clear(c, email);
	}

}

export default publicService
