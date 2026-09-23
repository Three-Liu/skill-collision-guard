'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { discoverSkills } = require('../src/discovery');
const { locateSkillRoots, readCandidate } = require('../src/skill');
const { temporary, writeSkill } = require('./helpers');

test('discovery reads direct children and ignores nested resource skills', (t) => {
  const temp = temporary('discovery');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'skills');
  writeSkill(root, 'visible', 'Visible workflow.');
  writeSkill(path.join(root, 'visible', 'fixtures'), 'nested', 'Not host-discoverable.');

  const skills = discoverSkills({ roots: [{ agent: 'test', scope: 'user', root, depth: 4 }] });
  assert.deepEqual(skills.map((item) => item.name), ['visible']);
});

test('plugin candidates prefer the canonical top-level skills directory', (t) => {
  const temp = temporary('candidate');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  writeSkill(path.join(temp, 'skills'), 'canonical', 'Canonical skill.');
  writeSkill(path.join(temp, '.openclaw', 'skills'), 'generated-copy', 'Generated adapter copy.');

  assert.deepEqual(readCandidate(temp).map((item) => item.name), ['canonical']);
});

test('the same symlinked SKILL.md is deduplicated while retaining origins', (t) => {
  const temp = temporary('symlink');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const sourceRoot = path.join(temp, 'one', 'skills');
  const secondRoot = path.join(temp, 'two', 'skills');
  const file = writeSkill(sourceRoot, 'shared', 'Shared workflow.');
  fs.mkdirSync(secondRoot, { recursive: true });
  fs.symlinkSync(path.dirname(file), path.join(secondRoot, 'shared'));

  const skills = discoverSkills({ roots: [
    { agent: 'one', scope: 'user', root: sourceRoot, depth: 2 },
    { agent: 'two', scope: 'user', root: secondRoot, depth: 2 },
  ] });
  assert.equal(skills.length, 1);
  assert.deepEqual(skills[0].origins.map((item) => item.agent), ['one', 'two']);
});

test('root discovery does not follow a symlink outside the searched root', (t) => {
  const temp = temporary('root-boundary');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const searchRoot = path.join(temp, 'cache');
  const outside = path.join(temp, 'outside');
  fs.mkdirSync(searchRoot, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  writeSkill(path.join(outside, 'skills'), 'outside', 'Must not become an installed root.');
  try {
    fs.symlinkSync(outside, path.join(searchRoot, 'linked-plugin'), 'dir');
  } catch (error) {
    t.skip(`symbolic links unavailable: ${error.message}`);
    return;
  }

  assert.deepEqual(locateSkillRoots(searchRoot, 4), []);
});
