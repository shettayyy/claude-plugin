---
description: Run /code-review on a PR, then walk the findings one at a time as a table you drive.
argument-hint: '[level] [PR number | branch | path]'
disable-model-invocation: true
---

Review a pull request, then walk its findings one at a time.

Arguments: `$ARGUMENTS`

Read the first word as the effort level when it is one of `low`, `medium`, `high`, `xhigh`, `max`. Everything after it is the target (a PR number, a branch, or a path). Either part may be missing.

## Step 1: run the review

Invoke the `code-review` skill with those arguments verbatim, for example `high 2318`. Do not review the code yourself instead.

- Never pass `--comment` or `--fix`. This command never writes to GitHub.
- Never pass `ultra`. It cannot be launched from inside a command; if the user asked for it, say so in one line and run the highest local level instead.

## Step 2: print the table, then stop

The review ends by reporting its findings. Do not restate them there. Print one markdown table and nothing else, sorted by severity from high to low:

| #   | Issue | What it is | Severity |
| --- | ----- | ---------- | -------- |

- **Issue**: a title of eight words or fewer.
- **What it is**: at most two lines. No file paths, no code, no fix.
- **Severity**: `Critical`, `High`, `Medium`, or `Low`. The review does not emit a severity, so assign one from blast radius: breaks users, loses data, or opens a security hole is Critical or High; a real bug on an edge path is Medium; cleanup, naming, or duplication is Low. At equal impact, a `CONFIRMED` finding outranks a `PLAUSIBLE` one.

Close with a single line: `Say next to go through them one at a time.`

No summary, no preamble, no details, no "let me know if". If the review found nothing, say that in one line and stop.

## Step 3: one issue per turn

On `next`, take the next row in table order. Only that row. Keep the whole thing under roughly 200 words.

Write it in plain language. No jargon. If a technical term is unavoidable, explain it in half a sentence. Use this shape and drop any section that does not apply:

**N. Title** (Severity)

- **Where**: `path/to/file.ts:120`, as a clickable link. If the finding is about the pull request conversation rather than the code, link the GitHub thread instead.
- **What happens**: two or three sentences on the actual effect, not the mechanism.
- **Steps to reproduce**: numbered, bugs only, with real inputs rather than placeholders. If it cannot be reproduced from the code alone, say exactly that instead of inventing steps.
- **Fix**: the smallest change that solves it. Use a code block only when it is shorter than the words would be, and keep it under ten lines.
- **Comment to post**: a fenced plain-text block, one to three sentences, addressed to the author, ready to paste as an inline comment on that line. No emojis, no praise sandwich, no mention of AI or of this review.

Never roll into the following issue on your own. No need to ask whether you need to move to the next issue. Wait for users instructions. They can discuss the current issue or say next to move to the next one.

## Rules for the whole run

- Read a file only when the issue under discussion needs it. Do not pre-read for the table.
- Never post, comment, commit, or edit. The user posts the comment themselves.
- A question about the current issue gets a direct answer and nothing more. Stay on that issue.
- `back` goes to the previous row. A bare number jumps to that row. `skip` behaves like `next`.
- After the last row, say so in one line and stop.
