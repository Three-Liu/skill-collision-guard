'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function stateDir() {
  if (process.env.SKILL_GUARD_STATE_DIR) return process.env.SKILL_GUARD_STATE_DIR;
  const base = process.env.XDG_STATE_HOME || (process.platform === 'win32'
    ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'))
    : path.join(os.homedir(), '.local', 'state'));
  return path.join(base, 'skill-collision-guard');
}

function safeSessionId(value) {
  const source = String(value || 'default');
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
}

function statePath(sessionId) {
  return path.join(stateDir(), 'sessions', `${safeSessionId(sessionId)}.json`);
}

function readSession(sessionId) {
  try {
    const value = JSON.parse(fs.readFileSync(statePath(sessionId), 'utf8'));
    return value && Array.isArray(value.suppressed) ? value : { suppressed: [] };
  } catch (_) {
    return { suppressed: [] };
  }
}

function writeSession(sessionId, value) {
  const file = statePath(sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = { session: String(sessionId || 'default'), updatedAt: new Date().toISOString(), suppressed: value.suppressed || [] };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function suppress(sessionId, selectors) {
  const current = readSession(sessionId);
  current.suppressed = [...new Set([...current.suppressed, ...selectors.map(String)])].sort();
  return writeSession(sessionId, current);
}

function restore(sessionId, selectors = []) {
  const current = readSession(sessionId);
  if (!selectors.length) current.suppressed = [];
  else {
    const remove = new Set(selectors.map(String));
    current.suppressed = current.suppressed.filter((item) => !remove.has(item));
  }
  return writeSession(sessionId, current);
}

function clearSession(sessionId) {
  try { fs.unlinkSync(statePath(sessionId)); } catch (_) {}
}

module.exports = { clearSession, readSession, restore, safeSessionId, stateDir, statePath, suppress };
