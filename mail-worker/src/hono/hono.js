import { Hono } from 'hono';
const app = new Hono();

import result from '../model/result';
import { cors } from 'hono/cors';
import {i18nMiddleware, t} from '../i18n/i18n.js';
import { isAllowedOrigin } from '../utils/origin-utils';

app.use('*', cors({
	origin: (origin, c) => isAllowedOrigin(origin, c) ? origin : null,
	allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
	allowHeaders: ['Authorization', 'Content-Type', 'Accept-Language'],
	exposeHeaders: ['X-Request-Id'],
	credentials: true,
	maxAge: 86400
}));
app.use('*', i18nMiddleware);
app.use('*', async (c, next) => {
	const origin = c.req.header('origin');
	const unsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
	if (unsafeMethod && origin && !isAllowedOrigin(origin, c)) {
		return c.json(result.fail(t('unauthorized'), 403), 403);
	}
	await next();
	c.header('X-Content-Type-Options', 'nosniff');
	c.header('Referrer-Policy', 'no-referrer');
	c.header('X-Frame-Options', 'DENY');
});

app.onError((err, c) => {
	const requestId = crypto.randomUUID();
	c.header('X-Request-Id', requestId);
	if (err.name === 'BizError') {
		console.warn(`[${requestId}] ${err.message}`);
	} else {
		console.error(`[${requestId}]`, err);
	}

	if (err.message === `Cannot read properties of undefined (reading 'get')`) {
		return c.json(result.fail(t('kvNotBound'),502), 502);
	}

	if (err.message === `Cannot read properties of undefined (reading 'put')`) {
		return c.json(result.fail(t('kvNotBound'),502), 502);
	}

	if (err.message === `Cannot read properties of undefined (reading 'prepare')`) {
		return c.json(result.fail(t('d1NotBound'),502), 502);
	}

	if (err.name === 'BizError') return c.json(result.fail(err.message, err.code), err.code >= 400 && err.code <= 599 ? err.code : 400);
	return c.json(result.fail(t('serverError'), 500), 500);
});

export default app;
