<!--
  The PR title becomes the squash commit message.
  Write it as a Conventional Commit, for example `fix(hooks): use a unique temp file`.
  Keep one logical change per PR.
-->

## What changed

<!-- One or two sentences on what this PR does. -->

## Why

<!-- The problem it solves or the reason for the change. Link an issue if there is one. -->

## How it was tested

<!-- Commands you ran and what you checked by hand, for example running the hook in a sandbox. -->

## Checklist

- [ ] PR title is a Conventional Commit (`feat:`, `fix:`, `refactor:`, `docs:`, `ci:`, `chore:`)
- [ ] `pnpm run check && pnpm run test && pnpm run validate` pass locally
- [ ] If anything under `plugins/shettayyy/` changed, `version` in `plugin.json` is bumped
- [ ] README and CLAUDE.md still match the change
- [ ] If `config/claude-rules.md` changed, it stays under about 100 lines and follows its own writing rules
