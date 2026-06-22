# Installed Skills, Commands & Agents

This directory was populated by installing the skill collections requested for this
project. Skills live in `.claude/skills/<name>/SKILL.md`, slash commands in
`.claude/commands/`, and subagents in `.claude/agents/`.

## Summary

- **Skills:** 374 (each `.claude/skills/<name>/SKILL.md`, with any `references/`,
  `scripts/`, `assets/`, `expected_outputs/` support files preserved)
- **Commands:** 41 (`.claude/commands/*.md`)
- **Agents:** 35 (`.claude/agents/*.md`)

## Sources

| Source | What was installed |
| --- | --- |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp/blob/main/.claude/skills/release.md) | `release` skill |
| [emilkowalski/skills](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md) | `emil-design-eng` skill |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `ui-ux-pro-max`, `design`, `design-system`, `banner-design`, `brand`, `slides`, `ui-styling` skills |
| [hex/claude-council](https://github.com/hex/claude-council) | `council-execution`, `deep-execution`, `local-council-execution`, `provider-integration` skills |
| [obra/Superpowers](https://github.com/obra/Superpowers) | 14 skills (brainstorming, systematic-debugging, test-driven-development, writing-plans, writing-skills, etc.) |
| [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) | `stop-slop` skill (+ references) |
| [anthropics/claude-code · frontend-design](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) | `frontend-design` skill |
| [anthropics/claude-code · code-review](https://github.com/anthropics/claude-code/blob/main/plugins/code-review/README.md) | `code-review` slash command |
| [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) | `security-review` slash command |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | ~345 skills, plus its commands and agents |

## Notes

- `claude-skills` is a large multi-format collection. Its flat skill index contained
  alias shims pointing at slash commands and subagents; those were installed into
  `.claude/commands/` and `.claude/agents/` respectively rather than as skills.
- One name collision (`design-system`) was resolved by keeping the dedicated
  ui-ux-pro-max version and installing the claude-skills variant as
  `design-system-claudeskills`.
- `sample-skill` is a frontmatter-free reference/template included upstream; it is
  kept as-is and is not auto-discovered as a skill.
