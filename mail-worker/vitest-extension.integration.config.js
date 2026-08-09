import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		include: ['test/extension-api.integration.spec.js'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler-dev.toml' }
			}
		}
	}
});
