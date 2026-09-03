'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { githubUrl, loadCandidate, resolveMarketplaceCandidate } = require('../src/candidate');
const { temporary, writeSkill } = require('./helpers');

test('resolves plugin@marketplace from a local marketplace', (t) => {
  const temp = temporary('marketplace');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const plugin = path.join(home, 'plugins', 'example');
  writeSkill(path.join(plugin, 'skills'), 'example-skill', 'Example workflow.');
  const marketplaceFile = path.join(home, '.agents', 'plugins', 'marketplace.json');
  fs.mkdirSync(path.dirname(marketplaceFile), { recursive: true });
  fs.writeFileSync(marketplaceFile, JSON.stringify({
    name: 'personal',
    plugins: [{ name: 'example', source: { source: 'local', path: './plugins/example' } }],
  }));

  assert.equal(resolveMarketplaceCandidate('example@personal', { cwd: temp, home }), plugin);
  const candidate = loadCandidate('example@personal', { cwd: temp, home });
  assert.deepEqual(candidate.skills.map((item) => item.name), ['example-skill']);
});

test('normalizes GitHub tree URLs into a shallow-clone source and subpath', () => {
  assert.deepEqual(githubUrl('https://github.com/acme/tools/tree/main/plugins/review'), {
    url: 'https://github.com/acme/tools.git',
    ref: 'main',
    subpath: 'plugins/review',
  });
});
