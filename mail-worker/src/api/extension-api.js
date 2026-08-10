import app from '../hono/hono';
import result from '../model/result';
import BizError from '../error/biz-error';
import extensionAuthService from '../service/extension-auth-service';
import extensionMailService from '../service/extension-mail-service';
import extensionPushService from '../service/extension-push-service';
import { EXTENSION_SCOPES } from '../utils/extension-utils';

async function jsonBody(c) {
	try {
		return await c.req.json();
	} catch {
		throw new BizError('Invalid JSON body', 400);
	}
}

app.post('/extension/auth/login', async c => {
	return c.json(result.ok(await extensionAuthService.login(c, await jsonBody(c))));
});
app.post('/extension/auth/refresh', async c => {
	return c.json(result.ok(await extensionAuthService.refresh(c, await jsonBody(c))));
});

app.get('/extension/profile', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	return c.json(result.ok(await extensionAuthService.profile(c, auth)));
});

app.get('/extension/devices', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	return c.json(result.ok(await extensionAuthService.listDevices(c, auth)));
});

app.delete('/extension/devices/:deviceId', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	await extensionAuthService.revokeDevice(c, auth, c.req.param('deviceId'));
	return c.json(result.ok());
});

app.get('/extension/config', async c => {
	await extensionAuthService.authenticate(c, EXTENSION_SCOPES.NOTIFY);
	return c.json(result.ok(extensionPushService.config(c.env)));
});

app.get('/extension/accounts', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	return c.json(result.ok(await extensionMailService.accounts(c, auth.userId)));
});

app.get('/extension/sync', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	return c.json(result.ok(await extensionMailService.sync(c, auth.userId, c.req.query())));
});

app.get('/extension/emails/:emailId', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	const emailId = Number(c.req.param('emailId'));
	if (!Number.isSafeInteger(emailId) || emailId < 1) throw new BizError('Invalid email id', 400);
	return c.json(result.ok(await extensionMailService.detail(c, auth.userId, emailId)));
});

app.put('/extension/emails/read', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.READ);
	const body = await jsonBody(c);
	await extensionMailService.markRead(c, auth.userId, body.emailIds);
	return c.json(result.ok());
});

app.delete('/extension/emails/:emailId', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.DELETE);
	const emailId = Number(c.req.param('emailId'));
	if (!Number.isSafeInteger(emailId) || emailId < 1) throw new BizError('Invalid email id', 400);
	await extensionMailService.delete(c, auth.userId, emailId);
	return c.json(result.ok());
});

app.post('/extension/emails/send', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.SEND);
	return c.json(result.ok(await extensionMailService.send(c, auth.userId, await jsonBody(c))));
});

app.post('/extension/push-subscriptions', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.NOTIFY);
	await extensionPushService.subscribe(c, auth, await jsonBody(c));
	return c.json(result.ok());
});

app.delete('/extension/push-subscriptions', async c => {
	const auth = await extensionAuthService.authenticate(c, EXTENSION_SCOPES.NOTIFY);
	const body = await jsonBody(c);
	await extensionPushService.unsubscribe(c, auth, String(body.endpoint || ''));
	return c.json(result.ok());
});
