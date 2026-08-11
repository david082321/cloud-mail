function configuredOrigins(env) {
	const value = env?.cors_origins;
	if (Array.isArray(value)) return value;
	if (typeof value !== 'string' || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : value.split(',');
	} catch {
		return value.split(',');
	}
}

export function isAllowedOrigin(origin, c) {
	if (!origin) return false;
	if (origin.startsWith('chrome-extension://')) return true;
	const requestOrigin = new URL(c.req.url).origin;
	if (origin === requestOrigin) return true;
	return configuredOrigins(c.env).map(item => String(item).trim()).includes(origin);
}
