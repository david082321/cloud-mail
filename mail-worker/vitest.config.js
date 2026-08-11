import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: './wrangler-extension-test.toml' } })],
	test: {
		include: ['test/index.spec.js']
	}
});
