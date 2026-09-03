'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function temporary(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `skill-guard-${name}-`));
}

function writeSkill(root, name, description, body = '') {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`, 'utf8');
  return file;
}

module.exports = { temporary, writeSkill };
