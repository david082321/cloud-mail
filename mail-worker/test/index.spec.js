import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('worker security routing', () => {
	it('does not expose the removed initializer (unit style)', async () => {
		const request = new Request('http://example.com/api/init/legacy-secret');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect([401, 404]).toContain(response.status);
	});

	it('does not expose the removed initializer (integration style)', async () => {
		const response = await SELF.fetch('http://example.com/api/init/legacy-secret');
		expect([401, 404]).toContain(response.status);
	});
});
