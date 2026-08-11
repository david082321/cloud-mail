import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/extension-utils.spec.js', 'test/security-utils.spec.js']
	}
});
