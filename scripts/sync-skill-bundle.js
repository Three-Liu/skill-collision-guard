#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bundle = path.join(root, 'skills', 'skill-collision-guard');
const files = [
  path.join('bin', 'skill-guard.js'),
  ...fs.readdirSync(path.join(root, 'src'))
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => path.join('src', file)),
];

function contents(file) {
  try {
    return fs.readFileSync(file);
  } catch (_) {
    return null;
  }
}

function synchronized(relative) {
  const source = contents(path.join(root, relative));
  const target = contents(path.join(bundle, relative));
  return source && target && source.equals(target);
}

if (process.argv.includes('--check')) {
  const drifted = files.filter((file) => !synchronized(file));
  if (drifted.length) {
    process.stderr.write(`ClawHub bundle is stale: ${drifted.join(', ')}\nRun npm run sync:skill-bundle.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`ClawHub bundle is synchronized (${files.length} files).\n`);
  }
} else {
  for (const relative of files) {
    const source = path.join(root, relative);
    const target = path.join(bundle, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.chmodSync(target, fs.statSync(source).mode);
  }
  process.stdout.write(`Synchronized ${files.length} runtime files into ${path.relative(root, bundle)}.\n`);
}
