#!/usr/bin/env node
/**
 * Behavioural tests for the version-bump CI check.
 *
 * Each test builds a throwaway git repo with a base commit,
 * applies a change, commits it, and runs the real script against
 * the range. That keeps git's own diff and rename handling in scope
 * instead of faking the file list.
 *
 * Run with `pnpm run test`.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = join(repoRoot, 'scripts', 'check-version-bump.mjs');

const MANIFEST = 'plugins/shettayyy/.claude-plugin/plugin.json';
const SKILL = 'plugins/shettayyy/skills/demo/SKILL.md';

/** Repos created across the run, removed once the suite finishes. */
const tempRoots = [];

/** @type {string} */
let repo;

/**
 * Runs git inside the test repo with signing turned off, so a
 * signing setup on the machine never blocks the test commits.
 *
 * @param {string[]} args Arguments passed to git.
 * @returns {string} Trimmed stdout.
 */
function git(args) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: repo,
    encoding: 'utf8',
  }).trim();
}

/**
 * Writes a file inside the test repo, creating parent directories.
 *
 * @param {string} path Repo-relative path.
 * @param {string} contents File contents.
 * @returns {void}
 */
function write(path, contents) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), contents, 'utf8');
}

/**
 * Sets the plugin manifest and package.json versions.
 *
 * @param {string} plugin Version for plugin.json.
 * @param {string} [pkg] Version for package.json, same as plugin by default.
 * @returns {void}
 */
function setVersions(plugin, pkg = plugin) {
  write(MANIFEST, `${JSON.stringify({ name: 'shettayyy', version: plugin })}\n`);
  write('package.json', `${JSON.stringify({ name: 'repo', version: pkg })}\n`);
}

/**
 * Stages everything and commits it.
 *
 * @returns {string} The new commit SHA.
 */
function commit() {
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'change']);
  return git(['rev-parse', 'HEAD']);
}

/**
 * Runs the check against a base revision and the current HEAD.
 *
 * @param {string} base Base revision.
 * @returns {{status: number, output: string}} Exit code and combined output.
 */
function check(base) {
  try {
    const stdout = execFileSync('node', [SCRIPT, base, 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    return { status: error.status ?? 1, output: `${error.stdout}${error.stderr}` };
  }
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'version-bump-test-'));
  tempRoots.push(repo);
  git(['init', '-q']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'user.email', 'test@example.com']);
});

after(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

describe('version bump', () => {
  it('passes when plugin content changes with a higher version', () => {
    setVersions('1.0.0');
    write(SKILL, 'old\n');
    const base = commit();

    write(SKILL, 'new\n');
    setVersions('1.0.1');
    commit();

    assert.equal(check(base).status, 0);
  });

  it('fails when plugin content changes without a bump', () => {
    setVersions('1.0.0');
    write(SKILL, 'old\n');
    const base = commit();

    write(SKILL, 'new\n');
    commit();

    const { status, output } = check(base);
    assert.equal(status, 1);
    assert.match(output, /still 1\.0\.0/);
  });

  it('passes when nothing under the plugin changes', () => {
    setVersions('1.0.0');
    const base = commit();

    write('README.md', 'docs\n');
    commit();

    assert.equal(check(base).status, 0);
  });

  it('fails when a file is moved out of the plugin without a bump', () => {
    setVersions('1.0.0');
    write(SKILL, 'same\n');
    const base = commit();

    mkdirSync(join(repo, 'docs'), { recursive: true });
    git(['mv', SKILL, 'docs/SKILL.md']);
    commit();

    assert.equal(check(base).status, 1);
  });

  it('fails when the version goes down', () => {
    setVersions('1.0.0');
    write(SKILL, 'old\n');
    const base = commit();

    write(SKILL, 'new\n');
    setVersions('0.9.0');
    commit();

    const { status, output } = check(base);
    assert.equal(status, 1);
    assert.match(output, /must be higher/);
  });

  it('fails when the manifest is not valid JSON', () => {
    setVersions('1.0.0');
    write(SKILL, 'old\n');
    const base = commit();

    write(SKILL, 'new\n');
    write(MANIFEST, '{ not json');
    commit();

    assert.equal(check(base).status, 1);
  });

  it('compares numbers, not strings', () => {
    setVersions('1.9.0');
    write(SKILL, 'old\n');
    const base = commit();

    write(SKILL, 'new\n');
    setVersions('1.10.0');
    commit();

    assert.equal(check(base).status, 0);
  });
});

describe('version sync', () => {
  it('fails when package.json differs from plugin.json', () => {
    setVersions('1.0.0');
    const base = commit();

    setVersions('1.0.1', '1.0.0');
    commit();

    const { status, output } = check(base);
    assert.equal(status, 1);
    assert.match(output, /package\.json has version "1\.0\.0"/);
  });

  it('fails even when no plugin content changed', () => {
    setVersions('1.0.0', '0.0.0');
    const base = commit();

    write('README.md', 'docs\n');
    commit();

    assert.equal(check(base).status, 1);
  });
});

describe('base revision', () => {
  it('skips when there is no base, as on a new branch', () => {
    setVersions('1.0.0');
    commit();

    assert.equal(check('0000000000000000000000000000000000000000').status, 0);
  });

  it('fails when the base commit is not available', () => {
    setVersions('1.0.0');
    commit();

    const { status, output } = check('1111111111111111111111111111111111111111');
    assert.equal(status, 1);
    assert.match(output, /not available locally/);
  });
});
