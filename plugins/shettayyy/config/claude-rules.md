# Global Claude Code Instructions

## Package Manager & System Package Safety

Never upgrade or modify system-level package managers or runtimes (pnpm, npm, yarn, pip, python, node) without explicit user approval. This includes:

- Version bumps in `package.json`, `pyproject.toml`, or similar manifest files
- Reinstalling or switching package managers
- Running `corepack enable/use`, `npm install -g`, `pip install --upgrade`, or equivalent commands targeting global/system tools

Always ask before touching these. A broken system package manager can break all projects at once.

## Memory Storage Rules

- **Project memories** belong in `.claude/memory/` inside the project repo, committed to git and shared with team members.
- **Global rules and preferences** belong in `~/.claude/CLAUDE.md`.
- **Plans** belong in `.claude/plans/` inside the project repo. Never write plan files to `~/.claude/plans/` or anywhere under `~/.claude/`.
- Never use `~/.claude/projects/` for user-managed memories. That is Claude Code's internal session storage, not a shareable location.
- Never create, modify, or delete anything under `~/.claude/` without the user explicitly asking for it.

## Git & Commit Rules

- Never add co-author trailers or any messages indicating Claude was involved in commits. All commits should reflect only the user's authorship in git history.
- Do not include `Co-authored-by`, `Co-committed-by`, or similar trailers in commit messages on the user's behalf.
- The user's git history should never reveal that Claude was involved in any commits.

## Communication

- Keep replies extremely concise. Focus on the key information. No unnecessary fluff, no long code snippets.
- No em dashes in any written content. Use normal sentences with proper punctuation instead.
- No unnecessary jargon. Write plainly and clearly.
- Never cite external libraries, tools, or APIs as evidence without verifying their actual source or documentation first. Check before claiming.

## Ambiguity and Assumptions

Before implementing anything non-trivial:

- State assumptions explicitly. If uncertain, ask before writing code.
- If multiple valid interpretations exist, present them and ask which to pursue. Never pick silently.
- If something is genuinely unclear, stop, name what is confusing, and ask. Do not guess and proceed.

## Reporting and Claims

When reporting results on any non-trivial task, tag assertions so their basis is clear:

- `[executed]`: verified by actually running the code or command
- `[inspected]`: based on reading the source, not running it
- `[assumed]`: inferred, not directly verified

Surface uncertainty proportional to the blast radius of the change. Silent overconfidence on irreversible changes is a critical defect.

## Project Workspace

- All project work must be created under `~/localshiva/` — this is the designated project space.
- Never create project files or directories under `~/.claude/`, `/home/claude/`, or any other location without explicit permission.
- If a project location is not specified, ask before creating anything. Do not assume a path.
