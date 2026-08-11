import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import userContext from '../security/user-context';
import attService from '../service/att-service';
import { readJsonBody, validateSendEmailInput } from '../utils/email-input-utils';

app.get('/email/list', async (c) => {
	const data = await emailService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.get('/email/latest', async (c) => {
	const list = await emailService.latest(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.delete('/email/delete', async (c) => {
	await emailService.delete(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/email/attList', async (c) => {
	const attList = await attService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(attList));
});

app.post('/email/send', async (c) => {
	const params = validateSendEmailInput(await readJsonBody(c, 30 * 1024 * 1024));
	const email = await emailService.send(c, params, userContext.getUserId(c));
	return c.json(result.ok(email));
});

app.put('/email/read', async (c) => {
	await emailService.read(c, await readJsonBody(c), userContext.getUserId(c));
	return c.json(result.ok());
})
