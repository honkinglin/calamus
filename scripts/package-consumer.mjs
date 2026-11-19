import { cp, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const prepareExample = process.argv.includes('--prepare-example');
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'calamus-consumer-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000, env: { ...process.env, CI: 'true' } });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  run('pnpm', ['pack', '--pack-destination', temporary], join(root, 'packages/core'));
  const archives = (await readdir(temporary)).filter(name => name.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  const archive = join(temporary, archives[0]);
  const packedFiles = run('tar', ['-tzf', archive], temporary).trim().split('\n');
  const allowed = /^package\/(?:package\.json|README\.md|LICENSE(?:\.md|\.txt)?|dist\/(?:calamus\.umd\.cjs|[a-zA-Z0-9_-]+(?:\.js|\.d\.ts)))$/;
  for (const file of packedFiles) assert.match(file, allowed, `Unexpected packed file: ${file}`);
  for (const required of ['package/package.json', 'package/README.md', 'package/dist/index.js', 'package/dist/index.d.ts', 'package/dist/calamus.umd.cjs']) {
    assert.ok(packedFiles.includes(required), `Missing packed file: ${required}`);
  }
  console.log(`Verified ${packedFiles.length} archive entries against the package allowlist.`);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'calamus-package-consumer', private: true, type: 'module' }));
  await cp(join(root, 'scripts/fixtures/package-consumer'), consumer, { recursive: true });
  run('pnpm', ['add', archive, '--offline', '--ignore-scripts', '--store-dir', join(temporary, 'store')], consumer);
  const installed = join(consumer, 'node_modules/@calamus/core');
  assert.ok((await realpath(installed)).startsWith(await realpath(temporary)), 'Consumer must use the installed archive, not a workspace link.');
  assert.match(await readFile(join(installed, 'README.md'), 'utf8'), /# Calamus Core/);
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) assert.equal(Object.keys(manifest[field] ?? {}).length, 0, `${field} must remain empty`);
  console.log(run(process.execPath, ['smoke.mjs'], consumer).trim());
  console.log(run(process.execPath, ['umd.cjs'], consumer).trim());
  console.log(run(process.execPath, ['replay.mjs'], consumer).trim());
  await cp(join(root, 'examples/vanilla/app.js'), join(consumer, 'example.js'));
  const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  for (const [module, resolution] of [['NodeNext', 'NodeNext'], ['ESNext', 'Bundler']]) {
    run(process.execPath, [compiler, '--noEmit', '--strict', '--target', 'ES2022', '--module', module,
      '--moduleResolution', resolution, '--lib', 'ES2022,DOM', 'types.ts'], consumer);
  }
  run(process.execPath, [compiler, '--allowJs', '--checkJs', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--lib', 'ES2022,DOM', 'example.js'], consumer);
  console.log('Vanilla JavaScript example passed strict checking against installed declarations.');
  if (prepareExample) {
    const vendor = join(root, 'examples/vanilla/vendor');
    await rm(vendor, { recursive: true, force: true });
    await cp(join(installed, 'dist'), vendor, { recursive: true });
    // Serve a .js extension so static hosts send the classic bundle as JavaScript.
    await cp(join(installed, 'dist/calamus.umd.cjs'), join(vendor, 'calamus.umd.js'));
    const exampleSource = await readFile(join(root, 'examples/vanilla/app.js'), 'utf8');
    assert.ok(exampleSource.startsWith("import { Calamus } from '@calamus/core';"));
    await writeFile(join(vendor, 'umd-app.js'), exampleSource.replace(
      "import { Calamus } from '@calamus/core';", 'const { Calamus } = window.CalamusSDK;'));
    const examplePage = await readFile(join(root, 'examples/vanilla/index.html'), 'utf8');
    await writeFile(join(vendor, 'umd.html'), examplePage
      .replace('Calamus · Vanilla JavaScript', 'Calamus · Classic script')
      .replace('./style.css', '../style.css')
      .replace(/  <script type="importmap">.*?<\/script>\n/, '')
      .replace('<script type="module" src="./app.js"></script>',
        '<script defer src="./calamus.umd.js"></script>\n  <script defer src="./umd-app.js"></script>')
      .replace('Plain JavaScript. One canvas.', 'Classic scripts. No module loader. One canvas.'));
    console.log('Prepared ESM and classic-script UMD examples from the verified installed tarball.');
  }
  console.log('Packed declarations passed strict NodeNext and Bundler consumer checks. No runtime dependencies.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
