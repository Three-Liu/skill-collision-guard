import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { clusters } = require('../../src/analyzer');
const { discoverSkills } = require('../../src/discovery');
const { formatComparisons } = require('../../src/report');

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default async ({ directory } = {}) => ({
  config: async (config) => {
    config.skills = config.skills || {};
    config.skills.paths = config.skills.paths || [];
    const skills = path.join(pluginRoot, 'skills');
    if (!config.skills.paths.includes(skills)) config.skills.paths.push(skills);
  },

  'experimental.chat.system.transform': async (_input, output) => {
    const collisions = clusters(discoverSkills({ cwd: directory || process.cwd(), agent: 'opencode' }));
    if (!collisions.length) return;
    output.system.push([
      'SKILL COLLISION GUARD detected installed skills that may compete on this turn.',
      formatComparisons(collisions.slice(0, 6)),
      'Before invoking one of these skills, tell the user which one you selected. Use the skill-collision-guard workflow for suppression or removal decisions.',
    ].join('\n'));
  },
});
