import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
import authRateLimitService from './service/auth-rate-limit-service';
import resendService from './service/resend-service';
import { buildContentSecurityPolicy, createContentSecurityPolicyNonce } from './security/content-security-policy';
export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		 if (url.pathname.startsWith('/static/')) {
			 return await kvObjService.toObjResp( { env }, url.pathname.substring(1));
		 }

		const assetResponse = await env.assets.fetch(req);
		const response = new Response(assetResponse.body, assetResponse);
		const nonce = createContentSecurityPolicyNonce();
		response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
		return response;
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await oauthService.clearNoBindOathUser({ env })
		await authRateLimitService.cleanup({ env })
		await resendService.cleanup({ env })
		await analysisService.refreshEchartsCache({ env })
	},
};
