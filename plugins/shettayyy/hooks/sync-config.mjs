#!/usr/bin/env node
/**
 * Applies this plugin's versioned config to the machine's global
 * Claude Code config.
 *
 * Runs on SessionStart, which is the first moment after
 * `claude plugin update` takes effect, since updates require a
 * restart.
 *
 * - `config/claude-rules.md`       -> `<config>/CLAUDE.md`      (full overwrite)
 * - `config/managed-settings.json` -> `<config>/settings.json`  (deny rules merged)
 *
 * Never throws and always exits 0. A broken sync must not break
 * the session.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

/** @type {string[]} Names of the files this run actually rewrote. */
const changed = [];

/**
 * Reads a file, treating any failure as absence.
 *
 * @param {string} path Absolute path to read.
 * @returns {string | null} File contents, or null if unreadable.
 */
function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Writes through a temp file and renames it into place.
 *
 * An interrupted run must not leave a half-written settings.json
 * behind, so the file only ever appears complete.
 *
 * @param {string} path Destination path.
 * @param {string} contents Full file contents to write.
 * @returns {void}
 */
function writeAtomic(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tools-sync.tmp`;
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, path);
}

/**
 * Overwrites the global CLAUDE.md with this plugin's rules.
 *
 * The repo is the sole owner of that file, so the copy is
 * wholesale rather than merged.
 *
 * @returns {void}
 */
function syncRules() {
  const source = read(join(pluginRoot, 'config', 'claude-rules.md'));
  if (source === null) return;

  const target = join(configDir, 'CLAUDE.md');
  if (read(target) === source) return;

  writeAtomic(target, source);
  changed.push('CLAUDE.md');
}

/**
 * Merges this plugin's deny rules into the global settings.json.
 *
 * Only adds entries. Local keys such as theme, model, and
 * effortLevel are never read or rewritten.
 *
 * @returns {void}
 */
function syncSettings() {
  const raw = read(join(pluginRoot, 'config', 'managed-settings.json'));
  if (raw === null) return;

  let managed;
  try {
    managed = JSON.parse(raw);
  } catch {
    return;
  }

  const wanted = managed?.permissions?.deny;
  if (!Array.isArray(wanted) || wanted.length === 0) return;

  const target = join(configDir, 'settings.json');
  const existingRaw = read(target);

  let settings = {};
  if (existingRaw !== null) {
    try {
      settings = JSON.parse(existingRaw);
    } catch {
      /**
       * A malformed settings.json is the user's to fix. Overwriting
       * it here would destroy their theme, model, and effort settings.
       */
      return;
    }
  }

  const current = settings.permissions?.deny;
  const deny = Array.isArray(current) ? current : [];
  const missing = wanted.filter((rule) => !deny.includes(rule));
  if (missing.length === 0) return;

  settings.permissions = { ...settings.permissions, deny: [...deny, ...missing] };
  writeAtomic(target, `${JSON.stringify(settings, null, 2)}\n`);
  changed.push(`settings.json (+${missing.length} deny)`);
}

try {
  syncRules();
  syncSettings();
  if (changed.length > 0) {
    console.log(`[shettayyy] synced global config: ${changed.join(', ')}`);
  }
} catch (error) {
  console.error(`[shettayyy] config sync skipped: ${error.message}`);
}

process.exit(0);
