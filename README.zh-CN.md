<p align="center">
  <img src="assets/banner.png" alt="Skill Collision Guard 横幅" width="100%">
</p>

<h1 align="center">Skill Collision Guard</h1>

<p align="center">
  为 coding-agent skill 和 plugin 提供安装前检查。
  在安装前发现重叠，比较完整指令，并在不删除文件的前提下处理冲突。
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f855a?style=flat-square" alt="MIT 许可证"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 18 或更高版本"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/runtime_dependencies-0-147d64?style=flat-square" alt="零运行时依赖"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/English-README.md-4b5563?style=flat-square" alt="英文 README"></a>
</p>

Skill Collision Guard 在 coding-agent skill 或 plugin 安装、触发之前进行检查。它可以识别同名覆盖、异名同义能力、相反策略、全局行为覆盖，以及应该共存的互补工作流。如果两个 skill 不应同时生效，可以在当前 session 中暂时屏蔽其中一个，之后恢复；整个过程不会移动、改写或删除原文件。

> [!IMPORTANT]
> 检测结果为零不代表一定兼容。能力分类经过人工维护，但不可能穷尽所有表达。除完全同名覆盖外，其他关系都应视为语义复核的证据，而不是自动裁决。

## 为什么需要它

Coding agent 会从用户目录、项目目录、plugin、extension 和系统内置目录发现指令。两个单独看都合理的 skill，一旦同时进入同一个 agent 的上下文，就可能悄悄竞争。

| 问题 | Guard 的处理方式 |
|---|---|
| 两个 skill 暴露相同名称 | 确定性报告同名覆盖，并建议只保留一个 |
| 名称不同但实际做同一件事 | 将别名和描述映射到 TDD、debugging、review、skill authoring 等能力族 |
| 全局编码模式改变固定工作流 | 报告行为干扰，并保持固定工作流优先 |
| 共享范围内的指令相互矛盾 | 展示相反策略，并暂停安装等待决策 |
| 两套审查分别提供不同价值 | 标记为互补，而不是把所有相似项都判定为冲突 |
| 冲突只在本次 session 中有影响 | 协作式屏蔽一个 skill，之后恢复，不改动安装内容 |

## 工作原理

```text
候选 skill 或 plugin
        |
        v
发现指定 agent 当前可见的已安装 skills
        |
        v
比较名称 + 能力 + 策略 + 行为范围
        |
        v
允许 | 人工复核 | session 屏蔽 | 只保留一个
```

检测器结合确定性规则、人工维护的能力分类，以及词法/策略启发式。报告会列出双方路径、关系类型、置信度、证据来源、受影响工作流、相反策略和建议操作。

## 检测信号

比较流程会优先执行置信度更高的规则。显式边界和成对动作会在通用相似度进入冲突分支前提前短路，从而避免把明显的配套 skill 误报为重复。

| 信号 | 实现 | 对判定的影响 |
|---|---|---|
| 同名覆盖 | `normalizeName` 将名称转为小写、把标点统一为连字符，再进行精确匹配 | 输出 `name-shadow` / `critical`；这是唯一可以自动裁决的关系 |
| 词法相似 | 对名称字符 bigram 和 description tokens 分别计算 Jaccard：`nameSimilarity * 0.45 + descriptionSimilarity * 0.55` | 参与 `probable-duplicate` 和 `overlap` 判定；body 相似度只保留给人工复核，不进入路由分数 |
| 能力族 | 为 TDD、debugging、skill authoring、code review、minimal implementation/YAGNI、codebase architecture 和 skill routing 维护名称/描述模式及 facet | 发现异名同义能力、同一能力中的不同角色，以及已知的跨 skill 关系 |
| 策略冲突 | 五组相反正则：依赖选择、回复详略、读写行为、审批要求和测试策略 | 只有双方还具备足够的作用域相似度时，才输出 `policy-conflict` / `high` |
| 行为干扰 | `behavior.js` 识别全局写入策略，单独记录它是否持久，再检查它是否会改变标记为固定工作流的能力 | 输出 `behavioral-interference` / `medium`；若同时存在相反策略，则升级为 `policy-conflict` / `high` |
| 成对动作与显式边界 | `save/restore`、`freeze/unfreeze`、`install/uninstall`、`enable/disable`、`start/stop`、`encode/decode`；description 也可以声明与另一个 skill `separate`、`different` 或 `distinct from` | 提前短路为 `distinct` 且不报警，即使通用词法相似度较高 |
| 人工定义的互补 facet | 能力族内的 facet 关系，目前包括“复杂度审查”与“正确性审查” | 输出 `complementary` / `info`；保留双方，并作为两个独立阶段运行 |

正是这套分层模型，让 `tdd` 与 `test-driven-development` 这类异名同义 skill 不再只依赖名称相似度，同时避免将 `save-state` 与 `restore-state` 错报为重复项。

## 快速开始

需要 Node.js 18 或更高版本，无第三方运行时依赖。

```bash
git clone https://github.com/Three-Liu/skill-collision-guard.git
cd skill-collision-guard
npm link
```

清点 Codex 当前可见的 skills：

```bash
skill-guard scan --agent codex
```

在安装前检查本地目录、GitHub URL、`owner/repo` 或本地 marketplace plugin：

```bash
skill-guard check-install \
  https://github.com/example/agent-plugin/tree/main/skills/example \
  --agent codex \
  --session "$SESSION_ID"
```

当发现 `critical/high` 冲突或 `medium behavioral-interference` 时，`check-install` 返回状态码 `2`，要求先做决策。明确选择共存后，可以只为一次安装命令设置 `SKILL_GUARD_ALLOW_CONFLICTS=1`，不要将它设为全局环境变量。

## ClawHub

[`skills/skill-collision-guard`](skills/skill-collision-guard) 是可独立运行的 ClawHub bundle。Frontmatter 声明了必须存在的 `node` 和 `git` 二进制；skill 指令同时披露本地文件读取、临时 shallow clone 子进程、session 状态写入和清理行为。

发布前使用 Node.js 22 或更高版本运行当前官方 `clawhub` CLI、完成认证、同步生成的运行时文件，并先预览本次发布。发布后的 skill 运行时本身仍支持 Node.js 18 或更高版本。

```bash
npm install --global clawhub
clawhub --help
clawhub login

npm run sync:skill-bundle
npm run check

clawhub skill publish ./skills/skill-collision-guard \
  --version 0.1.0 \
  --changelog "Initial public release." \
  --dry-run
```

检查 dry-run 输出后，去掉 `--dry-run` 再执行一次即可发布。只有同时发布多个 skill 目录时，才改用 `clawhub sync --all --dry-run`。不要自行创建 `clawhub.json`：当前注册表以每个 bundle 内的 `SKILL.md` 为中心。

发布后，用户通过带 owner 的名称安装：

```bash
clawhub install @<owner>/skill-collision-guard
```

`.clawhub/origin.json` 和 workspace lock 数据由 ClawHub 在安装方机器上生成，不应由本仓库手写。每个提交的 artifact 都会检查 metadata 与实际内容是否一致，并经过 SkillSpector、VirusTotal 和基于 ClawScan 的风险分析。ClawHub 上发布的 skill bundle 使用 MIT-0；完整仓库仍采用 [MIT 许可证](LICENSE)。

官方参考：[ClawHub CLI](https://docs.openclaw.ai/clawhub/cli)、[发布流程](https://docs.openclaw.ai/clawhub/publishing)、[skill 格式](https://docs.openclaw.ai/clawhub/skill-format)和[安全审计](https://docs.openclaw.ai/clawhub/security-audits)。

## 命令参考

```bash
# 跨 agent 或指定宿主清点
skill-guard scan [--agent codex] [--json]

# 安装前检查
skill-guard check-install <path|github-url|owner/repo|plugin@marketplace> \
  [--agent codex] [--session ID] [--json]

# 直接进行语义比较
skill-guard compare <skill-or-plugin> <skill-or-plugin> [--json]

# 可恢复的 session 状态
skill-guard suppress <name-or-path>... --session ID [--json]
skill-guard status --session ID [--json]
skill-guard restore [name-or-path]... --session ID [--json]
```

使用 `--agent <host>` 只检查该宿主可见的目录。Codex 范围包含 Codex 专属目录和共享的 `.agents/skills`。只有确实需要跨 agent 清点时才省略 `--agent`；多个宿主名可以用逗号分隔。

## 关系模型

| 关系 | 含义 | 默认处理 |
|---|---|---|
| `name-shadow` | 标准化后同名 | 只保留一个 |
| `capability-collision` | 名称不同但能力相同 | 阅读双方完整指令后只保留一个 |
| `capability-conflict` | 同一能力存在不兼容的角色或行为 | 选择当前任务需要的行为 |
| `behavioral-interference` | 全局写入策略可能改变固定工作流 | 保持固定工作流优先，在重叠期间屏蔽覆盖层 |
| `policy-conflict` | 重叠范围内存在相反指令 | 暂停并选择一种策略 |
| `capability-overlap` | 相关能力子角色发生重叠 | 明确触发边界 |
| `complementary` | 不同阶段分别提供价值 | 两者保留并分开执行 |
| `probable-duplicate` | 目标和指令高度重叠 | 优先保留范围更窄或维护更好的 skill |
| `overlap` | 可能同时触发，但可以共存 | 让描述和适用范围更明确 |

## Session 屏蔽

屏蔽属于指令层的 session overlay，不会删除、重命名或修改已安装 skill。

```bash
skill-guard suppress code-review --session "$SESSION_ID"
skill-guard status --session "$SESSION_ID"
skill-guard restore code-review --session "$SESSION_ID"
```

支持生命周期 hook 的宿主也可以通过 prompt 命令使用同一份状态：

```text
/skill-guard suppress code-review
/skill-guard restore code-review
```

`SessionEnd` 会清理 session 状态。对于没有生命周期 hook 的宿主，屏蔽仍然是协作式约束：agent 必须在选择 skill 前读取状态。

## 宿主支持

项目只维护一个分析器，各宿主使用轻量适配层。目录发现范围是显式配置的，因此 prompt hook 不会遍历整个用户目录。

| 宿主 | 集成方式 |
|---|---|
| Codex | Plugin manifest，以及 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`SessionEnd` hooks |
| Claude Code | Plugin manifest，共用同一套 hook 实现 |
| GitHub Copilot CLI | Plugin manifest 和 prompt/install hooks |
| Gemini CLI | `GEMINI.md` 指令适配，不注册不兼容的生命周期 schema |
| OpenCode | Server plugin，注册 skill 并注入已安装冲突摘要 |
| Qoder | Plugin manifest、rule 和 hook 模板 |
| Cursor、Windsurf、Cline | Always-on rule 适配，通过 CLI 做协作式检查 |
| Kiro、Grok、Swival、OpenClaw | Skill 目录发现和标准 `SKILL.md` 工作流 |

完整的项目级、用户级、extension 和 plugin-cache 目录见 [Agent portability](docs/agent-portability.md)。

## 项目结构

```text
skill-collision-guard/
|-- bin/                         CLI 入口
|-- src/                         发现、解析、分析、报告、状态
|-- hooks/                       生命周期适配
|-- skills/skill-collision-guard 内置 Agent Skill
|   |-- bin/ 和 src/             为 ClawHub 生成的独立运行时
|-- docs/                        跨宿主适配说明
|-- scripts/                     发布 bundle 同步工具
|-- tests/                       Node 测试套件
|-- CHANGELOG.md                 semver 发布历史
|-- .codex-plugin/               Codex manifest
|-- .claude-plugin/              Claude Code manifest
`-- .github/ 和其他适配目录      其他宿主集成
```

## 已知限制

- 能力别名由人工维护，未分类的同义表达可能仍需手动比较。
- 相似度分数只是信号，不能证明两套指令可以互换。
- 远程候选通过临时浅克隆检查；下载或解析失败会报告为检查未完成，而不是“没有冲突”。
- Hook 屏蔽是协作式指令状态，不是操作系统级访问控制。
- 仅支持 prompt 的宿主无法保证拦截所有原生 UI 安装行为。

## 开发与验证

```bash
npm run sync:skill-bundle
npm test
npm run check
npm pack --dry-run
```

测试覆盖目录发现边界、候选解析、别名分类、策略冲突、报告输出、hooks、manifests、可恢复 session 状态，以及主运行时与 ClawHub bundle 的漂移。

## 许可证

[MIT](LICENSE) © 2026 Skill Collision Guard contributors。
