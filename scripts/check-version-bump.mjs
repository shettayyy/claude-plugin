#!/usr/bin/env node
/**
 * Fails when a commit range changes synced plugin content without
 * bumping the plugin version.
 *
 * Everything under the watched paths reaches other machines only
 * when `version` in the plugin manifest changes, because
 * `claude plugin update` compares versions. An edit without a bump
 * is silent: CI stays green and the change never propagates.
 *
 * Usage: node scripts/check-version-bump.mjs <baseRef> [headRef]
 *
 * Exits 0 when the range is fine or when there is nothing to
 * compare against. Exits 1 only on a genuine missing bump.
 */

import { execFileSync } from 'node:child_process';

/**
 * Everything shipped inside the plugin reaches other machines, so the
 * whole directory is watched rather than a hand-listed subset. An
 * earlier list named only config/, skills/, and agents/, which let a
 * hooks/ change ship without a bump and silently never propagate.
 */
const WATCHED_PREFIX = 'plugins/shettayyy/';

const MANIFEST_PATH = 'plugins/shettayyy/.claude-plugin/plugin.json';
const EMPTY_SHA = '0000000000000000000000000000000000000000';

/**
 * Runs a git command and returns its trimmed stdout.
 *
 * @param {string[]} args Arguments passed to git.
 * @returns {string | null} Stdout, or null if git exited non-zero.
 */
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Reads the manifest version at a given revision.
 *
 * @param {string} ref Revision to read the manifest from.
 * @returns {string | null} The version, or null if unreadable.
 */
function versionAt(ref) {
  const raw = git(['show', `${ref}:${MANIFEST_PATH}`]);
  if (raw === null) return null;

  try {
    return JSON.parse(raw).version ?? null;
  } catch {
    return null;
  }
}

const base = process.argv[2];
const head = process.argv[3] ?? 'HEAD';

if (!base || base === EMPTY_SHA) {
  console.log('[version-bump] no base revision to compare against, skipping.');
  process.exit(0);
}

if (git(['cat-file', '-e', `${base}^{commit}`]) === null) {
  console.log(`[version-bump] base ${base} is not present locally, skipping.`);
  process.exit(0);
}

const changedFiles = (git(['diff', '--name-only', `${base}`, `${head}`]) ?? '')
  .split('\n')
  .filter(Boolean);

const touched = changedFiles.filter(
  (file) => file.startsWith(WATCHED_PREFIX) && file !== MANIFEST_PATH,
);

if (touched.length === 0) {
  console.log('[version-bump] no synced content changed, nothing to enforce.');
  process.exit(0);
}

const before = versionAt(base);
const after = versionAt(head);

if (before === null) {
  console.log('[version-bump] no manifest at base, treating as a new plugin.');
  process.exit(0);
}

if (before !== after) {
  console.log(`[version-bump] version bumped ${before} -> ${after}. OK.`);
  process.exit(0);
}

console.error(
  [
    '',
    `[version-bump] These files change what gets synced to other machines:`,
    ...touched.map((file) => `  - ${file}`),
    '',
    `but "version" in ${MANIFEST_PATH} is still ${before}.`,
    '',
    'Without a bump, `claude plugin update` sees no change and the edit',
    'never reaches any other machine. Bump the version and amend.',
    '',
  ].join('\n'),
);
process.exit(1);
