'use strict';

const fs = require('fs');
const path = require('path');

function unquote(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\([\\"'])/g, '$1');
  }
  return trimmed;
}

function parseFrontmatter(source) {
  const normalized = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!normalized.startsWith('---\n')) return { attributes: {}, body: normalized };
  const end = normalized.indexOf('\n---', 4);
  if (end < 0) return { attributes: {}, body: normalized };

  const lines = normalized.slice(4, end).split('\n');
  const attributes = {};
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (value === '>' || value === '|') {
      const folded = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        folded.push(lines[index + 1].trim());
        index += 1;
      }
      value = value === '>' ? folded.join(' ') : folded.join('\n');
    }
    attributes[match[1]] = unquote(value);
  }
  return { attributes, body: normalized.slice(end + 4).replace(/^\s+/, '') };
}

function readSkill(file, origin = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const { attributes, body } = parseFrontmatter(source);
  const directory = path.dirname(file);
  return {
    name: attributes.name || path.basename(directory),
    description: attributes.description || '',
    path: path.resolve(file),
    directory: path.resolve(directory),
    body,
    source,
    agent: origin.agent || 'candidate',
    scope: origin.scope || 'candidate',
  };
}

function locateSkillFiles(target, maxDepth = 8) {
  const start = path.resolve(target);
  if (!fs.existsSync(start)) return [];
  if (fs.statSync(start).isFile()) return path.basename(start).toLowerCase() === 'skill.md' ? [start] : [];

  const files = [];
  const seen = new Set();
  function walk(current, depth) {
    if (depth < 0) return;
    let real;
    try {
      real = fs.realpathSync(current);
    } catch (_) {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') files.push(full);
      else if ((entry.isDirectory() || entry.isSymbolicLink()) && depth > 0) walk(full, depth - 1);
    }
  }
  walk(start, maxDepth);
  return files;
}

function directSkillFiles(root) {
  const files = [];
  try {
    const own = path.join(root, 'SKILL.md');
    if (fs.existsSync(own) && fs.statSync(own).isFile()) files.push(own);
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const file = path.join(root, entry.name, 'SKILL.md');
      try {
        if (fs.statSync(file).isFile()) files.push(file);
      } catch (_) {}
    }
  } catch (_) {}
  return files;
}

function locateSkillRoots(target, maxDepth = 8) {
  const start = path.resolve(target);
  const roots = [];
  const seen = new Set();
  function walk(current, depth) {
    if (depth < 0) return;
    let real;
    try { real = fs.realpathSync(current); } catch (_) { return; }
    if (seen.has(real)) return;
    seen.add(real);
    if (path.basename(current).toLowerCase() === 'skills') {
      roots.push(current);
      return;
    }
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if ((entry.isDirectory() || entry.isSymbolicLink()) && depth > 0) walk(path.join(current, entry.name), depth - 1);
    }
  }
  walk(start, maxDepth);
  return roots;
}

function readCandidate(target) {
  if (/^(?:https?|git\+|ssh):\/\//i.test(target) || /^[\w.-]+\/[\w.-]+(?:@[^/]+)?$/.test(target)) {
    const error = new Error(`Remote candidate cannot be inspected directly: ${target}`);
    error.code = 'REMOTE_CANDIDATE';
    throw error;
  }
  const resolved = path.resolve(target);
  let files = [];
  try {
    if (fs.statSync(resolved).isFile()) files = locateSkillFiles(resolved, 0);
    else if (fs.existsSync(path.join(resolved, 'SKILL.md'))) files = [path.join(resolved, 'SKILL.md')];
    else if (fs.existsSync(path.join(resolved, 'skills'))) files = directSkillFiles(path.join(resolved, 'skills'));
    else files = locateSkillFiles(resolved);
  } catch (_) {}
  if (!files.length) {
    const error = new Error(`No SKILL.md found under ${target}`);
    error.code = 'NO_SKILLS';
    throw error;
  }
  return files.map((file) => readSkill(file));
}

module.exports = { directSkillFiles, locateSkillFiles, locateSkillRoots, parseFrontmatter, readCandidate, readSkill };
