import { parseHTML } from 'linkedom';

const ALLOWED_TAGS = new Set([
	'a', 'abbr', 'address', 'b', 'blockquote', 'br', 'caption', 'code', 'col',
	'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4',
	'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'q', 's', 'small',
	'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
	'thead', 'tr', 'u', 'ul'
]);

const GLOBAL_ATTRIBUTES = new Set(['dir', 'lang', 'title']);
const TAG_ATTRIBUTES = {
	a: new Set(['href']),
	img: new Set(['alt', 'height', 'src', 'width']),
	col: new Set(['span', 'width']),
	td: new Set(['align', 'colspan', 'rowspan', 'valign', 'width']),
	th: new Set(['align', 'colspan', 'rowspan', 'scope', 'valign', 'width']),
	table: new Set(['cellpadding', 'cellspacing', 'width'])
};

const SAFE_DATA_IMAGE = /^data:image\/(?:png|gif|jpe?g|webp);base64,/i;
const SAFE_MAIL_IMAGE = /^\{\{domain\}\}attachments\/[A-Za-z0-9._/-]+$/;

function normalizeUrl(value) {
	return String(value || '').replace(/[\u0000-\u001F\u007F\s]+/g, '').trim();
}

function isSafeUrl(value, tag, attribute) {
	const normalized = normalizeUrl(value);
	if (!normalized) return false;
	if (normalized.startsWith('#')) return attribute === 'href';
	if (attribute === 'src' && (SAFE_DATA_IMAGE.test(normalized) || SAFE_MAIL_IMAGE.test(normalized))) {
		return true;
	}
	try {
		const url = new URL(normalized, 'https://mail.invalid');
		if (url.origin === 'https://mail.invalid') return normalized.startsWith('/');
		if (attribute === 'href') return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
		return tag === 'img' && ['http:', 'https:'].includes(url.protocol);
	} catch {
		return false;
	}
}

function sanitizeElement(element) {
	const tag = element.localName?.toLowerCase();
	if (!ALLOWED_TAGS.has(tag)) {
		if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'base', 'link', 'svg', 'math'].includes(tag)) {
			element.remove();
			return;
		}
		element.replaceWith(...element.childNodes);
		return;
	}

	for (const attribute of [...element.attributes]) {
		const name = attribute.name.toLowerCase();
		const allowed = GLOBAL_ATTRIBUTES.has(name) || TAG_ATTRIBUTES[tag]?.has(name);
		if (!allowed || name.startsWith('on') || name.includes(':')) {
			element.removeAttribute(attribute.name);
			continue;
		}
		if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value, tag, name)) {
			element.removeAttribute(attribute.name);
		}
	}

	if (tag === 'a' && element.hasAttribute('href')) {
		element.setAttribute('target', '_blank');
		element.setAttribute('rel', 'noopener noreferrer nofollow');
	}
	if (tag === 'img' && element.hasAttribute('src')) {
		element.setAttribute('loading', 'lazy');
		element.setAttribute('referrerpolicy', 'no-referrer');
	}
}

export function sanitizeEmailHtml(html) {
	if (!html) return '';
	const source = String(html).slice(0, 2 * 1024 * 1024);
	const { document } = parseHTML(`<!doctype html><html><body>${source}</body></html>`);
	const root = document.body;
	if (!root) return '';

	for (const element of [...root.querySelectorAll('*')]) sanitizeElement(element);
	return root.innerHTML;
}

export function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
