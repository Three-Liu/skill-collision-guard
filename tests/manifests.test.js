'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('all JSON manifests parse and point to shipped resources', () => {
  const files = [
    '.codex-plugin/plugin.json', '.claude-plugin/plugin.json', '.github/plugin/plugin.json',
    '.qoder-plugin/plugin.json', 'plugin.json', 'opencode.json',
    'hooks/hooks.json', 'hooks/claude-codex-hooks.json', 'hooks/copilot-hooks.json', 'hooks/qoder-hooks.json',
  ];
  for (const file of files) assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')), file);
  for (const file of ['bin/skill-guard.js', 'hooks/skill-guard-hook.js', 'skills/skill-collision-guard/SKILL.md']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} must ship`);
  }
  const bundledRuntime = [
    'bin/skill-guard.js',
    ...fs.readdirSync(path.join(root, 'src')).filter((file) => file.endsWith('.js')).map((file) => `src/${file}`),
  ];
  for (const file of bundledRuntime) {
    assert.equal(
      fs.readFileSync(path.join(root, 'skills', 'skill-collision-guard', file), 'utf8'),
      fs.readFileSync(path.join(root, file), 'utf8'),
      `ClawHub bundle drifted: ${file}`,
    );
  }
  const bundledSkill = fs.readFileSync(path.join(root, 'skills', 'skill-collision-guard', 'SKILL.md'), 'utf8');
  assert.match(bundledSkill, /metadata:\s+openclaw:\s+requires:\s+bins:\s+- node\s+- git/);
  assert.match(bundledSkill, /git clone --depth 1/);
  const codex = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json')));
  assert.equal(codex.name, path.basename(root) === 'skill-collision-guard' ? path.basename(root) : 'skill-collision-guard');
  assert.equal(codex.hooks, undefined);
  assert.ok(fs.existsSync(path.join(root, 'hooks', 'hooks.json')));
  const codexHooks = fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8');
  const claudeHooks = fs.readFileSync(path.join(root, 'hooks', 'claude-codex-hooks.json'), 'utf8');
  const copilotHooks = fs.readFileSync(path.join(root, 'hooks', 'copilot-hooks.json'), 'utf8');
  const qoderHooks = fs.readFileSync(path.join(root, 'hooks', 'qoder-hooks.json'), 'utf8');
  assert.match(codexHooks, /--agent codex/);
  assert.match(claudeHooks, /--agent claude/);
  assert.match(copilotHooks, /--agent copilot/);
  assert.match(qoderHooks, /--agent qoder/);
  for (const file of ['.claude-plugin/plugin.json', '.github/plugin/plugin.json', '.qoder-plugin/plugin.json', 'plugin.json']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.equal(manifest.name, codex.name, `${file} name drifted`);
    assert.equal(manifest.version, codex.version, `${file} version drifted`);
  }
});
