const SCRIPT_SOURCES = [
	"'self'",
	'https://challenges.cloudflare.com',
	'https://static.cloudflareinsights.com'
];

export function createContentSecurityPolicyNonce() {
	return crypto.randomUUID().replaceAll('-', '');
}

export function buildContentSecurityPolicy(nonce) {
	const scriptSources = [...SCRIPT_SOURCES, `'nonce-${nonce}'`].join(' ');

	return [
		"default-src 'self'",
		`script-src ${scriptSources}`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com data:",
		"img-src 'self' https: data: blob:",
		"connect-src 'self' https://api.github.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com https://challenges.cloudflare.com https://cloudflareinsights.com",
		'frame-src https://challenges.cloudflare.com',
		"worker-src 'self' blob:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests'
	].join('; ');
}
