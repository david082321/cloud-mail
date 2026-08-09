import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (manifest.background?.type !== 'module') throw new Error('background service worker must be a module');

const referencedFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
];
await Promise.all(referencedFiles.map(path => access(resolve(root, path))));

const localeNames = ['zh_TW', 'zh_CN', 'en'];
const locales = await Promise.all(localeNames.map(async name => ({
  name,
  messages: JSON.parse(await readFile(resolve(root, '_locales', name, 'messages.json'), 'utf8'))
})));
const expectedKeys = Object.keys(locales[0].messages).sort().join('\n');
for (const locale of locales) {
  if (Object.keys(locale.messages).sort().join('\n') !== expectedKeys) {
    throw new Error(`Locale keys do not match: ${locale.name}`);
  }
}

const sourceFiles = ['manifest.json', 'src/background.js', 'src/api.js', 'src/popup/popup.js', 'src/popup/popup.html'];
const usedLocaleKeys = new Set();
for (const path of sourceFiles) {
  const source = await readFile(resolve(root, path), 'utf8');
  if (/<script[^>]+src=["']https?:/i.test(source) || /import\s+.*from\s+["']https?:/i.test(source)) {
    throw new Error(`Remote executable code is not allowed: ${path}`);
  }
  for (const match of source.matchAll(/(?:data-i18n=["']|__MSG_|\bt\(["']|getMessage\(["'])([A-Za-z][A-Za-z0-9]*)/g)) {
    usedLocaleKeys.add(match[1]);
  }
}
for (const key of usedLocaleKeys) {
  if (!locales[0].messages[key]) throw new Error(`Missing locale key: ${key}`);
}

console.log(`Validated Manifest V3 package with ${locales.length} locales, ${usedLocaleKeys.size} locale keys, and ${referencedFiles.length} referenced files.`);
