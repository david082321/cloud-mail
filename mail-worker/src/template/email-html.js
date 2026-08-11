import { sanitizeEmailHtml } from '../utils/html-sanitizer';

export default function emailHtmlTemplate(html, attachmentBaseUrl) {
	const safeHtml = sanitizeEmailHtml(html).replace(/\{\{domain\}\}/g, `${attachmentBaseUrl}/`);
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="referrer" content="no-referrer">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; font-src https: data:; form-action 'none'; frame-src 'none'; base-uri 'none'">
	<style>
		html,body{box-sizing:border-box;margin:0;padding:8px;background:#fff;color:#13181d;font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;word-break:break-word}
		img{max-width:100%;height:auto}table{max-width:100%}a{color:#0e70df}
	</style>
</head>
<body>${safeHtml}</body>
</html>`;
}
