import { readFile, access } from 'node:fs/promises';

const packageRoot = new URL('../packages/core/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'));
const exists = async path => { try { await access(new URL(path, packageRoot)); return true; } catch { return false; } };
const checks = [];
const check = (label, pass, detail) => checks.push({ label, pass: Boolean(pass), detail });
check('Package name', typeof manifest.name === 'string' && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(manifest.name), manifest.name ?? 'Missing name');
check('Release version', typeof manifest.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version), manifest.version ?? 'Missing version');
check('Publishing enabled', manifest.private !== true, 'Remove private only after release identity and scope are approved.');
check('Description', typeof manifest.description === 'string' && manifest.description.trim(), 'Provide the public package description.');
check('Author', typeof manifest.author === 'string' ? manifest.author.trim() : manifest.author?.name, 'Confirm the public author identity.');
check('License metadata', typeof manifest.license === 'string' && manifest.license.trim() && manifest.license !== 'UNLICENSED', 'Confirm a license and set its identifier.');
check('Package license file', (await Promise.all(['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map(exists))).some(Boolean), 'Include the selected license in packages/core.');
const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
check('Repository', typeof repository === 'string' && /^(?:git\+)?https:\/\//.test(repository), 'Set the public source repository URL.');
check('Public scoped access', !manifest.name?.startsWith('@') || manifest.publishConfig?.access === 'public', 'Set publishConfig.access to public for the scoped open-source package.');
for (const path of ['README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/calamus.umd.cjs']) {
  check(`Artifact: ${path}`, await exists(path), 'Run pnpm build and ensure the package documentation exists.');
}
const report = {
  package: manifest.name, version: manifest.version,
  ready: checks.every(item => item.pass), checks,
  manual: ['Confirm npm name ownership and publishing identity.', 'Verify final tarball, CI, browser/device acceptance and third-party notices.', 'Install the published version from the registry after release.'],
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Release preflight: ${report.package}@${report.version}`);
  for (const item of checks) console.log(`${item.pass ? 'PASS' : 'TODO'} ${item.label}${item.pass ? '' : ` — ${item.detail}`}`);
  console.log('\nManual checks (not verified by this command):');
  for (const item of report.manual) console.log(`- ${item}`);
  console.log(`\n${report.ready ? 'Local metadata and artifact checks passed.' : 'Release is not ready.'} No files changed; nothing published.`);
}
process.exitCode = report.ready ? 0 : 1;
