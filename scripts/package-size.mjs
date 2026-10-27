import { readdir, readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../packages/core/', import.meta.url));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat().sort();
}
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const totals = { javascript: { files: 0, rawBytes: 0, gzipBytes: 0 }, declarations: { files: 0, rawBytes: 0 } };
for (const path of await files(join(root, 'dist'))) {
  const data = await readFile(path);
  if (path.endsWith('.js')) {
    totals.javascript.files++;
    totals.javascript.rawBytes += data.length;
    totals.javascript.gzipBytes += gzipSync(data, { level: 9 }).length;
  } else if (path.endsWith('.d.ts')) {
    totals.declarations.files++;
    totals.declarations.rawBytes += data.length;
  }
}
if (!totals.javascript.files || !totals.declarations.files) throw new Error('Build output must include JavaScript and declarations.');
const temporary = await mkdtemp(join(tmpdir(), 'calamus-size-'));
try {
  const pack = spawnSync('pnpm', ['pack', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' });
  if (pack.status !== 0) throw new Error(pack.stderr || pack.error?.message || 'Package packing failed.');
  const archives = (await readdir(temporary)).filter(name => name.endsWith('.tgz'));
  if (archives.length !== 1) throw new Error('Expected exactly one package archive.');
  const archive = join(temporary, archives[0]);
  const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error(listing.stderr || 'Unable to inspect package archive.');
  console.log(JSON.stringify({
    package: `${manifest.name}@${manifest.version}`,
    ...totals,
    archiveBytes: (await stat(archive)).size,
    runtimeDependencies: manifest.dependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
    packedFiles: listing.stdout.trim().split('\n').sort(),
    notes: 'gzipBytes sums independently compressed ESM files at level 9; not a tree-shaken browser bundle. Archive includes package metadata and declarations.',
  }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
