# Skill Collision Guard

Before installing any coding-agent skill, extension, or plugin in Codex, run `node bin/skill-guard.js check-install <source> --agent codex --session <session-id>` from this checkout and show detected relationships to the user. Exit code 2 requires a user choice before installation.

When a prompt explicitly invokes a skill, or several installed skill descriptions fit the same request, compare them with `node bin/skill-guard.js compare <left> <right>`. Explain same-name shadowing, overlapping scope, and opposing policies before choosing one.

For a temporary choice, use `node bin/skill-guard.js suppress <name-or-path> --session <session-id>`. Do not load or follow suppressed skills in that session. Restore with `node bin/skill-guard.js restore [name-or-path] --session <session-id>`. Suppression never authorizes deleting or moving the original skill.
