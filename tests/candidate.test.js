'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { githubUrl, loadCandidate, resolveMarketplaceCandidate } = require('../src/candidate');
const { isWithinRoot } = require('../src/skill');
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

test('keeps candidate discovery inside the canonical root when a child symlink escapes', (t) => {
  const temp = temporary('candidate-symlink-boundary');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const candidate = path.join(temp, 'candidate');
  const outside = path.join(temp, 'outside');
  fs.mkdirSync(candidate, { recursive: true });
  writeSkill(outside, 'outside-skill', 'Must not be read through a candidate link.');
  try {
    fs.symlinkSync(outside, path.join(candidate, 'linked-outside'), 'dir');
    fs.symlinkSync(
      path.join(outside, 'outside-skill', 'SKILL.md'),
      path.join(candidate, 'SKILL.md'),
      'file',
    );
  } catch (error) {
    t.skip(`symbolic links unavailable: ${error.message}`);
    return;
  }

  assert.equal(isWithinRoot(fs.realpathSync(candidate), fs.realpathSync(outside)), false);
  assert.throws(() => loadCandidate(candidate), (error) => error.code === 'NO_SKILLS');
});

test('allows an internal candidate symlink without reading it twice', (t) => {
  const temp = temporary('candidate-internal-symlink');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const candidate = path.join(temp, 'candidate');
  const skillFile = writeSkill(candidate, 'visible', 'An internal linked skill.');
  try {
    fs.symlinkSync(path.dirname(skillFile), path.join(candidate, 'alias'), 'dir');
  } catch (error) {
    t.skip(`symbolic links unavailable: ${error.message}`);
    return;
  }

  assert.deepEqual(loadCandidate(candidate).skills.map((item) => item.name), ['visible']);
});
