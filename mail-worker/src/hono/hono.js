import { Hono } from 'hono';
const app = new Hono();

import result from '../model/result';
import { cors } from 'hono/cors';
import {i18nMiddleware, t} from '../i18n/i18n.js';

app.use('*', cors());
app.use('*', i18nMiddleware);

app.onError((err, c) => {
	if (err.name === 'BizError') {
		console.log(err.message);
	} else {
		console.error(err);
	}

	if (err.message === `Cannot read properties of undefined (reading 'get')`) {
		return c.json(result.fail(t('kvNotBound'),502));
	}

	if (err.message === `Cannot read properties of undefined (reading 'put')`) {
		return c.json(result.fail(t('kvNotBound'),502));
	}

	if (err.message === `Cannot read properties of undefined (reading 'prepare')`) {
		return c.json(result.fail(t('d1NotBound'),502));
	}

	return c.json(result.fail(err.message, err.code));
});

export default app;

