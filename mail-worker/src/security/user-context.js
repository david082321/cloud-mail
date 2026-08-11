import JwtUtils from '../utils/jwt-utils';
import constant from '../const/constant';
import { getCookie } from 'hono/cookie';

const userContext = {
	getUserId(c) {
		return c.get('user').userId;
	},

	getUser(c) {
		return c.get('user');
	},

	async getToken(c) {
		const jwt = this.getJwt(c);
		const result = await JwtUtils.verifyToken(c,jwt);
		return result?.token;
	},

	getJwt(c) {
		const header = c.req.header(constant.TOKEN_HEADER);
		if (header && header !== 'null' && header !== 'undefined') return header.replace(/^Bearer\s+/i, '');
		return getCookie(c, constant.SESSION_COOKIE) || '';
	}
};
export default userContext;
