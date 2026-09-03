'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { compareSkills } = require('../src/analyzer');
const { comparisonSummary, formatComparisons } = require('../src/report');

function skill(name, description, body = '') {
  return { name, description, body, path: `/${name}/SKILL.md`, agent: 'test', scope: 'test' };
}

test('a clean automated result preserves the manual-review limitation', () => {
  assert.match(formatComparisons([]), /No automated skill relationships found/i);
  assert.match(formatComparisons([]), /manual review/i);
});

test('relationship summaries distinguish curated evidence from manual review', () => {
  const overlay = skill(
    'lean-coding-mode',
    'Use on every coding task. Prefer YAGNI and the shortest working implementation.',
    'ACTIVE EVERY RESPONSE until session end.',
  );
  const tdd = skill('tdd', 'Test-driven development for features and bug fixes.');
  const summary = comparisonSummary(compareSkills(overlay, tdd));

  assert.equal(summary.evidence.classificationSource, 'curated');
  assert.equal(summary.evidence.reviewLevel, 'manual-review-required');
  assert.equal(summary.evidence.confidence, 0.78);
});
