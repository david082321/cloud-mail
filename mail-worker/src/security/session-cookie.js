import { deleteCookie, setCookie } from 'hono/cookie';
import constant from '../const/constant';

const cookieOptions = c => ({
	httpOnly: true,
	secure: new URL(c.req.url).protocol === 'https:',
	sameSite: 'Strict',
	path: '/',
	maxAge: constant.TOKEN_EXPIRE
});

export function setSessionCookie(c, token) {
	setCookie(c, constant.SESSION_COOKIE, token, cookieOptions(c));
}

export function clearSessionCookie(c) {
	deleteCookie(c, constant.SESSION_COOKIE, cookieOptions(c));
}
