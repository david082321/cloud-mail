import BizError from '../error/biz-error';
import emailService from './email-service';
import permService from './perm-service';
import userService from './user-service';
import verifyUtils from '../utils/verify-utils';
import { emailConst, isDel } from '../const/entity-const';

function positiveInteger(value, fallback = 0) {
	const number = Number(value);
	return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

async function assertAccount(c, userId, accountId) {
	if (!accountId) return;
	const row = await c.env.db.prepare(`
		SELECT account_id FROM account
		WHERE account_id = ? AND user_id = ? AND is_del = ?
	`).bind(accountId, userId, isDel.NORMAL).first();
	if (!row) throw new BizError('Mailbox not found', 404);
}

const extensionMailService = {
	async accounts(c, userId) {
		const { results } = await c.env.db.prepare(`
			SELECT account_id AS accountId, email, name, all_receive AS allReceive,
				sort, create_time AS createTime
			FROM account
			WHERE user_id = ? AND is_del = ?
			ORDER BY sort DESC, account_id ASC
		`).bind(userId, isDel.NORMAL).all();
		return results;
	},

	async sync(c, userId, params) {
		const cursor = positiveInteger(params?.cursor);
		const accountId = positiveInteger(params?.accountId);
		const size = Math.min(50, positiveInteger(params?.size, 30));
		await assertAccount(c, userId, accountId);

		const accountCondition = accountId ? ' AND e.account_id = ?' : '';
		const query = cursor
			? `SELECT e.email_id AS emailId, e.account_id AS accountId, a.email AS accountEmail,
				e.send_email AS sendEmail, e.name, e.subject, e.text, e.code,
				e.unread, e.create_time AS createTime
				FROM email e JOIN account a ON a.account_id = e.account_id
				WHERE e.user_id = ? AND e.email_id > ? AND e.type = ? AND e.is_del = ?
					AND a.is_del = ?${accountCondition}
				ORDER BY e.email_id ASC LIMIT ?`
			: `SELECT e.email_id AS emailId, e.account_id AS accountId, a.email AS accountEmail,
				e.send_email AS sendEmail, e.name, e.subject, e.text, e.code,
				e.unread, e.create_time AS createTime
				FROM email e JOIN account a ON a.account_id = e.account_id
				WHERE e.user_id = ? AND e.type = ? AND e.is_del = ?
					AND a.is_del = ?${accountCondition}
				ORDER BY e.email_id DESC LIMIT ?`;

		const values = cursor
			? [userId, cursor, emailConst.type.RECEIVE, isDel.NORMAL, isDel.NORMAL]
			: [userId, emailConst.type.RECEIVE, isDel.NORMAL, isDel.NORMAL];
		if (accountId) values.push(accountId);
		values.push(size + 1);

		const { results } = await c.env.db.prepare(query).bind(...values).all();
		const hasMore = results.length > size;
		let list = results.slice(0, size);
		if (!cursor) list = list.reverse();

		const countValues = [userId, emailConst.type.RECEIVE, isDel.NORMAL, emailConst.unread.UNREAD, isDel.NORMAL];
		if (accountId) countValues.push(accountId);
		const unreadRow = await c.env.db.prepare(`
			SELECT COUNT(*) AS total
			FROM email e JOIN account a ON a.account_id = e.account_id
			WHERE e.user_id = ? AND e.type = ? AND e.is_del = ? AND e.unread = ?
				AND a.is_del = ?${accountCondition}
		`).bind(...countValues).first();

		const latestCursor = list.reduce((max, item) => Math.max(max, item.emailId), cursor);
		return { list, cursor: latestCursor, hasMore, unreadCount: Number(unreadRow?.total || 0) };
	},

	async detail(c, userId, emailId) {
		const row = await c.env.db.prepare(`
			SELECT e.email_id AS emailId, e.account_id AS accountId, a.email AS accountEmail,
				e.send_email AS sendEmail, e.name, e.subject, e.text, e.code,
				e.cc, e.bcc, e.recipient, e.unread, e.create_time AS createTime
			FROM email e JOIN account a ON a.account_id = e.account_id
			WHERE e.email_id = ? AND e.user_id = ? AND e.type = ?
				AND e.is_del = ? AND a.is_del = ?
		`).bind(emailId, userId, emailConst.type.RECEIVE, isDel.NORMAL, isDel.NORMAL).first();
		if (!row) throw new BizError('Email not found', 404);
		return row;
	},

	async markRead(c, userId, emailIds) {
		const ids = [...new Set((Array.isArray(emailIds) ? emailIds : [emailIds])
			.map(value => positiveInteger(value)).filter(Boolean))].slice(0, 100);
		if (!ids.length) return;
		const placeholders = ids.map(() => '?').join(',');
		await c.env.db.prepare(`
			UPDATE email SET unread = ?
			WHERE user_id = ? AND email_id IN (${placeholders})
		`).bind(emailConst.unread.READ, userId, ...ids).run();
	},

	async send(c, userId, params) {
		const accountId = positiveInteger(params?.accountId);
		if (!accountId) throw new BizError('Sender mailbox is required', 400);
		await assertAccount(c, userId, accountId);
		const recipients = (Array.isArray(params?.receiveEmail) ? params.receiveEmail : String(params?.receiveEmail || '').split(','))
			.map(value => String(value).trim()).filter(Boolean);
		if (!recipients.length || recipients.length > 20 || recipients.some(email => !verifyUtils.isEmail(email))) {
			throw new BizError('One to twenty valid recipients are required', 400);
		}

		const userRow = await userService.selectById(c, userId);
		const permissions = userRow.email === c.env.admin ? ['*'] : await permService.userPermKeys(c, userId);
		if (!permissions.includes('*') && !permissions.includes('email:send')) {
			throw new BizError('Email sending permission denied', 403);
		}

		const text = String(params?.text || '').slice(0, 100000);
		const subject = String(params?.subject || '').slice(0, 500);
		const content = `<p>${escapeHtml(text).replace(/\r?\n/g, '<br>')}</p>`;
		return emailService.send(c, {
			accountId,
			name: String(params?.name || '').slice(0, 100),
			sendType: 'new',
			receiveEmail: recipients,
			text,
			content,
			subject,
			attachments: []
		}, userId);
	}
};

export default extensionMailService;
