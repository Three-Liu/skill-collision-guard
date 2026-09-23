# Changelog

All notable changes to this project are documented here.

The project follows [Semantic Versioning](https://semver.org/). ClawHub release notes are supplied with the matching version when the skill bundle is published.

## [0.1.1] - 2026-09-23

### Security

- Keep local candidate discovery inside the canonical root, including defense against escaping symbolic links.
- Make remote Git inspection and temporary cleanup explicit in CLI/hook disclosures, and clean both comparison candidates on partial failure.
- Declare the ClawHub skill's tool/runtime/state requirements and disable implicit invocation in the OpenAI adapter.

## [0.1.0] - 2026-09-04

### Added

- Cross-agent discovery for Codex, Claude Code, GitHub Copilot, Gemini, OpenCode, Cursor, Windsurf, Cline, Qoder, Kiro, Grok, Swival, and OpenClaw.
- Detection for name shadowing, synonymous capabilities, opposing policies, behavioral interference, complementary workflows, and lexical overlap.
- Installation and invocation hooks for supported hosts.
- Reversible, session-scoped suppression.
- Self-contained ClawHub skill bundle with declared Node.js and Git requirements.
