const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const code = readFileSync(require.resolve('@calamus/core/umd'), 'utf8');
const common = require('@calamus/core/umd');
const globalContext = vm.createContext({});
vm.runInContext(code, globalContext, { timeout: 5000 });
let amd;
const define = (dependencies, factory) => {
  assert.deepEqual(Array.from(dependencies), ['exports']);
  amd = {}; factory(amd);
};
define.amd = {};
vm.runInNewContext(code, { define }, { timeout: 5000 });
(async () => {
  const esm = await import('@calamus/core');
  const stroke = { brush: { color: '#12345666', size: 6 }, points: [
    { x: 1, y: 2, time: 0, pressure: null }, { x: 10, y: 12, time: 8, pressure: 0.5 },
  ] };
  for (const api of [common, globalContext.CalamusSDK, amd]) {
    assert.deepEqual(Object.keys(api).sort(), Object.keys(esm).sort());
    assert.equal(typeof api.Calamus, 'function');
    assert.equal(JSON.stringify(api.processStroke(stroke)), JSON.stringify(esm.processStroke(stroke)));
    assert.equal(api.createSVG([stroke], 100, 100), esm.createSVG([stroke], 100, 100));
  }
  assert.equal(globalContext.window, undefined);
  console.log('Installed UMD CommonJS, global and AMD loaders match ESM exports and pure APIs without a DOM.');
})().catch(error => { console.error(error); process.exitCode = 1; });
