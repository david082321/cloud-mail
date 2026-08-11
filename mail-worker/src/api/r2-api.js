import r2Service from '../service/r2-service';
import app from '../hono/hono';
import attService from '../service/att-service';
import userContext from '../security/user-context';
import BizError from '../error/biz-error';

const SAFE_INLINE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const safeFilename = value => String(value || 'attachment').replace(/[\r\n"\\/\x00-\x1F\x7F]/g, '_').slice(0, 180) || 'attachment';

app.get('/oss/*', async (c) => {
	const key = c.req.path.split('/oss/')[1];
	if (!key || !key.startsWith('attachments/')) throw new BizError('Attachment not found', 404);
	const currentUser = userContext.getUser(c);
	const attachment = await attService.selectAuthorizedByKey(c, key, currentUser.userId, currentUser.email === c.env.admin);
	if (!attachment) throw new BizError('Attachment not found', 404);
	const obj = await r2Service.getObj(c, key);
	if (!obj) throw new BizError('Attachment not found', 404);
	const requestedMime = String(attachment.mimeType || '').toLowerCase();
	const inline = SAFE_INLINE_MIME.has(requestedMime) && c.req.query('download') !== '1';
	const body = obj instanceof Response ? obj.body : obj.body;
	return new Response(body, {
		headers: {
			'Content-Type': inline ? requestedMime : 'application/octet-stream',
			'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeFilename(attachment.filename)}"`,
			'Cache-Control': 'private, max-age=300',
			'Content-Security-Policy': "sandbox; default-src 'none'",
			'X-Content-Type-Options': 'nosniff',
			'Referrer-Policy': 'no-referrer'
		}
	});
});

