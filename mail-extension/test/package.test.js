import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPackage } from '../scripts/package.mjs';

test('builds a runtime-only Chrome extension package', async () => {
  const result = await buildPackage();
  const entries = (await readdir(result.packageRoot)).sort();

  assert.deepEqual(entries, ['_locales', 'icons', 'manifest.json', 'src']);
  assert.equal(
    JSON.parse(await readFile(resolve(result.packageRoot, 'manifest.json'), 'utf8')).version,
    result.version
  );

  for (const excludedEntry of ['README.md', 'package.json', 'scripts', 'test']) {
    await assert.rejects(access(resolve(result.packageRoot, excludedEntry)));
  }
});
