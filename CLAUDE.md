# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A single-plugin Claude Code marketplace that distributes Rahul Shetty's personal config (rules, skills, deny permissions) across machines. On session start, the `shettayyy` plugin's hook syncs versioned files from `plugins/shettayyy/config/` into the machine's `~/.claude/`. There is no compiled application. The only toolchain is Biome, which lints and formats the hook script and the JSON manifests.

## Structure

- `.claude-plugin/marketplace.json` — marketplace manifest
- `plugins/shettayyy/.claude-plugin/plugin.json` — plugin manifest (holds the version)
- `plugins/shettayyy/config/` — the payload that gets synced: `claude-rules.md` → `~/.claude/CLAUDE.md`, and `managed-settings.json` deny rules plus `extraKnownMarketplaces` entries → `~/.claude/settings.json`
- `plugins/shettayyy/hooks/` — `hooks.json` (SessionStart trigger) and `sync-config.mjs` (the sync logic; ES modules)
- `plugins/shettayyy/skills/` — plugin skills, invoked as `/shettayyy:<name>` (e.g. `commit-msg`, `pr-review`)

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
pnpm run validate
```

This runs `claude plugin validate --strict` with the Claude Code version pinned in `devDependencies`, the same one CI uses. `pnpm-workspace.yaml` allows its install script, which pnpm blocks by default.

## Conventions

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`).
- `main` only accepts squash-merged PRs, and the PR title becomes the commit message. Open one PR per logical change and give it a Conventional Commit title.
- Never add co-author or "Claude" trailers to commits.
- When bumping the plugin, set `version` in `plugins/shettayyy/.claude-plugin/plugin.json` and `package.json` to the same value. CI fails when they differ.
- Never tag releases by hand. After a version bump merges into `main`, the `release` job in `validate.yml` creates the `shettayyy--v<version>` tag on that commit.

## Editing claude-rules.md

Every line loads into every session in every project. Keep it lean.

- Keep it under about 100 lines. Past that, adding a rule means removing one.
- Aim for net-zero edits. Fold a new rule into an existing line, or trim a duplicate in the same change.
- Drop rules Claude already follows by default.
- Rules that can be checked mechanically belong in a hook, not here. For example, a PreToolUse hook on `git commit` could block co-author trailers.
- Rules for a single task belong in that skill (e.g. `skills/pr-review/SKILL.md`), not here.
- Check each new rule against existing ones for conflicts. An ignored rule is usually vague or contradicted, not drowned out by length.
- The file must follow its own writing rules.

## sync-config.mjs gotchas

- **Mostly additive merge**: it adds missing deny rules and shallow-merges declared `extraKnownMarketplaces` entries. The one removal is deny rules listed in `obsoleteDeny` in `managed-settings.json`. Those are removed from every machine, even if a user added the same rule by hand. It never touches marketplaces it does not declare, or `theme`, `model`, `effortLevel`, and `enabledPlugins`.
- **Next-session timing**: changes to synced rules take effect on the *next* session, not the current one.
- **Atomic writes**: writes to a temp file then renames, to survive interruption.
- **Malformed `~/.claude/settings.json` is skipped silently** so local machine prefs are never destroyed.
- Respects `CLAUDE_PLUGIN_ROOT` and `CLAUDE_CONFIG_DIR` env overrides (used for testing).
