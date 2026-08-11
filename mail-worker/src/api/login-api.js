import app from '../hono/hono';
import loginService from '../service/login-service';
import result from '../model/result';
import userContext from '../security/user-context';
import { clearSessionCookie, setSessionCookie } from '../security/session-cookie';
import { readJsonBody } from '../utils/email-input-utils';

app.post('/login', async (c) => {
	const token = await loginService.login(c, await readJsonBody(c));
	setSessionCookie(c, token);
	return c.json(result.ok());
});

app.post('/register', async (c) => {
	const jwt = await loginService.register(c, await readJsonBody(c));
	return c.json(result.ok(jwt));
});

app.delete('/logout', async (c) => {
	await loginService.logout(c, userContext.getUserId(c));
	clearSessionCookie(c);
	return c.json(result.ok());
});
