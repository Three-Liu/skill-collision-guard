#!/usr/bin/env node
'use strict';

const path = require('path');
const { analyzeCandidates, compareSkills, matchPrompt, normalizeName, requiresInstallDecision } = require('../src/analyzer');
const { loadCandidate } = require('../src/candidate');
const { discoverSkills } = require('../src/discovery');
const { formatComparisons } = require('../src/report');
const { clearSession, readSession, restore, suppress } = require('../src/state');

function readInput(callback) {
  let input = '';
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try { callback(JSON.parse(input.replace(/^\uFEFF/, '') || '{}')); }
    catch (_) { callback({}); }
  };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  setTimeout(finish, 900).unref();
}

function output(event, context, options = {}) {
  if (!context && !options.deny) return;
  let value;
  if (options.deny) {
    value = {
      systemMessage: 'Skill Collision Guard paused this installation.',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: context,
      },
    };
  } else if (process.env.COPILOT_PLUGIN_DATA) {
    value = { additionalContext: context };
  } else {
    value = {
      systemMessage: options.systemMessage,
      hookSpecificOutput: { hookEventName: event, additionalContext: context },
    };
    if (!value.systemMessage) delete value.systemMessage;
  }
  process.stdout.write(JSON.stringify(value));
}

function sessionKey(input) {
  return input.session_id || input.sessionId || input.transcript_path || `${input.cwd || process.cwd()}:default`;
}

function hookAgent(input, argv = process.argv.slice(2)) {
  if (input.agent) return String(input.agent).toLowerCase();
  const index = argv.indexOf('--agent');
  if (index >= 0 && argv[index + 1]) return argv[index + 1].toLowerCase();
  return process.env.SKILL_GUARD_AGENT?.toLowerCase();
}

function activeSkills(input) {
  const cwd = input.cwd || process.cwd();
  const state = readSession(sessionKey(input));
  const suppressed = new Set(state.suppressed.map((item) => normalizeName(item)));
  const skills = discoverSkills({ cwd, agent: hookAgent(input) });
  return {
    state,
    skills,
    active: skills.filter((skill) => !state.suppressed.includes(skill.path) && !suppressed.has(normalizeName(skill.name))),
  };
}

function suppressionContext(state) {
  if (!state.suppressed.length) return '';
  return [
    'SKILL COLLISION GUARD - SESSION SUPPRESSION ACTIVE',
    'Do not invoke, load, or follow these skills in this session:',
    ...state.suppressed.map((item) => `- ${item}`),
    'Continue the user task without them. They can be restored with /skill-guard restore [name-or-path].',
  ].join('\n');
}

function handleGuardCommand(prompt, input) {
  const match = String(prompt || '').match(/(?:^|\s)\/skill-guard\s+(suppress|restore|status)(?:\s+([^\n]+))?/i);
  if (!match) return null;
  const action = match[1].toLowerCase();
  const values = (match[2] || '').match(/"[^"]+"|'[^']+'|\S+/g)?.map((value) => value.replace(/^(?:"|')|(?:"|')$/g, '')) || [];
  const session = sessionKey(input);
  let state;
  if (action === 'suppress') {
    if (!values.length) return 'Skill Collision Guard: /skill-guard suppress requires a skill name or path.';
    state = suppress(session, values);
  } else if (action === 'restore') state = restore(session, values);
  else state = readSession(session);
  return `Skill Collision Guard session state: ${state.suppressed.join(', ') || '(no suppressed skills)'}.`;
}

function isInstallIntent(prompt) {
  return /(?:\b(?:install|add)\b.{0,40}\b(?:skill|plugin|extension)s?\b|\b(?:skill|plugin|extension)s?\b.{0,40}\b(?:install|add)\b|安装|添加|装载).{0,40}(?:skill|plugin|技能|插件)/i.test(prompt);
}

function triggerConflicts(prompt, skills) {
  const matches = matchPrompt(prompt, skills);
  const explicit = matches.filter((item) => item.explicit);
  const selected = explicit.length ? explicit : matches.filter((item, index) => index < 3 && item.intent >= 0.22);
  const results = [];
  const seen = new Set();
  for (const match of selected) {
    for (const other of skills) {
      if (other.path === match.skill.path) continue;
      const key = [match.skill.path, other.path].sort().join('\0');
      if (seen.has(key)) continue;
      const comparison = compareSkills(match.skill, other);
      if (comparison.severity === 'none') continue;
      seen.add(key);
      results.push(comparison);
    }
  }
  return results;
}

function handlePrompt(input) {
  const prompt = input.prompt || input.user_prompt || '';
  const commandResult = handleGuardCommand(prompt, input);
  const { state, active } = activeSkills(input);
  const parts = [];
  if (commandResult) parts.push(commandResult);
  const suppressed = suppressionContext(state);
  if (suppressed) parts.push(suppressed);

  const collisions = triggerConflicts(prompt, active);
  if (collisions.length) {
    parts.push(
      'SKILL COLLISION GUARD - INVOCATION CHECK',
      formatComparisons(collisions, { sessionId: sessionKey(input) }),
      'Show the relationship before choosing. Follow its specific recommendation: fixed workflows take precedence over behavioral overlays, while complementary skills may run as separate passes. Ask before removing or suppressing anything.',
    );
  }
  if (isInstallIntent(prompt)) {
    const agent = hookAgent(input) || '<current-agent>';
    parts.push(
      'SKILL COLLISION GUARD - INSTALL PREFLIGHT REQUIRED',
      'Before installing a skill or plugin, run `skill-guard check-install <source> --agent "' + agent + '" --session "' + sessionKey(input) + '"` and show any comparison to the user. Do not install after exit code 2 until the user chooses which skill to keep or suppress.',
    );
  }
  output('UserPromptSubmit', parts.join('\n\n'), { systemMessage: collisions.length ? 'Potential skill conflict detected.' : undefined });
}

const INSTALL_PATTERNS = [
  /\bcodex\s+plugin\s+(?:add|install)\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\bclaude\s+plugin\s+install\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\bcopilot\s+plugin\s+install\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\bgemini\s+extensions?\s+install\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\b(?:hermes|grok)\s+plugins?\s+install\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\b(?:pi|clawhub)\s+install\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\bswival\s+skills?\s+add(?:\s+--global)?\s+((?:"[^"]+"|'[^']+'|\S+))/i,
  /\b(?:npx|pnpm\s+dlx)\s+(?:-y\s+)?skills?\s+add\s+((?:"[^"]+"|'[^']+'|\S+))/i,
];

function installCandidate(command) {
  for (const pattern of INSTALL_PATTERNS) {
    const match = String(command || '').match(pattern);
    if (match) return match[1].replace(/^(?:"|')|(?:"|')$/g, '');
  }
  return null;
}

function handlePreTool(input) {
  const command = input.tool_input?.command || input.toolInput?.command || '';
  const reference = installCandidate(command);
  if (!reference || /SKILL_GUARD_ALLOW_CONFLICTS=1/.test(command)) return;

  let candidate;
  let remoteNotice = '';
  try {
    candidate = loadCandidate(reference, {
      cwd: input.cwd || process.cwd(),
      timeout: 18000,
      onRemoteInspection() {
        remoteNotice = `Remote candidate retrieval is enabled for '${reference}' using a temporary shallow Git clone; candidate code is not executed.`;
      },
    });
    const { state, active } = activeSkills(input);
    const conflicts = analyzeCandidates(candidate.skills, active, { ignorePaths: state.suppressed });
    if (!conflicts.length) return;
    const report = [
      `Skill/plugin installation preflight for ${reference}:`,
      remoteNotice,
      formatComparisons(conflicts, { sessionId: sessionKey(input), context: 'install' }),
    ].filter(Boolean).join('\n');
    const decisionRequired = conflicts.some(requiresInstallDecision);
    output('PreToolUse', decisionRequired
      ? `${report}\n\nInstallation paused for a decision. Ask the user to skip the candidate, remove an eligible existing skill, or use reversible session suppression. Re-run only after that choice; an explicit override is SKILL_GUARD_ALLOW_CONFLICTS=1.`
      : `${report}\n\nThese relationships do not block installation; show them to the user.`, { deny: decisionRequired });
  } catch (error) {
    output('PreToolUse',
      `Skill Collision Guard could not inspect installation candidate '${reference}': ${error.message}. Do not claim the candidate is conflict-free; obtain an inspectable source or ask the user whether to proceed.`,
      { systemMessage: 'Skill install preflight was incomplete.' });
  } finally {
    if (candidate) candidate.cleanup();
  }
}

function handleSessionStart(input) {
  const state = readSession(sessionKey(input));
  output('SessionStart', suppressionContext(state));
}

function handleSessionEnd(input) {
  clearSession(sessionKey(input));
}

function handle(input) {
  const event = input.hook_event_name || input.hookEventName || '';
  if (event === 'UserPromptSubmit' || event === 'userPromptSubmitted') return handlePrompt(input);
  if (event === 'PreToolUse' || event === 'preToolUse') return handlePreTool(input);
  if (event === 'SessionStart' || event === 'sessionStart') return handleSessionStart(input);
  if (event === 'SessionEnd' || event === 'sessionEnd') return handleSessionEnd(input);
}

if (require.main === module) readInput(handle);

module.exports = {
  handle,
  handleGuardCommand,
  hookAgent,
  installCandidate,
  isInstallIntent,
  sessionKey,
  suppressionContext,
  triggerConflicts,
};
