# claude-tools

My personal Claude Code setup, packaged as a plugin so every laptop runs the same skills, agents, and global rules.

## Install on a new machine

```bash
claude plugin marketplace add shettayyy/claude-tools
claude plugin install claude-tools@shettayyy
```

Restart Claude Code. On the next session start the plugin writes its versioned config into the machine's global config, so there is nothing to copy by hand.

## What it syncs

| Repo path | Lands at | How |
| --- | --- | --- |
| `plugins/claude-tools/skills/` | `/claude-tools:<name>` | loaded by the plugin |
| `plugins/claude-tools/agents/` | `@claude-tools:<name>` | loaded by the plugin |
| `plugins/claude-tools/config/claude-rules.md` | `~/.claude/CLAUDE.md` | full overwrite |
| `plugins/claude-tools/config/managed-settings.json` | `~/.claude/settings.json` | `permissions.deny` merged in |

`~/.claude/CLAUDE.md` is fully owned by this repo. Anything written to it directly on a machine, including memory saved with `#`, is replaced the next time the rules change upstream. Edit `config/claude-rules.md` instead.

`settings.json` is only ever added to. `theme`, `model`, `effortLevel`, and `enabledPlugins` stay local to each machine and are never touched. If the file is not valid JSON the sync backs off rather than overwriting it.

A plugin can ship a root `settings.json`, but only the `agent` and `subagentStatusLine` keys are read from it, so permission rules have to go through the hook.

## What it deliberately does not sync

`~/.claude.json` holds `machineID`, `userID`, `oauthAccount`, per-project history, and user-scope MCP servers with their auth headers. It is machine-specific and contains secrets, so it stays out of the repo. Re-add MCP servers per machine with `claude mcp add`.

## Shipping a change

Bump `version` in `plugins/claude-tools/.claude-plugin/plugin.json`, then:

```bash
git add -A && git commit -m "feat: ..." && git push
```

On the other laptop:

```bash
claude plugin marketplace update shettayyy
claude plugin update claude-tools@shettayyy
```

Restart Claude Code. The version bump is what drives updates: `claude plugin update` compares the installed version against the one in `plugin.json`.

Tagging is optional. `claude plugin tag ./plugins/claude-tools --push` creates a `claude-tools--v<version>` tag, but tags are only read for dependency version constraints, which this plugin has none of.

## Local development

```bash
claude --plugin-dir ./plugins/claude-tools
```

This loads the working copy without installing it, and takes precedence over the installed plugin of the same name for that session. Run `/reload-plugins` to pick up edits without restarting.

Validate before pushing:

```bash
claude plugin validate ./plugins/claude-tools && claude plugin validate .
```

## Layout

```
.claude-plugin/marketplace.json      marketplace manifest, name "shettayyy"
plugins/claude-tools/
  .claude-plugin/plugin.json         plugin manifest, holds the version
  skills/<name>/SKILL.md             skills and slash commands
  agents/                            subagents
  hooks/hooks.json                   registers the SessionStart hook
  hooks/sync-config.mjs              applies config/ to the global config
  config/claude-rules.md             global rules
  config/managed-settings.json       deny rules merged into settings.json
```

Component directories live at the plugin root, never inside `.claude-plugin/`, which only holds `plugin.json`. Both directories are auto-discovered, so the manifest declares no component paths.

## Known limitation

The sync hook runs on `SessionStart`. Whether a freshly written `CLAUDE.md` applies to that same session or only the next one depends on whether instructions are loaded before or after the hook fires. Treat rule changes as taking effect on the following session.
