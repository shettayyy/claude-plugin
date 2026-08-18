# claude-tools

My personal Claude Code setup, versioned as a plugin so every laptop runs the
same commands, skills, agents, and global rules.

## Install on a new machine

```bash
claude plugin marketplace add shettayyy/claude-tools
claude plugin install tools@claude-tools
```

Restart Claude Code. On the next session start the plugin writes its versioned
config into the machine's global config, so there is nothing to copy by hand.

## What it syncs

| Repo file | Lands at | How |
| --- | --- | --- |
| `plugins/tools/commands/` | slash commands | loaded by the plugin directly |
| `plugins/tools/skills/` | skills | loaded by the plugin directly |
| `plugins/tools/agents/` | subagents | loaded by the plugin directly |
| `plugins/tools/config/claude-rules.md` | `~/.claude/CLAUDE.md` | full overwrite |
| `plugins/tools/config/managed-settings.json` | `~/.claude/settings.json` | `permissions.deny` merged in |

`~/.claude/CLAUDE.md` is fully owned by this repo. Anything written to it
directly on a machine — including memory saved with `#` — is replaced the next
time the rules change upstream. Edit `config/claude-rules.md` instead.

`settings.json` is only ever added to. `theme`, `model`, `effortLevel`, and
`enabledPlugins` stay local to each machine and are never touched. If the file
is not valid JSON the sync backs off rather than overwriting it.

## What it deliberately does not sync

`~/.claude.json` holds `machineID`, `userID`, `oauthAccount`, per-project
history, and user-scope MCP servers with their auth headers. It is
machine-specific and contains secrets, so it stays out of the repo. Re-add MCP
servers per machine with `claude mcp add`.

## Shipping a change

```bash
# 1. edit whatever changed
# 2. bump "version" in plugins/tools/.claude-plugin/plugin.json
git add -A && git commit -m "feat: ..." && git push
claude plugin tag --push
```

Then on the other laptop:

```bash
claude plugin update tools
```

Restart Claude Code. The version bump is required — `claude plugin tag`
refuses to tag a version that already exists.

## Layout

```
.claude-plugin/marketplace.json     marketplace manifest (this repo)
plugins/tools/
  .claude-plugin/plugin.json        plugin manifest, holds the version
  commands/                         slash commands
  skills/                           skills
  agents/                           subagents
  hooks/hooks.json                  registers the SessionStart hook
  hooks/sync-config.mjs             applies config/ to the global config
  config/claude-rules.md            global rules
  config/managed-settings.json      deny rules merged into settings.json
```
