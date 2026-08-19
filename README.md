# claude-plugin

My personal Claude Code setup, packaged as a plugin so every laptop runs the same skills, agents, and global rules.

## Install on a new machine

```bash
claude plugin marketplace add shettayyy/claude-plugin
claude plugin install shettayyy@claude-plugin
```

Restart Claude Code. On the next session start the plugin writes its versioned config into the machine's global config, so there is nothing to copy by hand.

## What it syncs

| Repo path | Lands at | How |
| --- | --- | --- |
| `plugins/shettayyy/skills/` | `/shettayyy:<name>` | loaded by the plugin |
| `plugins/shettayyy/agents/` | `@shettayyy:<name>` | loaded by the plugin |
| `plugins/shettayyy/config/claude-rules.md` | `~/.claude/CLAUDE.md` | full overwrite |
| `plugins/shettayyy/config/managed-settings.json` | `~/.claude/settings.json` | `permissions.deny` merged in |

`~/.claude/CLAUDE.md` is fully owned by this repo. Anything written to it directly on a machine, including memory saved with `#`, is replaced the next time the rules change upstream. Edit `config/claude-rules.md` instead.

`settings.json` is only ever added to. `theme`, `model`, `effortLevel`, and `enabledPlugins` stay local to each machine and are never touched. If the file is not valid JSON the sync backs off rather than overwriting it.

A plugin can ship a root `settings.json`, but only the `agent` and `subagentStatusLine` keys are read from it, so permission rules have to go through the hook.

## What it deliberately does not sync

`~/.claude.json` holds `machineID`, `userID`, `oauthAccount`, per-project history, and user-scope MCP servers with their auth headers. It is machine-specific and contains secrets, so it stays out of the repo. Re-add MCP servers per machine with `claude mcp add`.

## Shipping a change

Bump `version` in `plugins/shettayyy/.claude-plugin/plugin.json`, then:

```bash
git add -A && git commit -m "feat: ..." && git push
```

On the other laptop, either wait or pull it immediately.

Auto-update is enabled for this marketplace, and the sync hook turns it on for every machine, so a pushed version arrives on its own. It is not instant: Claude Code checks after a session starts with a random delay of up to ten minutes, the running session keeps the version it launched with, and the new version then needs `/reload-plugins` or the next launch. Expect it within a couple of sessions rather than immediately.

To pull it right now instead:

```bash
claude plugin marketplace update claude-plugin
claude plugin update shettayyy@claude-plugin
```

Either way, the version bump is what drives updates: both paths compare the installed version against the one in `plugin.json`. Push without bumping and nothing propagates, which is what the `version-bump` CI job exists to catch.

Tagging is optional. `claude plugin tag ./plugins/shettayyy --push` creates a `shettayyy--v<version>` tag, but tags are only read for dependency version constraints, which this plugin has none of.

## Development setup

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | >= 22 | matches the `engines` field and CI |
| pnpm | >= 11 | pinned by `packageManager` in `package.json` |
| Claude Code | any recent | provides the `claude` CLI used by `pnpm run validate` |

### Get started

```bash
git clone git@github.com:shettayyy/claude-plugin.git
cd claude-plugin
pnpm install
```

This project uses pnpm only. A `preinstall` guard fails the install if you reach for `npm` or `yarn`, so there is no way to end up with a stray `package-lock.json`.

### Scripts

| Script | Does |
| --- | --- |
| `pnpm run check` | Biome lint plus format, read only. This is what CI runs. |
| `pnpm run check:fix` | Same, applying every safe fix |
| `pnpm run lint` | Lint only |
| `pnpm run format` | Format only, writes in place |
| `pnpm run validate` | Runs `claude plugin validate` on the plugin and the marketplace |
| `pnpm run test` | Runs the sync-hook tests with `node --test`. CI runs this too. |

Formatting is pinned in `biome.json` to 2-space indent and single quotes, deliberately overriding Biome's tab default so the config files stay diff-stable.

### Run your changes without installing

```bash
claude --plugin-dir ./plugins/shettayyy
```

The working copy takes precedence over the installed plugin of the same name for that session, so you can test edits without uninstalling anything. Run `/reload-plugins` to pick up further edits without restarting.

### Test the sync hook in isolation

The hook writes to `~/.claude/` by default, which you do not want while developing. Both paths are overridable, so point it at a throwaway directory:

```bash
mkdir -p /tmp/fake-claude
CLAUDE_CONFIG_DIR=/tmp/fake-claude \
CLAUDE_PLUGIN_ROOT="$PWD/plugins/shettayyy" \
  node plugins/shettayyy/hooks/sync-config.mjs
```

It prints a line naming what it wrote, and prints nothing when everything already matches. Run it twice to confirm it is idempotent.

### Before you push

```bash
pnpm run check && pnpm run test && pnpm run validate
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and should be atomic: one logical change each, with a diff limited to what the message describes.

**If you changed anything under `plugins/shettayyy/config/`, `skills/`, or `agents/`, bump `version` in `plugins/shettayyy/.claude-plugin/plugin.json` in the same commit.** Without the bump nothing propagates, since both the manual and automatic update paths compare versions. The `version-bump` CI job enforces this and fails the build if you forget, so check it locally first:

```bash
pnpm run check:version
```

## Layout

```
.claude-plugin/marketplace.json      marketplace manifest, name "claude-plugin"
plugins/shettayyy/
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
