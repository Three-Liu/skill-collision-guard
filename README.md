# Skill Collision Guard

[English](#english) | [中文](#中文)

## English

Skill Collision Guard checks coding-agent skills and plugins before installation or invocation. It detects name shadowing, synonymous capabilities, opposing policies, broad behavioral overlays, and complementary workflows. Conflicting skills can be cooperatively suppressed for one session and restored without moving, editing, or deleting their files.

The project uses one core skill and thin host adapters. Its Codex integration follows the official [Build skills](https://developers.openai.com/codex/skills) and [Hooks](https://developers.openai.com/codex/hooks) conventions.

### Features

- Scans common project, user, system, extension, and plugin-cache roots for Codex, Claude Code, Gemini, Copilot, OpenCode, Cursor, Windsurf, Cline, Qoder, Kiro, Grok, Swival, and OpenClaw.
- Maps aliases and descriptions to curated capability families, including TDD, debugging, skill authoring, code review, codebase architecture, skill routing, and minimal implementation/YAGNI.
- Distinguishes duplicate capabilities, incompatible facets, behavioral interference, ordinary overlap, and complementary review passes.
- Checks local paths, GitHub URLs, `owner/repo` references, and local `plugin@marketplace` entries before installation.
- Uses `PreToolUse` to pause installations that need a decision and `UserPromptSubmit` to inspect explicit or high-confidence implicit skill invocation.
- Keeps session suppression reversible and non-destructive. It is an instruction-level overlay, not host-enforced access control.

### CLI

Node.js 18 or newer is required. There are no third-party runtime dependencies.

```bash
npm link
skill-guard scan --agent codex
skill-guard check-install ./some-plugin --agent codex --session "$SESSION_ID"
skill-guard compare ./skill-a ./skill-b
skill-guard suppress code-review --session "$SESSION_ID"
skill-guard status --session "$SESSION_ID"
skill-guard restore code-review --session "$SESSION_ID"
```

Use `--agent <host>` to inspect only roots visible to that host. The `codex` scope includes Codex-specific roots and portable `.agents/skills`; omit `--agent` only for an intentional cross-agent inventory. Multiple hosts can be comma-separated.

`check-install` exits with status `2` for critical/high conflicts and medium behavioral interference because both need a user decision. After an explicit decision to coexist, `SKILL_GUARD_ALLOW_CONFLICTS=1` may be set for one installation command. Do not set it globally.

### Relationship Model

| Type | Meaning | Default action |
|---|---|---|
| `name-shadow` | Same normalized name | Keep one |
| `capability-collision` | Different names, same capability | Compare full instructions and keep one |
| `capability-conflict` | Same capability with incompatible roles or behavior | Choose the behavior needed for the task |
| `behavioral-interference` | A global write policy can alter a fixed workflow | Keep the fixed workflow authoritative; suppress the overlay when they overlap |
| `policy-conflict` | Overlapping scopes contain opposing instructions | Pause and choose one policy |
| `capability-overlap` | Related capability facets overlap | Clarify trigger boundaries |
| `complementary` | Skills cover separate, useful passes | Keep both and run them separately |

Reports identify whether evidence came from the curated taxonomy or automatic lexical/policy heuristics. Relationships other than exact name shadowing require manual review. A clean automated result is not proof of semantic compatibility because the curated taxonomy is intentionally finite.

### Host Integration

Codex and Claude Code use `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json`. Codex loads `hooks/hooks.json`; Claude loads `hooks/claude-codex-hooks.json`. Each hook passes its host name explicitly so host-only skill directories do not leak into another agent's session.

Other adapters:

- GitHub Copilot CLI: `.github/plugin/plugin.json`
- Gemini CLI: root `GEMINI.md`; no incompatible lifecycle schema is registered
- OpenCode: `opencode.json` and `.opencode/plugins/skill-collision-guard.mjs`
- Qoder: `.qoder-plugin/plugin.json`; full hook template in `hooks/qoder-hooks.json`
- Rule-file hosts: `AGENTS.md` and the matching `.cursor`, `.windsurf`, or `.clinerules` adapter

See [docs/agent-portability.md](docs/agent-portability.md) for the complete directory map.

### Session Suppression

Lifecycle-enabled hosts accept:

```text
/skill-guard suppress code-review
/skill-guard restore code-review
```

The same state is available through the CLI. `SessionEnd` removes the session state. Hosts without lifecycle hooks can use the CLI and conversation instructions, but suppression remains cooperative.

### Verification

```bash
npm test
npm run check
```

Remote candidates are inspected through a temporary shallow clone and cleaned up afterward. Download or parsing failures are reported as incomplete checks, never as conflict-free results.

## 中文

Skill Collision Guard 在安装或触发 coding-agent skill/plugin 前进行检查。它可以识别同名覆盖、异名同义能力、相反策略、全局行为覆盖和互补工作流。冲突 skill 可以只在当前 session 中协作式屏蔽，之后恢复；工具不会为此移动、改写或删除原文件。

项目采用“一个核心 skill + 多个宿主薄适配器”的结构。Codex 集成遵循官方 [Build skills](https://developers.openai.com/codex/skills) 和 [Hooks](https://developers.openai.com/codex/hooks) 约定。

### 功能

- 扫描 Codex、Claude Code、Gemini、Copilot、OpenCode、Cursor、Windsurf、Cline、Qoder、Kiro、Grok、Swival 和 OpenClaw 的常见项目级、用户级、系统级、扩展和插件缓存目录。
- 将别名和 description 映射到人工维护的能力族，包括 TDD、debugging、skill authoring、code review、codebase architecture、skill routing 和 minimal implementation/YAGNI。
- 区分能力重复、子角色冲突、行为干扰、普通重叠和互补审查。
- 在安装前检查本地路径、GitHub URL、`owner/repo` 和本地 marketplace 中的 `plugin@marketplace`。
- 通过 `PreToolUse` 暂停需要决策的安装，通过 `UserPromptSubmit` 检查显式触发和高置信度隐式触发。
- session 屏蔽可恢复且无破坏性。它是指令层覆盖，不是宿主强制的访问控制。

### CLI

需要 Node.js 18 或更高版本，无第三方运行时依赖。

```bash
npm link
skill-guard scan --agent codex
skill-guard check-install ./some-plugin --agent codex --session "$SESSION_ID"
skill-guard compare ./skill-a ./skill-b
skill-guard suppress code-review --session "$SESSION_ID"
skill-guard status --session "$SESSION_ID"
skill-guard restore code-review --session "$SESSION_ID"
```

使用 `--agent <host>` 只检查该宿主可见的目录。`codex` 范围包含 Codex 专属目录和共享 `.agents/skills`；只有确实要做跨 agent 清点时才省略 `--agent`。多个宿主名可用逗号分隔。

发现 `critical/high` 冲突或 `medium behavioral-interference` 时，`check-install` 返回退出码 `2`，要求用户先决策。明确决定共存后，可只为单次安装命令设置 `SKILL_GUARD_ALLOW_CONFLICTS=1`，不要设为全局环境变量。

### 关系模型

| 类型 | 含义 | 默认处理 |
|---|---|---|
| `name-shadow` | 标准化后同名 | 只保留一个 |
| `capability-collision` | 名称不同但能力相同 | 阅读完整指令后只保留一个 |
| `capability-conflict` | 同一能力的角色或行为不兼容 | 选择当前任务需要的行为 |
| `behavioral-interference` | 全局写入策略可能改变固定工作流 | 以固定工作流为准，重叠时屏蔽覆盖层 |
| `policy-conflict` | 重叠范围内存在相反指令 | 暂停并选择一种策略 |
| `capability-overlap` | 相关能力子角色重叠 | 明确触发边界 |
| `complementary` | 分别覆盖有价值的独立阶段 | 两者保留并分开执行 |

报告会说明证据来自人工维护的能力分类，还是自动词法/策略启发式。除完全同名覆盖外，其余关系都需要语义复核。由于能力词表是有限集合，自动检查为零不能证明语义上完全兼容。

### 宿主集成

Codex 和 Claude Code 分别使用 `.codex-plugin/plugin.json` 与 `.claude-plugin/plugin.json`。Codex 加载 `hooks/hooks.json`，Claude 加载 `hooks/claude-codex-hooks.json`。每份 hook 都显式传入宿主名，避免其他 agent 的专属目录混入当前 session。

其他适配入口：

- GitHub Copilot CLI：`.github/plugin/plugin.json`
- Gemini CLI：根目录 `GEMINI.md`，不注册不兼容的 lifecycle schema
- OpenCode：`opencode.json` 和 `.opencode/plugins/skill-collision-guard.mjs`
- Qoder：`.qoder-plugin/plugin.json`，完整 hook 模板见 `hooks/qoder-hooks.json`
- 规则文件宿主：`AGENTS.md` 和对应的 `.cursor`、`.windsurf`、`.clinerules` 适配文件

完整目录映射见 [docs/agent-portability.md](docs/agent-portability.md)。

### Session 屏蔽

支持 lifecycle hook 的宿主可输入：

```text
/skill-guard suppress code-review
/skill-guard restore code-review
```

CLI 使用同一份状态。`SessionEnd` 会删除当前 session 状态。没有 lifecycle hook 的宿主可使用 CLI 和对话指令，但屏蔽仍属于协作式约束。

### 验证

```bash
npm test
npm run check
```

远程候选通过临时浅克隆检查，并在结束后清理。下载或解析失败会被报告为检查未完成，不会被描述为“没有冲突”。
