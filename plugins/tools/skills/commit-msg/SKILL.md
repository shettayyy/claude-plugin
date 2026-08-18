---
name: commit-msg
description: Generate a single commit message for the uncommitted changes in this repo. Follows the project's commitlint config when one exists, otherwise Conventional Commits.
---

Look at the uncommitted changes in this repo and generate a single commit message.

Steps:
1. Run `git diff HEAD` to see all uncommitted changes (staged and unstaged).
2. Check the project root for a commitlint config file (`commitlint.config.js`, `commitlint.config.ts`, `commitlint.config.mjs`, `commitlint.config.cjs`, or a `commitlint` key in `package.json`). If found, read and follow its rules.
3. If no commitlint config is found, follow the Conventional Commits spec: `<type>(<optional scope>): <short description>`.
4. Output the commit message inside a fenced code block (no language tag) — no explanation, no alternatives, no extra text outside the code block.
