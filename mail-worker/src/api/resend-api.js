import resendService from '../service/resend-service';
import app from '../hono/hono';
app.post('/webhooks',async (c) => {
	const payload = await c.req.text();
	if (new TextEncoder().encode(payload).byteLength > 1024 * 1024) return c.text('Payload too large', 413);
	const { id, event } = resendService.verify(c, payload);
	await resendService.webhooks(c, id, event);
	return c.text('success', 200)
})
