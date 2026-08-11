import app from '../hono/hono';
import result from '../model/result';
import publicService from '../service/public-service';
import { readJsonBody } from '../utils/email-input-utils';

app.post('/public/genToken', async (c) => {
	const data = await publicService.genToken(c, await readJsonBody(c));
	return c.json(result.ok(data));
});

app.post('/public/emailList', async (c) => {
	const list = await publicService.emailList(c, await readJsonBody(c));
	return c.json(result.ok(list));
});

app.post('/public/addUser', async (c) => {
	await publicService.addUser(c, await readJsonBody(c, 1024 * 1024));
	return c.json(result.ok());
});
