import { describe, expect, it } from 'vitest';
import cryptoUtils from '../src/utils/crypto-utils';
import { escapeHtml, sanitizeEmailHtml } from '../src/utils/html-sanitizer';
import { validateSendEmailInput } from '../src/utils/email-input-utils';
import { buildContentSecurityPolicy, createContentSecurityPolicyNonce } from '../src/security/content-security-policy';

describe('security utilities', () => {
	it('removes executable email markup and preserves safe content', () => {
		const html = `<div style="background:url(javascript:alert(1))" onclick="alert(1)">
			<script>alert(1)</script><svg onload="alert(1)"></svg>
			<a href="javascript:alert(1)">bad</a><a href="https://example.com/a">safe</a>
			<img src="{{domain}}attachments/abc.png" onerror="alert(1)">
		</div>`;
		const sanitized = sanitizeEmailHtml(html);
		expect(sanitized).not.toMatch(/script|svg|onclick|onerror|javascript|style=/i);
		expect(sanitized).toContain('https://example.com/a');
		expect(sanitized).toContain('{{domain}}attachments/abc.png');
		expect(sanitized).toContain('rel="noopener noreferrer nofollow"');
	});

	it('escapes plain-text templates', () => {
		expect(escapeHtml(`<img src=x onerror='x'>`)).toBe('&lt;img src=x onerror=&#39;x&#39;&gt;');
	});

	it('uses an iterated password hash and verifies legacy hashes for migration', async () => {
		const password = 'correct horse battery staple';
		const { salt, hash } = await cryptoUtils.hashPassword(password);
		expect(hash).toMatch(/^pbkdf2-sha256\$100000\$/);
		expect(await cryptoUtils.verifyPassword(password, salt, hash)).toBe(true);
		expect(await cryptoUtils.verifyPassword('wrong password', salt, hash)).toBe(false);
		expect(await cryptoUtils.verifyPassword(password, salt, 'pbkdf2-sha256$600000$invalid')).toBe(false);

		const legacy = await cryptoUtils.genHashPassword(password, salt);
		expect(await cryptoUtils.verifyPassword(password, salt, legacy)).toBe(true);
		expect(cryptoUtils.needsRehash(legacy)).toBe(true);
	});

	it('rejects malformed or oversized outbound email input', () => {
		expect(() => validateSendEmailInput({ accountId: 1, receiveEmail: [], content: '', text: '', attachments: [] })).toThrow();
		expect(() => validateSendEmailInput({
			accountId: 1,
			receiveEmail: ['user@example.com'],
			content: '',
			text: '',
			attachments: [{ filename: 'bad.bin', content: 'not base64!' }]
		})).toThrow();
	});

	it('uses a per-response nonce while allowing required Cloudflare scripts', () => {
		const firstNonce = createContentSecurityPolicyNonce();
		const secondNonce = createContentSecurityPolicyNonce();
		const policy = buildContentSecurityPolicy(firstNonce);
		const scriptDirective = policy.split('; ').find(value => value.startsWith('script-src '));

		expect(firstNonce).toMatch(/^[0-9a-f]{32}$/);
		expect(secondNonce).not.toBe(firstNonce);
		expect(scriptDirective).toContain(`'nonce-${firstNonce}'`);
		expect(scriptDirective).toContain('https://challenges.cloudflare.com');
		expect(scriptDirective).toContain('https://static.cloudflareinsights.com');
		expect(scriptDirective).not.toContain("'unsafe-inline'");
		expect(policy).toContain('https://cloudflareinsights.com');
	});
});
