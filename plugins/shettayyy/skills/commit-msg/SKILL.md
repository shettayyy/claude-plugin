---
description: Generate commit messages for the uncommitted changes in this repo, one per logical change. Follows the project's commitlint config when one exists, otherwise Conventional Commits.
disable-model-invocation: true
---

Look at the uncommitted changes in this repo and generate a commit message for each logical change.

Steps:
1. Gather everything in a single command run from the repo root. `git diff --cached` covers a repo with no commits yet.
   ```bash
   cd "$(git rev-parse --show-toplevel)"; echo '--- status'; git status --porcelain; echo '--- log'; git log --oneline -20 2>/dev/null; echo '--- root'; ls -a; grep -l '"commitlint"' package.json 2>/dev/null; echo '--- diff'; git diff HEAD 2>/dev/null || git diff --cached
   ```
2. Read untracked files only when they are small text files. Describe lockfiles, binaries, and generated files from their names alone.
3. If the root listing shows a `.commitlintrc*` or `commitlint.config.*` file, or `package.json` has a `commitlint` key, read that config and follow its rules. Apply the rules of any preset it `extends` from what you already know. Do not read `node_modules`.
4. If there is no commitlint config, follow the Conventional Commits spec: `<type>(<optional scope>): <short description>`. Match the scopes and wording in the log output.
5. Group the changes by logical change. Unrelated work, such as a refactor next to a feature, goes in separate groups. Most diffs are a single group.
6. Output each commit message inside its own fenced code block (no language tag). When there is more than one group, list that group's files above its block. No explanation, no alternatives, no other text.
