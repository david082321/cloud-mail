import { access, appendFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(extensionRoot, 'dist');
const packageRoot = resolve(distRoot, 'package');
const runtimeEntries = ['manifest.json', '_locales', 'icons', 'src'];

function validateChromeVersion(version) {
  if (typeof version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(version)) {
    throw new Error(`Invalid Chrome extension version: ${version}`);
  }

  const components = version.split('.');
  if (
    components.every(component => component === '0') ||
    components.some(component => (component.length > 1 && component.startsWith('0')) || Number(component) > 65535)
  ) {
    throw new Error(`Invalid Chrome extension version: ${version}`);
  }
}

function assertWithinRoot(root, target) {
  const targetRelative = relative(root, target);
  if (!targetRelative || targetRelative.startsWith(`..${sep}`) || targetRelative === '..') {
    throw new Error(`Refusing to modify path outside the extension root: ${target}`);
  }
}

export async function buildPackage() {
  const manifest = JSON.parse(await readFile(resolve(extensionRoot, 'manifest.json'), 'utf8'));
  validateChromeVersion(manifest.version);

  assertWithinRoot(extensionRoot, distRoot);
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });

  for (const entry of runtimeEntries) {
    await cp(resolve(extensionRoot, entry), resolve(packageRoot, entry), { recursive: true });
  }

  await access(resolve(packageRoot, 'manifest.json'));
  await writeFile(resolve(distRoot, 'version.txt'), `${manifest.version}\n`, 'utf8');

  const archiveName = `cloud-mail-extension-${manifest.version}`;
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    await appendFile(outputFile, `version=${manifest.version}\narchive_name=${archiveName}\n`, 'utf8');
  }

  return {
    version: manifest.version,
    archiveName,
    packageRoot,
    runtimeEntries: [...runtimeEntries]
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const result = await buildPackage();
  console.log(`Prepared ${result.archiveName} from ${result.runtimeEntries.join(', ')}.`);
}
