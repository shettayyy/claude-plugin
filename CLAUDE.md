# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A single-plugin Claude Code marketplace that distributes Rahul Shetty's personal config (rules, skills, deny permissions) across machines. On session start, the `shettayyy` plugin's hook syncs versioned files from `plugins/shettayyy/config/` into the machine's `~/.claude/`. There is no compiled application. The only toolchain is Biome, which lints and formats the hook script and the JSON manifests.

## Structure

- `.claude-plugin/marketplace.json` — marketplace manifest
- `plugins/shettayyy/.claude-plugin/plugin.json` — plugin manifest (holds the version)
- `plugins/shettayyy/config/` — the payload that gets synced: `claude-rules.md` → `~/.claude/CLAUDE.md`, and `managed-settings.json` deny rules plus `extraKnownMarketplaces` entries → `~/.claude/settings.json`
- `plugins/shettayyy/hooks/` — `hooks.json` (SessionStart trigger) and `sync-config.mjs` (the sync logic; ES modules)
- `plugins/shettayyy/skills/` — plugin skills (e.g. `commit-msg`)

## Package manager

This project uses **pnpm**, pinned via `packageManager` in `package.json`. Never run `npm install` or `yarn` here. A `preinstall` guard (`only-allow`) fails the install if you do.

```bash
pnpm install
```

## Lint and format

Biome handles both. `pnpm run check` is what CI runs, so match it locally before pushing.

```bash
pnpm run check      # lint + format, read only
pnpm run check:fix  # lint + format, apply fixes
```

Formatting is configured in `biome.json` to match the existing style, 2-space indent and single quotes, rather than Biome's tab default.

## Validate

```bash
claude plugin validate ./plugins/shettayyy && claude plugin validate .
```

## Conventions

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`).
- Never add co-author or "Claude" trailers to commits.
- When bumping the plugin, edit the `version` in `plugins/shettayyy/.claude-plugin/plugin.json`.

## sync-config.mjs gotchas

- **Additive merge only**: it adds missing deny rules and shallow-merges declared `extraKnownMarketplaces` entries. It never removes existing settings, never touches marketplaces it does not declare, and never touches `theme`, `model`, `effortLevel`, or `enabledPlugins`.
- **Next-session timing**: changes to synced rules take effect on the *next* session, not the current one.
- **Atomic writes**: writes to a temp file then renames, to survive interruption.
- **Malformed `~/.claude/settings.json` is skipped silently** so local machine prefs are never destroyed.
- Respects `CLAUDE_PLUGIN_ROOT` and `CLAUDE_CONFIG_DIR` env overrides (used for testing).
