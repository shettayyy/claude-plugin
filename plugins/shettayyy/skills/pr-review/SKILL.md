---
description: Run /code-review on a PR, then walk the findings one at a time as a table you drive.
argument-hint: '[level] [PR number | branch | path]'
disable-model-invocation: true
---

Review a pull request, then walk its findings one at a time.

Arguments: `$ARGUMENTS`

Read the first word as the effort level when it is one of `low`, `medium`, `high`, `xhigh`, `max`. Everything after it is the target (a PR number, a branch, or a path). Either part may be missing.

## Step 1: run the review

Invoke the `code-review` skill with those arguments, for example `high 2318`. Do not review the code yourself instead.

- Never pass `--comment` or `--fix`, even when the user typed them. This skill never writes to GitHub.
- Never pass `ultra`. It cannot be launched from inside a skill. If the user asked for it, say so in one line and run the highest local level instead.

## Step 2: print the table, then stop

The review ends by reporting its findings. Do not restate them there. Print one markdown table and nothing else, sorted by severity from high to low:

| #   | Issue | What it is | Severity |
| --- | ----- | ---------- | -------- |

- **Issue**: a title of eight words or fewer.
- **What it is**: at most two lines. No file paths, no code, no fix.
- **Severity**: the review does not emit one. Assign it from blast radius.
  - **Critical or High** when it breaks users, loses data, or opens a security hole.
  - **Medium** for a real bug on an edge path.
  - **Low** for cleanup, naming, or duplication.
  - At equal impact, a `CONFIRMED` finding outranks a `PLAUSIBLE` one.

Close with a single line: `Say next to go through them one at a time.`

No summary, no preamble, no details, no "let me know if". If the review found nothing, say that in one line and stop.

## Step 3: one issue per turn

On `next`, take the next row in table order. Only that row. Keep the prose under roughly 300 words. Code blocks do not count toward that.

Write it in plain language. No jargon outside the "in the code" parts. If a technical term is unavoidable elsewhere, explain it in half a sentence. Use this shape and drop any section that does not apply:

**N. Title** (Severity)

- **Where**: `path/to/file.ts:120`, as a clickable link to the code under review. If the finding is about the pull request conversation rather than the code, link the GitHub thread instead.
- **What happens**: split into these parts.
  - **Today, in plain terms**: one or two sentences someone non-technical could follow, describing what goes wrong for the user or the system.
  - **Today, in the code**: how that maps to the code path, naming the functions, values, or conditions involved.
  - **Evidence**: quote the exact lines that prove it, each as a short code block headed by its clickable `path/to/file.ts:120` link. Copy them from the code under review, never from memory, paraphrase, or your current checkout. If a claim cannot be backed by a quote, say it is unverified.
  - **Expected, in plain terms**: one or two sentences someone non-technical could follow, describing what should happen instead.
  - **Expected, in the code**: how the code path should behave to get there.
- **Steps to reproduce**: numbered, bugs only, with real inputs rather than placeholders. If it cannot be reproduced from the code alone, say exactly that instead of inventing steps.
- **Fix**: one or two sentences on what to change and why it solves the problem. Then show the smallest change as a `diff` code block, GitHub style, with `-` for removed lines and `+` for added lines. Put the file and line above the block in brackets, for example `[path/to/file.ts:120]`. Keep a few unchanged lines around the change for context, and use one block per file when the fix touches more than one.
- **Comment for you to post**: a fenced plain-text block of one to three sentences, addressed to the PR author. The user copies it and posts it on the PR themselves. Start it with the file and line in brackets, for example `[path/to/file.ts:120]`, so that the user knows where to paste it. Write it the way you would say it to a teammate.
  - Short sentences and everyday words.
  - One point per sentence.
  - Say what breaks and what to change.
  - No jargon or long technical chains. A comment that is hard to follow gets misread or ignored.
  - No emojis, no praise sandwich, no mention of AI or of this review.

Never move on to the next issue by yourself, and do not ask whether to. Wait for the user. They can discuss the current issue or say `next`.

## Rules for the whole run

- Quote and link only the code under review, never your current checkout. For a PR, get its head commit with `gh pr view <N> --json headRefName,headRefOid,url` and read from that commit through GitHub. Use `gh pr diff <N>` for the changes and `gh api "repos/{owner}/{repo}/contents/<path>?ref=<sha>" -H "Accept: application/vnd.github.raw+json"` for a whole file. For a branch target, read from that branch the same way.
- If GitHub cannot be reached, switch to the PR branch locally with `gh pr checkout <N>` or `git switch <branch>`. Do this only when the working tree is clean. Otherwise stop and ask. Say which branch you switched to.
- Read a file only when the issue under discussion needs it. Do not pre-read for the table.
- Never post, comment, commit, or edit. The user posts the comment themselves. Switching branches under the rule above is the only change allowed.
- A question about the current issue gets a direct answer and nothing more. Stay on that issue.
- `back` goes to the previous row. A bare number jumps to that row. `skip` behaves like `next`.
- After the last row, say so in one line and stop.
