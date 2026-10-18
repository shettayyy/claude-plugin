#!/usr/bin/env node
/**
 * Fails when a commit range changes synced plugin content without
 * bumping the plugin version, or when the versions fall out of sync.
 *
 * Everything under the watched paths reaches other machines only
 * when `version` in the plugin manifest changes, because
 * `claude plugin update` compares versions. An edit without a bump
 * is silent: CI stays green and the change never propagates.
 *
 * `package.json` carries the same version as the plugin manifest.
 * The manifest is the source of truth, and this script fails when
 * the two differ at the head revision.
 *
 * Usage: node scripts/check-version-bump.mjs <baseRef> [headRef]
 *
 * Exits 0 when the range is fine or when there is no base revision
 * at all. Exits 1 on a missing, invalid, or lower version, on
 * out-of-sync versions, or when the base revision is not available.
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
const PACKAGE_PATH = 'package.json';
const EMPTY_SHA = '0000000000000000000000000000000000000000';

/**
 * Runs a git command and returns its trimmed stdout.
 *
 * @param {string[]} args Arguments passed to git.
 * @returns {string | null} Stdout, or null if git exited non-zero.
 */
function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Reads the `version` field of a JSON file at a given revision.
 *
 * @param {string} ref Revision to read the file from.
 * @param {string} path Repo-relative path of the JSON file.
 * @returns {string | null} The version, or null if unreadable.
 */
function versionAt(ref, path) {
  const raw = git(['show', `${ref}:${path}`]);
  if (raw === null) return null;

  try {
    return JSON.parse(raw).version ?? null;
  } catch {
    return null;
  }
}

/**
 * Parses a plain `major.minor.patch` version.
 *
 * @param {string | null} version Version string to parse.
 * @returns {number[] | null} The three numbers, or null if malformed.
 */
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  return match ? match.slice(1).map(Number) : null;
}

/**
 * Compares two parsed versions part by part.
 *
 * @param {number[]} a First version.
 * @param {number[]} b Second version.
 * @returns {boolean} True when `a` is strictly higher than `b`.
 */
function isHigher(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/**
 * Prints an error block and exits with status 1.
 *
 * @param {string[]} lines Lines of the message.
 * @returns {never}
 */
function fail(lines) {
  console.error(['', ...lines, ''].join('\n'));
  process.exit(1);
}

const base = process.argv[2];
const head = process.argv[3] ?? 'HEAD';

if (!base || base === EMPTY_SHA) {
  console.log('[version-bump] no base revision to compare against, skipping.');
  process.exit(0);
}

if (git(['cat-file', '-e', `${base}^{commit}`]) === null) {
  fail([
    `[version-bump] base ${base} is not available locally.`,
    'Fetch the full history (fetch-depth: 0) so the range can be checked.',
  ]);
}

const after = versionAt(head, MANIFEST_PATH);
const packageVersion = versionAt(head, PACKAGE_PATH);

if (parseVersion(after) === null) {
  fail([
    `[version-bump] "version" in ${MANIFEST_PATH} is missing or not major.minor.patch.`,
    `Found: ${JSON.stringify(after)}`,
  ]);
}

if (packageVersion !== after) {
  fail([
    `[version-bump] ${PACKAGE_PATH} has version ${JSON.stringify(packageVersion)},`,
    `but ${MANIFEST_PATH} has ${after}. Set both to the same version.`,
  ]);
}

/**
 * Renames are listed as a delete plus an add, so moving a file out
 * of the plugin directory still counts as changing synced content.
 */
const changedFiles = (git(['diff', '--name-only', '--no-renames', base, head]) ?? '')
  .split('\n')
  .filter(Boolean);

const touched = changedFiles.filter(
  (file) => file.startsWith(WATCHED_PREFIX) && file !== MANIFEST_PATH,
);

if (touched.length === 0) {
  console.log('[version-bump] no synced content changed, nothing to enforce.');
  process.exit(0);
}

const before = versionAt(base, MANIFEST_PATH);
const parsedBefore = parseVersion(before);

if (before === null) {
  console.log('[version-bump] no manifest at base, treating as a new plugin.');
  process.exit(0);
}

if (parsedBefore === null || isHigher(parseVersion(after), parsedBefore)) {
  console.log(`[version-bump] version bumped ${before} -> ${after}. OK.`);
  process.exit(0);
}

if (before !== after) {
  fail([
    `[version-bump] version went from ${before} to ${after}.`,
    'The new version must be higher than the old one.',
  ]);
}

fail([
  '[version-bump] These files change what gets synced to other machines:',
  ...touched.map((file) => `  - ${file}`),
  '',
  `but "version" in ${MANIFEST_PATH} is still ${before}.`,
  '',
  'Without a bump, `claude plugin update` sees no change and the edit',
  `never reaches any other machine. Bump it in ${MANIFEST_PATH}`,
  `and ${PACKAGE_PATH}.`,
]);
