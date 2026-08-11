import app from '../hono/hono';
import telegramService from '../service/telegram-service';

app.get('/telegram/getEmail/:token', async (c) => {
	const content = await telegramService.getEmailContent(c, c.req.param());
	c.header('Cache-Control', 'private, no-store');
	c.header('Content-Security-Policy', "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; font-src https: data:; form-action 'none'; frame-src 'none'; base-uri 'none'");
	return c.html(content)
});

app.get('/telegram/attachment/:token/*', async (c) => {
	const marker = `/telegram/attachment/${c.req.param('token')}/`;
	const key = c.req.path.slice(c.req.path.indexOf(marker) + marker.length);
	const response = await telegramService.getAttachment(c, c.req.param('token'), key);
	return response || c.notFound();
});
