import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';
import {t} from '../i18n/i18n.js';
import { Resend } from 'resend';

const ALLOWED_EVENTS = new Set([
	'email.delivered', 'email.complained', 'email.bounced', 'email.delivery_delayed', 'email.failed'
]);

const resendService = {
	verify(c, payload) {
		if (!c.env.resend_webhook_secret) throw new BizError('Resend webhook verification is not configured', 503);
		const id = c.req.header('svix-id');
		const timestamp = c.req.header('svix-timestamp');
		const signature = c.req.header('svix-signature');
		if (!id || !timestamp || !signature) throw new BizError('Invalid webhook signature', 401);
		try {
			const resend = new Resend('re_webhook_verification_only');
			return {
				id,
				event: resend.webhooks.verify({
					payload,
					headers: { id, timestamp, signature },
					webhookSecret: c.env.resend_webhook_secret
				})
			};
		} catch {
			throw new BizError('Invalid webhook signature', 401);
		}
	},

	async webhooks(c, eventId, body) {
		if (!ALLOWED_EVENTS.has(body?.type) || !body?.data?.email_id) throw new BizError('Unsupported webhook event', 400);
		const duplicate = await c.env.db.prepare(`SELECT 1 AS processed FROM webhook_event WHERE event_id = ?`).bind(eventId).first();
		if (duplicate) return;

		const params = {
			resendEmailId: String(body.data.email_id).slice(0, 200),
			status: emailConst.status.SENT
		}

		if (body.type === 'email.delivered') {
			params.status = emailConst.status.DELIVERED
			params.message = null
		}

		if (body.type === 'email.complained') {
			params.status = emailConst.status.COMPLAINED
			params.message = null
		}

		if (body.type === 'email.bounced') {
			let bounce = body.data.bounce
			bounce = JSON.stringify(bounce);
			params.status = emailConst.status.BOUNCED
			params.message = bounce.slice(0, 4096)
		}

		if (body.type === 'email.delivery_delayed') {
			params.status = emailConst.status.DELAYED
			params.message = null
		}

		if (body.type === 'email.failed') {
			params.status = emailConst.status.FAILED
			params.message = String(body.data.failed?.reason || '').slice(0, 4096)
		}

		const emailRow = await emailService.updateEmailStatus(c, params)

		if (!emailRow) {
			throw new BizError(t('resendStatusUpdateFailed'));
		}

		await c.env.db.prepare(`INSERT OR IGNORE INTO webhook_event (event_id, event_type) VALUES (?, ?)`)
			.bind(eventId, body.type).run();

	},

	async cleanup(c) {
		await c.env.db.prepare(`DELETE FROM webhook_event WHERE create_time < datetime('now', '-30 days')`).run();
	}
}

export default resendService
