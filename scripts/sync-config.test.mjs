#!/usr/bin/env node
/**
 * Behavioural tests for the SessionStart config sync hook.
 *
 * The hook rewrites the user's real global settings.json on every
 * machine, so a silent merge bug is destructive and hard to notice.
 * These tests run the actual script as a subprocess against a
 * throwaway config dir and a synthesized plugin root, which keeps
 * the file I/O, the atomic rename, and the exit code in scope
 * rather than re-implementing the merge in the assertions.
 *
 * Run with `pnpm run test`.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const HOOK = join(repoRoot, 'plugins', 'shettayyy', 'hooks', 'sync-config.mjs');

/** Roots created across the run, removed once the suite finishes. */
const tempRoots = [];

/**
 * Creates an isolated plugin root and config dir for one test.
 *
 * @returns {{pluginRoot: string, configDir: string}} Fresh paths.
 */
function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), 'sync-config-test-'));
  tempRoots.push(root);

  const pluginRoot = join(root, 'plugin');
  const configDir = join(root, 'config');
  mkdirSync(join(pluginRoot, 'config'), { recursive: true });
  mkdirSync(configDir, { recursive: true });

  return { pluginRoot, configDir };
}

/**
 * Runs the hook once against a sandbox.
 *
 * @param {{pluginRoot: string, configDir: string}} sandbox Paths to use.
 * @returns {{stdout: string, status: number}} Captured result.
 */
function runHook({ pluginRoot, configDir }) {
  let stdout = '';
  let status = 0;

  try {
    stdout = execFileSync('node', [HOOK], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_CONFIG_DIR: configDir,
      },
    });
  } catch (error) {
    stdout = error.stdout ?? '';
    status = error.status ?? 1;
  }

  return { stdout, status };
}

/**
 * Writes the plugin-side managed settings for a sandbox.
 *
 * @param {{pluginRoot: string}} sandbox Sandbox to write into.
 * @param {object | string} managed Object to serialize, or raw text.
 * @returns {void}
 */
function writeManaged({ pluginRoot }, managed) {
  const body = typeof managed === 'string' ? managed : JSON.stringify(managed, null, 2);
  writeFileSync(join(pluginRoot, 'config', 'managed-settings.json'), body, 'utf8');
}

/**
 * Writes the plugin-side rules file for a sandbox.
 *
 * @param {{pluginRoot: string}} sandbox Sandbox to write into.
 * @param {string} body Rules markdown.
 * @returns {void}
 */
function writeRules({ pluginRoot }, body) {
  writeFileSync(join(pluginRoot, 'config', 'claude-rules.md'), body, 'utf8');
}

/**
 * Writes the machine-side settings.json for a sandbox.
 *
 * @param {{configDir: string}} sandbox Sandbox to write into.
 * @param {object | string} settings Object to serialize, or raw text.
 * @returns {void}
 */
function writeSettings({ configDir }, settings) {
  const body = typeof settings === 'string' ? settings : JSON.stringify(settings, null, 2);
  writeFileSync(join(configDir, 'settings.json'), body, 'utf8');
}

/**
 * Reads and parses the machine-side settings.json.
 *
 * @param {{configDir: string}} sandbox Sandbox to read from.
 * @returns {object} Parsed settings.
 */
function readSettings({ configDir }) {
  return JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf8'));
}

/**
 * Reads the raw machine-side settings.json without parsing.
 *
 * @param {{configDir: string}} sandbox Sandbox to read from.
 * @returns {string} File contents.
 */
function readSettingsRaw({ configDir }) {
  return readFileSync(join(configDir, 'settings.json'), 'utf8');
}

after(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

describe('rules sync', () => {
  /** @type {{pluginRoot: string, configDir: string}} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  it('writes CLAUDE.md when the machine has none', () => {
    writeRules(sandbox, '# Rules\n');

    const { stdout, status } = runHook(sandbox);

    assert.equal(status, 0);
    assert.match(stdout, /CLAUDE\.md/);
    assert.equal(readFileSync(join(sandbox.configDir, 'CLAUDE.md'), 'utf8'), '# Rules\n');
  });

  it('overwrites local edits, since the repo owns the file', () => {
    writeRules(sandbox, '# Upstream\n');
    writeFileSync(join(sandbox.configDir, 'CLAUDE.md'), '# Hand-edited\n', 'utf8');

    runHook(sandbox);

    assert.equal(readFileSync(join(sandbox.configDir, 'CLAUDE.md'), 'utf8'), '# Upstream\n');
  });

  it('stays silent when the file already matches', () => {
    writeRules(sandbox, '# Rules\n');
    runHook(sandbox);

    const { stdout } = runHook(sandbox);

    assert.equal(stdout.trim(), '');
  });

  it('does nothing when the plugin ships no rules file', () => {
    const { status, stdout } = runHook(sandbox);

    assert.equal(status, 0);
    assert.equal(stdout.trim(), '');
  });
});

describe('deny rule merge', () => {
  /** @type {{pluginRoot: string, configDir: string}} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  it('creates settings.json with the required rules', () => {
    writeManaged(sandbox, { permissions: { deny: ['Read(**/.env)'] } });

    runHook(sandbox);

    assert.deepEqual(readSettings(sandbox).permissions.deny, ['Read(**/.env)']);
  });

  it('adds only the missing rules and keeps existing order', () => {
    writeManaged(sandbox, { permissions: { deny: ['A', 'B', 'C'] } });
    writeSettings(sandbox, { permissions: { deny: ['B'] } });

    const { stdout } = runHook(sandbox);

    assert.deepEqual(readSettings(sandbox).permissions.deny, ['B', 'A', 'C']);
    assert.match(stdout, /deny \+2/);
  });

  it('preserves unrelated local preferences', () => {
    writeManaged(sandbox, { permissions: { deny: ['Read(**/.env)'] } });
    writeSettings(sandbox, {
      theme: 'dark',
      model: 'opus',
      effortLevel: 'high',
      enabledPlugins: { 'shettayyy@claude-plugin': true },
      permissions: { allow: ['Bash(ls *)'], deny: [] },
    });

    const settings = (runHook(sandbox), readSettings(sandbox));

    assert.equal(settings.theme, 'dark');
    assert.equal(settings.model, 'opus');
    assert.equal(settings.effortLevel, 'high');
    assert.deepEqual(settings.enabledPlugins, { 'shettayyy@claude-plugin': true });
    assert.deepEqual(settings.permissions.allow, ['Bash(ls *)']);
  });

  it('is idempotent across repeated sessions', () => {
    writeManaged(sandbox, { permissions: { deny: ['A', 'B'] } });
    runHook(sandbox);
    const first = readSettingsRaw(sandbox);

    const { stdout } = runHook(sandbox);

    assert.equal(stdout.trim(), '');
    assert.equal(readSettingsRaw(sandbox), first);
  });

  it('replaces a non-array deny value rather than crashing', () => {
    writeManaged(sandbox, { permissions: { deny: ['A'] } });
    writeSettings(sandbox, { permissions: { deny: 'oops' } });

    const { status } = runHook(sandbox);

    assert.equal(status, 0);
    assert.deepEqual(readSettings(sandbox).permissions.deny, ['A']);
  });
});

describe('obsolete deny rules', () => {
  /** @type {{pluginRoot: string, configDir: string}} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  it('retires rules the plugin has marked obsolete', () => {
    writeManaged(sandbox, {
      permissions: { deny: ['Edit(**/.env)'] },
      obsoleteDeny: ['Bash(**/.env)'],
    });
    writeSettings(sandbox, { permissions: { deny: ['Bash(**/.env)'] } });

    const { stdout } = runHook(sandbox);

    assert.deepEqual(readSettings(sandbox).permissions.deny, ['Edit(**/.env)']);
    assert.match(stdout, /deny \+1\/-1/);
  });

  it('never removes a rule the user added themselves', () => {
    writeManaged(sandbox, {
      permissions: { deny: ['Edit(**/.env)'] },
      obsoleteDeny: ['Bash(**/.env)'],
    });
    writeSettings(sandbox, { permissions: { deny: ['Read(**/secrets.json)', 'Bash(**/.env)'] } });

    runHook(sandbox);

    assert.deepEqual(readSettings(sandbox).permissions.deny, [
      'Read(**/secrets.json)',
      'Edit(**/.env)',
    ]);
  });

  it('re-adds a rule that is both required and listed obsolete', () => {
    writeManaged(sandbox, {
      permissions: { deny: ['A'] },
      obsoleteDeny: ['A'],
    });
    writeSettings(sandbox, { permissions: { deny: ['A'] } });

    runHook(sandbox);

    assert.deepEqual(readSettings(sandbox).permissions.deny, ['A']);
  });

  it('settles after one run when retiring rules', () => {
    writeManaged(sandbox, {
      permissions: { deny: ['Edit(**/.env)'] },
      obsoleteDeny: ['Bash(**/.env)'],
    });
    writeSettings(sandbox, { permissions: { deny: ['Bash(**/.env)'] } });
    runHook(sandbox);

    const { stdout } = runHook(sandbox);

    assert.equal(stdout.trim(), '');
  });
});

describe('marketplace merge', () => {
  /** @type {{pluginRoot: string, configDir: string}} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  it('backfills autoUpdate onto an entry registered before the flag existed', () => {
    const source = { source: 'github', repo: 'shettayyy/claude-plugin' };
    writeManaged(sandbox, {
      extraKnownMarketplaces: { 'claude-plugin': { source, autoUpdate: true } },
    });
    writeSettings(sandbox, { extraKnownMarketplaces: { 'claude-plugin': { source } } });

    runHook(sandbox);

    assert.equal(readSettings(sandbox).extraKnownMarketplaces['claude-plugin'].autoUpdate, true);
  });

  it('leaves marketplaces the plugin does not declare untouched', () => {
    writeManaged(sandbox, {
      extraKnownMarketplaces: { mine: { autoUpdate: true } },
    });
    writeSettings(sandbox, {
      extraKnownMarketplaces: { theirs: { source: { source: 'github', repo: 'someone/else' } } },
    });

    const entries = (runHook(sandbox), readSettings(sandbox).extraKnownMarketplaces);

    assert.deepEqual(entries.theirs, { source: { source: 'github', repo: 'someone/else' } });
    assert.equal(entries.mine.autoUpdate, true);
  });

  it('is idempotent once the entry matches', () => {
    writeManaged(sandbox, {
      extraKnownMarketplaces: { 'claude-plugin': { autoUpdate: true } },
    });
    runHook(sandbox);

    const { stdout } = runHook(sandbox);

    assert.equal(stdout.trim(), '');
  });
});

describe('failure handling', () => {
  /** @type {{pluginRoot: string, configDir: string}} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  it('leaves a malformed settings.json exactly as it found it', () => {
    writeManaged(sandbox, { permissions: { deny: ['A'] } });
    writeSettings(sandbox, '{ this is not json');

    const { status } = runHook(sandbox);

    assert.equal(status, 0);
    assert.equal(readSettingsRaw(sandbox), '{ this is not json');
  });

  it('skips settings when the plugin ships malformed managed settings', () => {
    writeManaged(sandbox, '{ broken');
    writeSettings(sandbox, { theme: 'dark' });

    const { status } = runHook(sandbox);

    assert.equal(status, 0);
    assert.deepEqual(readSettings(sandbox), { theme: 'dark' });
  });

  it('exits 0 and syncs nothing when the config dir is unwritable', () => {
    writeRules(sandbox, '# Rules\n');
    writeManaged(sandbox, { permissions: { deny: ['A'] } });
    rmSync(sandbox.configDir, { recursive: true, force: true });
    writeFileSync(sandbox.configDir, 'not a directory', 'utf8');

    const { status } = runHook(sandbox);

    assert.equal(status, 0);
  });

  it('leaves no temp file behind after a successful write', () => {
    writeManaged(sandbox, { permissions: { deny: ['A'] } });

    runHook(sandbox);

    assert.throws(() => readFileSync(join(sandbox.configDir, 'settings.json.tools-sync.tmp')));
  });
});

describe('shipped config', () => {
  it('retires every rule it removed from the required set', () => {
    const managed = JSON.parse(
      readFileSync(
        join(repoRoot, 'plugins', 'shettayyy', 'config', 'managed-settings.json'),
        'utf8',
      ),
    );
    const required = managed.permissions?.deny ?? [];
    const obsolete = managed.obsoleteDeny ?? [];

    const overlap = obsolete.filter((rule) => required.includes(rule));
    assert.deepEqual(overlap, [], 'a rule cannot be both required and obsolete');
  });

  it('applies cleanly to a machine that has none of it yet', () => {
    const sandbox = makeSandbox();
    const pluginConfig = join(repoRoot, 'plugins', 'shettayyy', 'config');
    writeManaged(sandbox, readFileSync(join(pluginConfig, 'managed-settings.json'), 'utf8'));
    writeRules(sandbox, readFileSync(join(pluginConfig, 'claude-rules.md'), 'utf8'));

    const { status } = runHook(sandbox);
    const second = runHook(sandbox);

    assert.equal(status, 0);
    assert.equal(second.stdout.trim(), '', 'shipped config must settle after one run');
  });
});
