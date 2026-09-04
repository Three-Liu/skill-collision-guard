'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ancestors, findRepoRoot } = require('./platforms');
const { readCandidate } = require('./skill');

function marketplaceFiles(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const home = path.resolve(options.home || os.homedir());
  const repoRoot = findRepoRoot(cwd);
  return [
    ...ancestors(cwd, repoRoot).map((level) => path.join(level, '.agents', 'plugins', 'marketplace.json')),
    path.join(home, '.agents', 'plugins', 'marketplace.json'),
  ];
}

function resolveMarketplaceCandidate(reference, options = {}) {
  const separator = reference.lastIndexOf('@');
  if (separator <= 0) return null;
  const pluginName = reference.slice(0, separator);
  const marketplaceName = reference.slice(separator + 1);
  for (const file of marketplaceFiles(options)) {
    let marketplace;
    try {
      marketplace = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {
      continue;
    }
    if (marketplace.name !== marketplaceName) continue;
    const plugin = (marketplace.plugins || []).find((item) => item.name === pluginName);
    if (!plugin || plugin.source?.source !== 'local' || !plugin.source.path) return null;
    const marketplaceRoot = path.resolve(path.dirname(file), '..', '..');
    return path.resolve(marketplaceRoot, plugin.source.path);
  }
  return null;
}

function isRemote(reference) {
  return /^(?:https?|git\+|ssh):\/\//i.test(reference) || /^git@[^:]+:.+/.test(reference) ||
    /^[\w.-]+\/[\w.-]+(?:@[^/]+)?$/.test(reference);
}

function githubUrl(reference) {
  if (/^[\w.-]+\/[\w.-]+(?:@[^/]+)?$/.test(reference)) {
    const [repo, ref] = reference.split('@');
    return { url: `https://github.com/${repo.replace(/\.git$/, '')}.git`, ref: ref || null, subpath: '' };
  }
  const tree = reference.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?\/?$/i);
  if (tree) {
    return {
      url: `https://github.com/${tree[1]}/${tree[2].replace(/\.git$/, '')}.git`,
      ref: decodeURIComponent(tree[3]),
      subpath: tree[4] || '',
    };
  }
  return { url: reference.replace(/^git\+/, ''), ref: null, subpath: '' };
}

function loadCandidate(reference, options = {}) {
  const marketplacePath = resolveMarketplaceCandidate(reference, options);
  const local = marketplacePath || path.resolve(options.cwd || process.cwd(), reference);
  if (fs.existsSync(local)) return { source: local, skills: readCandidate(local), cleanup() {} };

  if (!isRemote(reference)) {
    const error = new Error(`Candidate not found: ${reference}`);
    error.code = 'CANDIDATE_NOT_FOUND';
    throw error;
  }

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guard-candidate-'));
  const remote = githubUrl(reference);
  const args = ['clone', '--depth', '1'];
  if (remote.ref) args.push('--branch', remote.ref);
  args.push(remote.url, temporary);
  const result = spawnSync('git', args, { encoding: 'utf8', timeout: options.timeout || 20000 });
  if (result.status !== 0) {
    fs.rmSync(temporary, { recursive: true, force: true });
    const detail = (result.stderr || result.error?.message || 'git clone failed').trim();
    const error = new Error(`Unable to inspect remote candidate ${reference}: ${detail}`);
    error.code = 'REMOTE_INSPECTION_FAILED';
    throw error;
  }
  try {
    const candidateRoot = remote.subpath ? path.resolve(temporary, remote.subpath) : temporary;
    if (!candidateRoot.startsWith(`${temporary}${path.sep}`) && candidateRoot !== temporary) {
      const error = new Error(`GitHub candidate subpath escapes the repository: ${remote.subpath}`);
      error.code = 'INVALID_SUBPATH';
      throw error;
    }
    const skills = readCandidate(candidateRoot);
    return {
      source: reference,
      skills,
      cleanup() { fs.rmSync(temporary, { recursive: true, force: true }); },
    };
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { githubUrl, isRemote, loadCandidate, marketplaceFiles, resolveMarketplaceCandidate };
