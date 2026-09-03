# Agent portability

The analyzer owns behavior; host adapters only load it. Directory discovery is deliberately explicit so a prompt hook never crawls an entire home directory.

| Host | Project skills | User/plugin skills | Integration |
|---|---|---|---|
| Codex / Agent Skills | `.agents/skills`, `.codex/skills` | `~/.agents/skills`, `~/.codex/skills`, `/etc/codex/skills` | Codex manifest + `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `SessionEnd` hooks |
| Claude Code | `.claude/skills` | `~/.claude/skills`, `~/.claude/plugins/cache/**/skills` | Claude manifest using the shared hook file |
| GitHub Copilot CLI | `.github/skills` | `~/.copilot/skills`, `~/.vscode/agent-plugins/**/skills` | Copilot plugin hooks for session/prompt checks |
| Gemini CLI | `.gemini/skills` | `~/.gemini/skills`, `~/.gemini/extensions/**/skills` | `GEMINI.md` instruction adapter; no incompatible lifecycle hooks are registered |
| OpenCode | `.opencode/skills` | `$XDG_CONFIG_HOME/opencode/skills` | Server plugin registers the skill and injects installed collision summaries |
| Qoder | `.qoder/skills` | `~/.qoder/skills` | Plugin manifest, rule, and hook template |
| Cursor / Windsurf / Cline | Agent-specific `.*/skills` | matching user directory | Always-on rule adapter; cooperative checks through the bundled CLI |
| Kiro / Grok | `.kiro/skills`, `.grok/skills` | matching user directory | Discovery support; bundled skill or `AGENTS.md` supplies the workflow |
| Swival / OpenClaw | `.swival/skills`, `.openclaw/skills` | XDG Swival or `~/.openclaw/skills` | Discovery support and standard `SKILL.md` |

Only direct children of an actual `skills` root are treated as host-discoverable skills. For plugin caches and extension roots, the scanner first locates directories named `skills`, then reads their direct children. This avoids counting fixtures, references, and generated adapter copies as separate installations.

Codex and Claude provide the strongest integration because `PreToolUse` can pause a shell-based installation. Their hook manifests pass `--agent codex` or `--agent claude` explicitly; Copilot and Qoder do the same in their adapters. Prompt-only hosts cannot guarantee interception of every native UI install; their adapter instructs the agent to run `check-install` before mutation and labels suppression as cooperative.

For manual CLI checks, pass `--agent <host>` to scan only roots visible to that host. The `codex` scope also includes portable `.agents/skills` roots; omit `--agent` only for an intentional cross-agent inventory.
