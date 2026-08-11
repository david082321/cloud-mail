import BizError from '../error/biz-error';
import verifyUtils from './verify-utils';

export const EMAIL_LIMITS = Object.freeze({
	maxRecipients: 50,
	maxSubjectChars: 998,
	maxBodyBytes: 2 * 1024 * 1024,
	maxAttachments: 10,
	maxAttachmentBytes: 10 * 1024 * 1024,
	maxTotalAttachmentBytes: 20 * 1024 * 1024,
	maxFilenameChars: 255
});

const byteLength = value => new TextEncoder().encode(String(value || '')).byteLength;

function estimatedBase64Bytes(value) {
	if (typeof value !== 'string') return Number.POSITIVE_INFINITY;
	const encoded = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
	const compact = encoded.replace(/\s+/g, '');
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return Number.POSITIVE_INFINITY;
	return Math.max(0, Math.floor(compact.length * 3 / 4) - (compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0));
}

export async function readJsonBody(c, maxBytes = 32 * 1024) {
	const declared = Number(c.req.header('content-length') || 0);
	if (declared > maxBytes) throw new BizError('Request body is too large', 413);
	const raw = await c.req.text();
	if (byteLength(raw) > maxBytes) throw new BizError('Request body is too large', 413);
	try {
		return JSON.parse(raw || '{}');
	} catch {
		throw new BizError('Invalid JSON body', 400);
	}
}

export function validateSendEmailInput(params) {
	if (!params || typeof params !== 'object' || Array.isArray(params)) {
		throw new BizError('Invalid email payload', 400);
	}

	const receiveEmail = Array.isArray(params.receiveEmail)
		? [...new Set(params.receiveEmail.map(item => String(item || '').trim().toLowerCase()))]
		: [];
	if (!receiveEmail.length || receiveEmail.length > EMAIL_LIMITS.maxRecipients || receiveEmail.some(item => !verifyUtils.isEmail(item))) {
		throw new BizError(`Recipients must contain 1-${EMAIL_LIMITS.maxRecipients} valid email addresses`, 400);
	}

	const subject = String(params.subject || '');
	const content = String(params.content || '');
	const text = String(params.text || '');
	if (subject.length > EMAIL_LIMITS.maxSubjectChars) throw new BizError('Email subject is too long', 413);
	if (byteLength(content) + byteLength(text) > EMAIL_LIMITS.maxBodyBytes) throw new BizError('Email body is too large', 413);

	const accountId = Number(params.accountId);
	if (!Number.isSafeInteger(accountId) || accountId < 1) throw new BizError('Invalid sender account', 400);
	if (params.emailId != null && params.emailId !== '' && (!Number.isSafeInteger(Number(params.emailId)) || Number(params.emailId) < 1)) {
		throw new BizError('Invalid reply email id', 400);
	}

	const attachments = params.attachments == null ? [] : params.attachments;
	if (!Array.isArray(attachments) || attachments.length > EMAIL_LIMITS.maxAttachments) {
		throw new BizError(`The maximum number of attachments is ${EMAIL_LIMITS.maxAttachments}`, 413);
	}
	let totalAttachmentBytes = 0;
	for (const attachment of attachments) {
		if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) throw new BizError('Invalid attachment', 400);
		const filename = String(attachment.filename || '').trim();
		if (!filename || filename.length > EMAIL_LIMITS.maxFilenameChars) throw new BizError('Invalid attachment filename', 400);
		const size = estimatedBase64Bytes(attachment.content);
		if (!Number.isFinite(size) || size > EMAIL_LIMITS.maxAttachmentBytes) throw new BizError('Attachment is too large or malformed', 413);
		totalAttachmentBytes += size;
	}
	if (totalAttachmentBytes > EMAIL_LIMITS.maxTotalAttachmentBytes) throw new BizError('Total attachment size is too large', 413);

	return {
		...params,
		accountId,
		emailId: params.emailId == null || params.emailId === '' ? undefined : Number(params.emailId),
		name: String(params.name || '').slice(0, 200),
		sendType: params.sendType === 'reply' ? 'reply' : 'new',
		receiveEmail,
		subject,
		content,
		text,
		attachments
	};
}
