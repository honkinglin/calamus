import { cp, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

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
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'calamus-package-consumer', private: true, type: 'module' }));
  await cp(join(root, 'scripts/fixtures/package-consumer'), consumer, { recursive: true });
  run('pnpm', ['add', archive, '--offline', '--ignore-scripts', '--store-dir', join(temporary, 'store')], consumer);
  const installed = join(consumer, 'node_modules/@calamus/core');
  assert.ok((await realpath(installed)).startsWith(await realpath(temporary)), 'Consumer must use the installed archive, not a workspace link.');
  assert.match(await readFile(join(installed, 'README.md'), 'utf8'), /# Calamus Core/);
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) assert.equal(Object.keys(manifest[field] ?? {}).length, 0, `${field} must remain empty`);
  console.log(run(process.execPath, ['smoke.mjs'], consumer).trim());
  const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  for (const [module, resolution] of [['NodeNext', 'NodeNext'], ['ESNext', 'Bundler']]) {
    run(process.execPath, [compiler, '--noEmit', '--strict', '--target', 'ES2022', '--module', module,
      '--moduleResolution', resolution, '--lib', 'ES2022,DOM', 'types.ts'], consumer);
  }
  console.log('Packed declarations passed strict NodeNext and Bundler consumer checks. No runtime dependencies.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
