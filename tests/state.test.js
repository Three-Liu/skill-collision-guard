'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const test = require('node:test');
const { clearSession, readSession, restore, suppress } = require('../src/state');
const { temporary } = require('./helpers');

test('session suppression is isolated and reversible', (t) => {
  const previous = process.env.SKILL_GUARD_STATE_DIR;
  const temp = temporary('state');
  process.env.SKILL_GUARD_STATE_DIR = temp;
  t.after(() => {
    if (previous === undefined) delete process.env.SKILL_GUARD_STATE_DIR;
    else process.env.SKILL_GUARD_STATE_DIR = previous;
    fs.rmSync(temp, { recursive: true, force: true });
  });

  suppress('session-a', ['review', '/skills/minimal/SKILL.md']);
  suppress('session-b', ['deploy']);
  assert.deepEqual(readSession('session-a').suppressed, ['/skills/minimal/SKILL.md', 'review']);
  assert.deepEqual(readSession('session-b').suppressed, ['deploy']);
  assert.deepEqual(restore('session-a', ['review']).suppressed, ['/skills/minimal/SKILL.md']);
  assert.deepEqual(restore('session-a').suppressed, []);
  clearSession('session-b');
  assert.deepEqual(readSession('session-b').suppressed, []);
});
