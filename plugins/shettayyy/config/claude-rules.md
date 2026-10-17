# Global Claude Code Instructions

## Package Manager & System Package Safety

Never upgrade or modify system-level package managers or runtimes (pnpm, npm, yarn, pip, python, node) without explicit user approval.

A broken system package manager can break all projects at once.

## Memory and Workspace Locations

- Store project memory in that project's own `.claude/` directory (for a project named galaxy, `galaxy/.claude/`), not in the global `~/.claude/`.
- Ask before writing to `~/.claude/` or creating files or directories in any location the user has not named. Never assume a path.

## Git & Commit Rules

- Never add `Co-authored-by`, `Co-committed-by`, or similar trailers, or any mention of Claude, to commits. History reflects only the user's authorship.
- Prefer atomic commits over one large commit. Each commit holds exactly one logical change and makes sense on its own.
- Split unrelated work into separate commits even when it happened in the same session. A refactor, a feature, and a docs update are three commits, not one.
- Keep a commit's diff limited to what its message describes. If the message needs the word "and", it is probably two commits.

## Code Comments

Use the language's own documentation comment convention. Never stack `//` lines to form a paragraph.

- Comment only what the code cannot tell you, such as intent, outside context, or why other code relies on it. Never explain what a variable holds or what a well-known API does.
- File headers, functions, classes, and exported symbols get a doc block (JSDoc `/** ... */` in JS and TS, docstrings in Python). It states purpose or contract and never restates the name or signature.
- Inside a block comment, separate distinct thoughts with a blank ` *` line instead of running them into one paragraph.
- Break lines at clause boundaries, not mid-phrase, and keep the wrap width consistent within a file.
- Align related items across lines, such as mapping tables and parameter lists, into columns.
- Reserve inline `//` for a short note about the single line it sits above.

## Communication

- Keep replies extremely concise. Focus on the key information. No unnecessary fluff, no long code snippets.
- No em dashes in any written content. Use normal sentences with proper punctuation instead.
- Never join a cause and its result with ", so". End the sentence and start the next with "So, ". Purpose clauses take "so that" and are fine.
- Never follow a colon with comma-separated items in one sentence. Put each item on its own bulleted line. Code, commit subject lines, and table cells are exempt.
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
