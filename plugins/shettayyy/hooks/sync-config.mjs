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

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
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
 * Reconciles deny rules in a settings object, in place.
 *
 * Adds every rule this plugin requires and drops only those it
 * explicitly marks obsolete. A rule the user added themselves is
 * never removed, since it appears in neither list.
 *
 * @param {Record<string, unknown>} settings Parsed settings.json.
 * @param {string[]} wanted Deny rules this plugin requires.
 * @param {string[]} obsolete Deny rules this plugin has retired.
 * @returns {string | null} A summary of what changed, or null.
 */
function applyDenyRules(settings, wanted, obsolete) {
  const required = Array.isArray(wanted) ? wanted : [];
  const retired = Array.isArray(obsolete) ? obsolete : [];
  if (required.length === 0 && retired.length === 0) return null;

  const current = settings.permissions?.deny;
  const deny = Array.isArray(current) ? current : [];

  const kept = deny.filter((rule) => !retired.includes(rule));
  const removedCount = deny.length - kept.length;

  const missing = required.filter((rule) => !kept.includes(rule));
  if (missing.length === 0 && removedCount === 0) return null;

  settings.permissions = { ...settings.permissions, deny: [...kept, ...missing] };

  const parts = [];
  if (missing.length > 0) parts.push(`+${missing.length}`);
  if (removedCount > 0) parts.push(`-${removedCount}`);
  return `deny ${parts.join('/')}`;
}

/**
 * Applies declared marketplace entries to a settings object, in place.
 *
 * Each declared entry is shallow-merged over whatever is already
 * there, so `autoUpdate` reaches a machine that registered the
 * marketplace before the flag existed.
 *
 * Marketplaces this plugin does not declare are left untouched.
 *
 * @param {Record<string, unknown>} settings Parsed settings.json.
 * @param {Record<string, object>} wanted Marketplace entries to apply.
 * @returns {string | null} A summary of what changed, or null.
 */
function applyMarketplaces(settings, wanted) {
  if (!wanted || typeof wanted !== 'object') return null;

  const existing = settings.extraKnownMarketplaces ?? {};
  const merged = { ...existing };
  const updated = [];

  for (const [name, entry] of Object.entries(wanted)) {
    const candidate = { ...existing[name], ...entry };
    if (JSON.stringify(candidate) === JSON.stringify(existing[name])) continue;

    merged[name] = candidate;
    updated.push(name);
  }

  if (updated.length === 0) return null;

  settings.extraKnownMarketplaces = merged;
  return `marketplaces: ${updated.join(', ')}`;
}

/**
 * Merges this plugin's managed settings into the global settings.json.
 *
 * Only adds or updates what this plugin declares. Local keys such as
 * theme, model, and effortLevel are never read or rewritten.
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

  const summaries = [
    applyDenyRules(settings, managed?.permissions?.deny, managed?.obsoleteDeny),
    applyMarketplaces(settings, managed?.extraKnownMarketplaces),
  ].filter(Boolean);

  if (summaries.length === 0) return;

  writeAtomic(target, `${JSON.stringify(settings, null, 2)}\n`);
  changed.push(`settings.json (${summaries.join('; ')})`);
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
