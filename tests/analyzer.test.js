'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyCapabilities, compareSkills, matchPrompt, tokens } = require('../src/analyzer');
const { classifyBehavior } = require('../src/behavior');

function skill(name, description, body = '') {
  return { name, description, body, path: `/${name}/SKILL.md`, agent: 'test', scope: 'test' };
}

test('same normalized name is a critical shadow conflict', () => {
  const result = compareSkills(skill('code-review', 'Review a pull request.'), skill('Code Review', 'Audit source changes.'));
  assert.equal(result.kind, 'name-shadow');
  assert.equal(result.severity, 'critical');
  assert.equal(result.score, 1);
});

test('overlapping skills with opposite policies are high severity', () => {
  const minimal = skill('minimal-review', 'Review code changes for maintainability and correctness.', 'Use the standard library first. Avoid new dependencies. Keep the answer concise.');
  const exhaustive = skill('full-review', 'Review code changes for maintainability and correctness.', 'Use a proven third-party library. Make the report detailed and comprehensive.');
  const result = compareSkills(minimal, exhaustive);
  assert.equal(result.kind, 'policy-conflict');
  assert.equal(result.severity, 'high');
  assert.deepEqual(result.evidence.policyConflicts.sort(), ['dependency policy', 'response detail']);
});

test('Chinese descriptions contribute useful intent tokens', () => {
  const overlap = [...tokens('安装技能之前检查技能冲突')].filter((item) => tokens('检查技能是否冲突').has(item));
  assert.ok(overlap.length >= 3);
});

test('explicit skill invocation outranks implicit intent', () => {
  const skills = [
    skill('review', 'Review source changes.'),
    skill('security-review', 'Review source changes for security.'),
  ];
  const matches = matchPrompt('Use $review on this patch', skills);
  assert.equal(matches[0].skill.name, 'review');
  assert.equal(matches[0].explicit, true);
});

test('classifies TDD aliases as the same capability', () => {
  const shortName = skill('tdd', 'Test-driven development for features and bug fixes.');
  const longName = skill('test-driven-development', 'Use before implementation code. Write the failing test first, then make it pass.');
  const result = compareSkills(shortName, longName);

  assert.equal(classifyCapabilities(shortName)[0].id, 'test-driven-development');
  assert.equal(result.kind, 'capability-collision');
  assert.equal(result.severity, 'high');
  assert.deepEqual(result.evidence.sharedCapabilities.map((item) => item.id), ['test-driven-development']);
});

test('classifies diagnosis and systematic debugging as the same capability', () => {
  const diagnosis = skill('diagnosing-bugs', 'Diagnosis loop for hard bugs and performance regressions.');
  const debugging = skill('systematic-debugging', 'Use for bugs and unexpected behavior before proposing fixes.', 'Always find the root cause before attempting fixes.');
  const result = compareSkills(diagnosis, debugging);

  assert.equal(result.kind, 'capability-collision');
  assert.equal(result.severity, 'high');
  assert.equal(result.evidence.sharedCapabilities[0].id, 'debugging');
});

test('classifies differently named skill-authoring guides as the same capability', () => {
  const reference = skill('writing-great-skills', 'Reference for writing and editing skills well.');
  const workflow = skill('writing-skills', 'Use when creating new skills, editing existing skills, or verifying skills.');
  const result = compareSkills(reference, workflow);

  assert.equal(result.kind, 'capability-collision');
  assert.equal(result.severity, 'high');
  assert.equal(result.evidence.sharedCapabilities[0].id, 'skill-authoring');
});

test('distinguishes requesting a review from performing a review', () => {
  const requesting = skill('requesting-code-review', 'Use before merging to request review of completed work.');
  const performing = skill('code-review', 'Review a branch or pull request against standards and its specification.');
  const result = compareSkills(requesting, performing);

  assert.equal(result.kind, 'capability-overlap');
  assert.equal(result.severity, 'medium');
  assert.deepEqual(result.evidence.sharedCapabilities[0].facets.sort(), ['performing', 'requesting']);
});

test('does not confuse general verification with test-driven development', () => {
  const verification = skill('verification-before-completion', 'Run tests and confirm output before claiming work is complete.');
  const tdd = skill('tdd', 'Test-driven development for features and bug fixes.');
  assert.equal(compareSkills(verification, tdd).severity, 'none');
});

test('classifies Chinese capability descriptions', () => {
  const ChineseDiagnosis = skill('故障排查', '排查线上故障并定位根因后再修复。');
  const debugging = skill('systematic-debugging', 'Debug bugs by finding the root cause before fixes.');
  assert.equal(compareSkills(ChineseDiagnosis, debugging).evidence.sharedCapabilities[0].id, 'debugging');
});

test('detects a global implementation policy interfering with a fixed TDD workflow', () => {
  const minimalism = skill(
    'minimal-coding-mode',
    'Use on any coding task. Prefer the simplest solution, YAGNI, standard library, and the shortest working diff.',
    'ACTIVE EVERY RESPONSE until session end. Apply this policy while writing, fixing, refactoring, reviewing, or designing code. A bug report names a symptom; edit only after finding the root cause.',
  );
  const tdd = skill('tdd', 'Test-driven development for features and bug fixes.', 'Write one failing test before implementation.');
  const result = compareSkills(minimalism, tdd);

  assert.equal(result.kind, 'behavioral-interference');
  assert.equal(result.severity, 'medium');
  assert.equal(result.evidence.behavioralInterference.overlay.name, 'minimal-coding-mode');
  assert.equal(result.evidence.behavioralInterference.overlay.scope, 'global');
  assert.equal(result.evidence.behavioralInterference.overlay.mode, 'write');
  assert.deepEqual(result.evidence.behavioralInterference.affectedCapabilities, ['test-driven-development']);
});

test('detects a global implementation policy interfering with systematic diagnosis', () => {
  const minimalism = skill(
    'lean-coding-mode',
    'Use on every coding task. Prefer YAGNI, standard library, and the minimal working implementation.',
    'ACTIVE EVERY RESPONSE while writing, fixing, refactoring, or designing code.',
  );
  const diagnosis = skill('diagnosing-bugs', 'Diagnosis loop for hard bugs and performance regressions.');
  const result = compareSkills(minimalism, diagnosis);

  assert.equal(result.kind, 'behavioral-interference');
  assert.equal(result.severity, 'medium');
  assert.deepEqual(result.evidence.behavioralInterference.affectedCapabilities, ['debugging']);
});

test('marks complexity-only review as complementary to correctness review', () => {
  const complexityReview = skill(
    'overengineering-review',
    'Code review focused exclusively on over-engineering and unnecessary abstractions. Complements correctness-focused review.',
    'Review only. Do not apply fixes.',
  );
  const correctnessReview = skill('code-review', 'Review a branch against coding standards and its specification.');
  const result = compareSkills(complexityReview, correctnessReview);

  assert.equal(result.kind, 'complementary');
  assert.equal(result.severity, 'info');
  assert.deepEqual(result.evidence.sharedCapabilities[0].facets.sort(), ['complexity', 'performing']);
});

test('distinguishes workflow review mode from one-shot report mode', () => {
  const review = skill('complexity-review', 'Code review focused on over-engineering.', 'Review only. Do not apply fixes.');
  const audit = skill('complexity-audit', 'Whole-repo audit for over-engineering. One-shot report; does not apply fixes.');

  assert.deepEqual(
    [classifyBehavior(review).scope, classifyBehavior(review).mode],
    ['workflow', 'review-only'],
  );
  assert.deepEqual(
    [classifyBehavior(audit).scope, classifyBehavior(audit).mode],
    ['one-shot', 'report-only'],
  );
});

test('classifies a repository simplification audit as overlapping architecture improvement', () => {
  const simplificationAudit = skill(
    'overengineering-audit',
    'Whole-repo audit for over-engineering. Report what to delete or replace; does not apply fixes.',
  );
  const architecture = skill(
    'improve-codebase-architecture',
    'Scan a codebase for deepening opportunities and improve module interfaces.',
  );
  const result = compareSkills(simplificationAudit, architecture);

  assert.equal(result.kind, 'capability-overlap');
  assert.equal(result.severity, 'medium');
  assert.equal(result.evidence.sharedCapabilities[0].id, 'codebase-architecture');
});

test('does not treat one-shot help, metrics, or debt reports as behavioral overlays', () => {
  const tdd = skill('tdd', 'Test-driven development for features and bug fixes.');
  const helpers = [
    skill('minimalism-help', 'Quick-reference card for modes and commands. One-shot display, not a persistent mode.'),
    skill('minimalism-gain', 'Show measured impact as a compact scoreboard. One-shot display, not a per-repo number.'),
    skill('minimalism-debt', 'Harvest deliberate shortcut comments into a debt ledger. One-shot report, changes nothing.'),
  ];

  assert.deepEqual(helpers.map((helper) => compareSkills(helper, tdd).severity), ['none', 'none', 'none']);
});

test('upgrades an overlay with an opposing instruction to a high policy conflict', () => {
  const unsafeMinimalism = skill(
    'minimal-coding-mode',
    'Use on every coding task. Prefer YAGNI and the shortest working implementation.',
    'ACTIVE EVERY RESPONSE. Do not write tests.',
  );
  const tdd = skill('tdd', 'Test-driven development for features and bug fixes.', 'Write tests using red-green-refactor.');
  const result = compareSkills(unsafeMinimalism, tdd);

  assert.equal(result.kind, 'policy-conflict');
  assert.equal(result.severity, 'high');
  assert.deepEqual(result.evidence.policyConflicts, ['test policy']);
  assert.ok(result.evidence.behavioralInterference);
});
