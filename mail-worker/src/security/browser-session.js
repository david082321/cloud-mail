import jwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import userContext from './user-context';

export async function resolveBrowserSession(c) {
	const jwt = userContext.getJwt(c);
	if (!jwt) return null;

	const result = await jwtUtils.verifyToken(c, jwt);
	if (!result) return null;

	const { userId, token } = result;
	const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });
	if (!authInfo || !Array.isArray(authInfo.tokens) || !authInfo.tokens.includes(token)) return null;

	return { userId, token, authInfo };
}
