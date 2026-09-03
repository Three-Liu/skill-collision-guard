'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');
const { installCandidate, isInstallIntent } = require('../hooks/skill-guard-hook');
const { temporary, writeSkill } = require('./helpers');

const root = path.resolve(__dirname, '..');

test('CLI pauses installation on a same-name skill', (t) => {
  const temp = temporary('cli');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.agents', 'skills'), 'review', 'Review source changes.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'review', 'A different review workflow.');

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--cwd', cwd, '--home', home, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.conflicts[0].kind, 'name-shadow');
  assert.equal(report.conflicts[0].severity, 'critical');
});

test('CLI can limit installation checks to skills visible to Codex', (t) => {
  const temp = temporary('cli-codex');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills'), 'tdd', 'Test-driven development for features and bug fixes.');
  writeSkill(path.join(home, '.agents', 'skills'), 'writing-great-skills', 'Reference for writing and editing skills well.');
  writeSkill(path.join(home, '.claude', 'skills'), 'systematic-debugging', 'Debug bugs by finding the root cause before fixes.');

  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'test-driven-development', 'Write the failing test first, then make it pass.');
  writeSkill(path.join(candidate, 'skills'), 'writing-skills', 'Use when creating new skills or editing existing skills.');
  writeSkill(path.join(candidate, 'skills'), 'diagnosing-bugs', 'Diagnosis loop for hard bugs and failures.');

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--agent', 'codex', '--cwd', cwd, '--home', home, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.conflicts.map((item) => item.installed.agent).sort(), ['agents', 'codex']);
  assert.deepEqual(report.conflicts.map((item) => item.candidate.name).sort(), ['test-driven-development', 'writing-skills']);
});

test('installation report presents candidate and installed-skill choices', (t) => {
  const temp = temporary('cli-recommendation');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills'), 'tdd', 'Test-driven development for features and bug fixes.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'test-driven-development', 'Write the failing test first, then make it pass.');

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--agent', 'codex', '--session', 'current-chat', '--cwd', cwd, '--home', home], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /skip candidate 'test-driven-development'/i);
  assert.match(result.stdout, /suppress installed 'tdd'/i);
  assert.match(result.stdout, /--session "current-chat"/);
});

test('installation report never recommends removing a system skill', (t) => {
  const temp = temporary('cli-system-recommendation');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills', '.system'), 'skill-creator', 'Create or update a Codex skill.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'writing-skills', 'Use when creating new skills or editing existing skills.');

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--agent', 'codex', '--session', 'current-chat', '--cwd', cwd, '--home', home], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.doesNotMatch(result.stdout, /remove installed 'skill-creator'/i);
  assert.match(result.stdout, /system skill 'skill-creator'/i);
  assert.match(result.stdout, /suppress.*for this session/i);
});

test('CLI requires confirmation for a behavioral overlay and explains reversible suppression', (t) => {
  const temp = temporary('cli-overlay');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills'), 'tdd', 'Test-driven development for features and bug fixes.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(
    path.join(candidate, 'skills'),
    'minimal-coding-mode',
    'Use on any coding task. Prefer YAGNI, standard library, and the shortest working diff.',
    'ACTIVE EVERY RESPONSE until session end while writing, fixing, refactoring, or reviewing code.',
  );

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--agent', 'codex', '--session', 'current-chat', '--cwd', cwd, '--home', home], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /behavioral overlay:.*global.*write/i);
  assert.match(result.stdout, /affected workflows: test-driven development/i);
  assert.match(result.stdout, /suppress candidate 'minimal-coding-mode'/i);
  assert.match(result.stdout, /confirmation required/i);
});

test('CLI reports a complementary review relationship without pausing installation', (t) => {
  const temp = temporary('cli-complementary');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills'), 'code-review', 'Review a branch against coding standards and its specification.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'complexity-review', 'Code review focused exclusively on over-engineering. Complements correctness-focused review.', 'Review only. Do not apply fixes.');

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--agent', 'codex', '--session', 'current-chat', '--cwd', cwd, '--home', home], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[INFO\].*complexity-review.*code-review/i);
  assert.match(result.stdout, /recommendation: keep both/i);
});

test('CLI recommends suppressing an installed overlay when it opposes a candidate workflow', (t) => {
  const temp = temporary('cli-installed-overlay');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(
    path.join(home, '.codex', 'skills'),
    'minimal-coding-mode',
    'Use on every coding task. Prefer YAGNI and the shortest working implementation.',
    'ACTIVE EVERY RESPONSE. Do not write tests.',
  );
  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'test-driven-development', 'Use before implementation code.', 'Write tests using red-green-refactor.');

  const result = spawnSync(process.execPath, [path.join(root, 'bin', 'skill-guard.js'),
    'check-install', candidate, '--agent', 'codex', '--session', 'current-chat', '--cwd', cwd, '--home', home], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /suppress installed 'minimal-coding-mode'/i);
  assert.doesNotMatch(result.stdout, /skip candidate 'test-driven-development'/i);
});

test('PreToolUse hook denies a conflicting local plugin installation', (t) => {
  const temp = temporary('hook');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.agents', 'skills'), 'review', 'Review source changes.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(path.join(candidate, 'skills'), 'review', 'A different review workflow.');

  const input = JSON.stringify({
    session_id: 'test-session', cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash',
    tool_input: { command: `codex plugin add "${candidate}"` },
  });
  const result = spawnSync(process.execPath, [path.join(root, 'hooks', 'skill-guard-hook.js')], {
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SKILL_GUARD_STATE_DIR: path.join(temp, 'state') },
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /name-shadow/);
});

test('PreToolUse hook pauses installation of a global behavioral overlay', (t) => {
  const temp = temporary('hook-overlay');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills'), 'tdd', 'Test-driven development for features and bug fixes.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(
    path.join(candidate, 'skills'),
    'minimal-coding-mode',
    'Use on any coding task. Prefer YAGNI, standard library, and the shortest working diff.',
    'ACTIVE EVERY RESPONSE until session end while writing, fixing, refactoring, or reviewing code.',
  );

  const input = JSON.stringify({
    session_id: 'overlay-session', cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash',
    tool_input: { command: `codex plugin add "${candidate}"` },
  });
  const result = spawnSync(process.execPath, [path.join(root, 'hooks', 'skill-guard-hook.js')], {
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SKILL_GUARD_STATE_DIR: path.join(temp, 'state') },
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /behavioral-interference/);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /suppress candidate 'minimal-coding-mode'/i);
});

test('hook agent scope excludes skills owned by another host', (t) => {
  const temp = temporary('hook-agent-scope');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.claude', 'skills'), 'tdd', 'Test-driven development for features and bug fixes.');
  const candidate = path.join(temp, 'candidate');
  writeSkill(
    path.join(candidate, 'skills'),
    'minimal-coding-mode',
    'Use on any coding task. Prefer YAGNI, standard library, and the shortest working diff.',
    'ACTIVE EVERY RESPONSE until session end while writing, fixing, refactoring, or reviewing code.',
  );
  const hook = path.join(root, 'hooks', 'skill-guard-hook.js');
  const input = JSON.stringify({
    session_id: 'agent-scope-session', cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash',
    tool_input: { command: `npx skills add "${candidate}"` },
  });
  const options = {
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, SKILL_GUARD_STATE_DIR: path.join(temp, 'state') },
  };

  const codex = spawnSync(process.execPath, [hook, '--agent', 'codex'], options);
  assert.equal(codex.status, 0, codex.stderr);
  assert.equal(codex.stdout, '');

  const claude = spawnSync(process.execPath, [hook, '--agent', 'claude'], options);
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(JSON.parse(claude.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('prompt hook prefers a fixed workflow and supports suppress then restore', (t) => {
  const temp = temporary('prompt-overlay');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  const cwd = path.join(temp, 'repo');
  const stateDir = path.join(temp, 'state');
  fs.mkdirSync(path.join(cwd, '.git'), { recursive: true });
  writeSkill(path.join(home, '.codex', 'skills'), 'tdd', 'Test-driven development for features and bug fixes.');
  writeSkill(
    path.join(home, '.codex', 'skills'),
    'minimal-coding-mode',
    'Use on any coding task. Prefer YAGNI, standard library, and the shortest working diff.',
    'ACTIVE EVERY RESPONSE until session end while writing, fixing, refactoring, or reviewing code.',
  );
  const hook = path.join(root, 'hooks', 'skill-guard-hook.js');
  const env = { ...process.env, HOME: home, SKILL_GUARD_STATE_DIR: stateDir };
  const invoke = (prompt) => spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ session_id: 'prompt-overlay-session', cwd, hook_event_name: 'UserPromptSubmit', prompt }),
    encoding: 'utf8', env,
  });

  const detected = invoke('Use $tdd to implement this change.');
  assert.equal(detected.status, 0, detected.stderr);
  const detectedContext = JSON.parse(detected.stdout).hookSpecificOutput.additionalContext;
  assert.match(detectedContext, /behavioral-interference/);
  assert.match(detectedContext, /fixed workflow 'tdd' authoritative/i);
  assert.match(detectedContext, /suppress installed 'minimal-coding-mode'/i);
  assert.doesNotMatch(detectedContext, /remov(?:e|ing) the duplicate/i);

  invoke('/skill-guard suppress minimal-coding-mode');
  const suppressed = invoke('Use $tdd to implement this change.');
  assert.doesNotMatch(JSON.parse(suppressed.stdout).hookSpecificOutput.additionalContext, /behavioral-interference/);

  invoke('/skill-guard restore minimal-coding-mode');
  const restored = invoke('Use $tdd to implement this change.');
  assert.match(JSON.parse(restored.stdout).hookSpecificOutput.additionalContext, /behavioral-interference/);
});

test('hook recognizes common installers and Chinese install intent', () => {
  assert.equal(installCandidate('gemini extensions install https://github.com/acme/skills'), 'https://github.com/acme/skills');
  assert.equal(installCandidate('npx -y skills add acme/tools'), 'acme/tools');
  assert.equal(isInstallIntent('帮我安装这个 skill 插件'), true);
});

test('prompt hook and CLI share reversible session suppression state', (t) => {
  const temp = temporary('session-hook');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const stateDir = path.join(temp, 'state');
  const env = { ...process.env, SKILL_GUARD_STATE_DIR: stateDir };
  const hook = path.join(root, 'hooks', 'skill-guard-hook.js');
  const cli = path.join(root, 'bin', 'skill-guard.js');

  const suppressResult = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ session_id: 'shared-session', cwd: temp, hook_event_name: 'UserPromptSubmit', prompt: '/skill-guard suppress review' }),
    encoding: 'utf8', env,
  });
  assert.equal(suppressResult.status, 0, suppressResult.stderr);
  assert.match(JSON.parse(suppressResult.stdout).hookSpecificOutput.additionalContext, /review/);

  const status = spawnSync(process.execPath, [cli, 'status', '--session', 'shared-session', '--json'], { encoding: 'utf8', env });
  assert.deepEqual(JSON.parse(status.stdout).suppressed, ['review']);

  spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ session_id: 'shared-session', cwd: temp, hook_event_name: 'SessionEnd' }),
    encoding: 'utf8', env,
  });
  const cleared = spawnSync(process.execPath, [cli, 'status', '--session', 'shared-session', '--json'], { encoding: 'utf8', env });
  assert.deepEqual(JSON.parse(cleared.stdout).suppressed, []);
});
