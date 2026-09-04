---
name: skill-collision-guard
description: Check for overlapping, duplicate, shadowing, or contradictory coding-agent skills before installing a skill/plugin or when multiple skills may trigger; compare them and help remove or reversibly suppress one for the current session.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - git
---

# Skill Collision Guard

Use the deterministic CLI bundled with this skill instead of judging conflicts from names alone. Resolve the runtime root from this `SKILL.md` path:

- Standalone/ClawHub bundle: use this skill directory.
- Host plugin bundle: use the nearest ancestor that contains `bin/skill-guard.js` and `src/`.

Then run:

```bash
node <plugin-root>/bin/skill-guard.js check-install <candidate> --agent <current-agent> --session <session-id>
```

The candidate can be a local skill/plugin path, a GitHub URL or `owner/repo`, or a locally configured `plugin@marketplace` reference.

## Runtime and Access

- Requires Node.js 18 or newer. Remote Git candidates also use the declared `git` binary.
- Inventory scans read `SKILL.md` files only from the explicit project, user, system, extension, and plugin-cache roots owned by the selected host. They do not crawl the entire home directory.
- Local candidate checks read files below the user-supplied candidate path. The detector parses instructions but never executes candidate skill code.
- Remote candidate checks launch `git clone --depth 1` as a child process with a 20-second default timeout. The clone is created under the operating-system temporary directory and removed after success or failure.
- Suppression writes only a small JSON state file under `$SKILL_GUARD_STATE_DIR`, `$XDG_STATE_HOME/skill-collision-guard`, or the platform user-state directory. Session end removes only that session file.
- The detector does not install, remove, rename, or edit another skill. It does not request credentials or transmit the contents of installed skills to a service.

## Decisions

- `name-shadow`: two skills expose the same normalized name. Recommend keeping one.
- `capability-collision`: differently named skills provide the same capability. Compare their full instructions before choosing one.
- `capability-conflict`: the same capability is governed by incompatible roles or behavior. Ask which behavior applies.
- `capability-overlap`: related capability facets may coexist if their trigger boundaries are clear.
- `behavioral-interference`: a global write policy can alter a fixed workflow. Keep the fixed workflow authoritative and suppress the overlay while they overlap.
- `complementary`: the skills cover separate, useful passes. Keep both and run them separately.
- `policy-conflict`: their scopes overlap but their instructions disagree. Ask which policy applies to the current task.
- `probable-duplicate`: their goals and instructions substantially overlap. Recommend the narrower or better-maintained skill.
- `overlap`: both may trigger, but can coexist if their descriptions clearly separate their scopes.

Show the compared names, paths, descriptions, relationship type, score, evidence source, affected workflows, opposing policies, and recommendation. Treat curated and automatic results as evidence requiring semantic review, except exact same-name shadowing. For a consequential decision, read both `SKILL.md` files before advising which one to remove. Never remove, rename, or edit an installed skill without the user's approval.

An exit status of `2` means installation needs a user decision, including medium behavioral interference. Do not bypass it silently.

## Session Suppression

Prefer reversible session suppression when the user only needs one skill temporarily:

```bash
node <plugin-root>/bin/skill-guard.js suppress <name-or-path> --session <session-id>
node <plugin-root>/bin/skill-guard.js restore <name-or-path> --session <session-id>
```

With lifecycle hooks enabled, `/skill-guard suppress <name-or-path>` and `/skill-guard restore [name-or-path]` update the same session state. Suppression is an instruction-level session overlay: it does not move or delete files. The session-end hook removes it automatically.

If the host has no lifecycle hook support, keep the suppression instruction in the active conversation and use `status` before each skill invocation. State clearly that this is cooperative rather than host-enforced.

## Installed Inventory

Use `scan` to find cross-agent duplicates already present:

```bash
node <plugin-root>/bin/skill-guard.js scan --agent <current-agent>
```

The `codex` scope includes both Codex-specific roots and portable `.agents/skills`. Do not treat a clean heuristic result as proof of semantic compatibility. Capability families are deliberately curated; if two unclassified skills affect the same high-risk workflow, compare their full instructions even when their score is below the warning threshold.
