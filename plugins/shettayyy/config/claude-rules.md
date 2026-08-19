# Global Claude Code Instructions

## Package Manager & System Package Safety

Never upgrade or modify system-level package managers or runtimes (pnpm, npm, yarn, pip, python, node) without explicit user approval.

A broken system package manager can break all projects at once.

## Memory Storage Rules

- Try to update the local claude project memories i.e if the project name is galaxy, update galaxy/.claude/<whatever needs to be updates as per claude conventions> instead of polluting the global claude workspace i.e ~/.claude.
- If global ~/.claude config needs to be updated, ask for user's permission before doing so.

## Git & Commit Rules

- Never add co-author trailers or any messages indicating Claude was involved in commits. All commits should reflect only the user's authorship in git history.
- Do not include `Co-authored-by`, `Co-committed-by`, or similar trailers in commit messages on the user's behalf.
- Prefer atomic commits over one large commit. Each commit holds exactly one logical change and makes sense on its own.
- Split unrelated work into separate commits even when it happened in the same session. A refactor, a feature, and a docs update are three commits, not one.
- Keep a commit's diff limited to what its message describes. If the message needs the word "and", it is probably two commits.

## Code Comments

Use the language's own documentation comment convention. Never stack `//` lines to form a paragraph.

- File headers, functions, classes, and exported symbols get a block comment in the language's doc format: JSDoc (`/** ... */`) for JavaScript and TypeScript, docstrings for Python, `///` for Rust, godoc for Go.
- Inside a block comment, separate distinct thoughts with a blank ` *` line instead of running them into one paragraph.
- Break lines at clause boundaries, not mid-phrase, and keep the wrap width consistent within a file.
- Align related items across lines, such as mapping tables and parameter lists, so they read as columns.
- Reserve inline `//` for a short note about the single line it sits above.

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

- Never create project files or directories under `~/.claude/`, `/home/claude/`, or any other location without explicit permission.
- If a project location is not specified, ask before creating anything. Do not assume a path.
