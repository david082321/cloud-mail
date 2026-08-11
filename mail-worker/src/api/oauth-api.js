import app from '../hono/hono';
import result from "../model/result";
import oauthService from "../service/oauth-service";
import { readJsonBody } from '../utils/email-input-utils';
import { setSessionCookie } from '../security/session-cookie';

app.post('/oauth/linuxDo/login', async (c) => {
	const loginInfo = await oauthService.linuxDoLogin(c, await readJsonBody(c));
	if (loginInfo.token) setSessionCookie(c, loginInfo.token);
	delete loginInfo.token;
	return c.json(result.ok(loginInfo))
});

app.put('/oauth/bindUser', async (c) => {
	const loginInfo = await oauthService.bindUser(c, await readJsonBody(c));
	setSessionCookie(c, loginInfo.token);
	delete loginInfo.token;
	return c.json(result.ok(loginInfo))
})
