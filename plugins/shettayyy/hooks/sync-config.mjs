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
 * - `config/managed-settings.json` -> `<config>/settings.json`  (deny and ask rules merged)
 *
 * Never throws and always exits 0. A broken sync must not break
 * the session.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
 * The temp name is unique per run. Two sessions starting together
 * would otherwise share one temp file, and one could rename the
 * other's half-written file into place.
 *
 * @param {string} path Destination path.
 * @param {string} contents Full file contents to write.
 * @returns {void}
 */
function writeAtomic(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, contents, 'utf8');
    renameSync(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
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
 * Reconciles one permission rule list in a settings object, in place.
 *
 * Adds every rule this plugin requires and drops only those it
 * explicitly marks obsolete. A rule the user added themselves is
 * never removed, since it appears in neither list.
 *
 * @param {Record<string, unknown>} settings Parsed settings.json.
 * @param {'deny' | 'ask'} kind Which `permissions` list to reconcile.
 * @param {string[]} wanted Rules this plugin requires.
 * @param {string[]} obsolete Rules this plugin has retired.
 * @returns {string | null} A summary of what changed, or null.
 */
function applyPermissionRules(settings, kind, wanted, obsolete) {
  const required = Array.isArray(wanted) ? wanted : [];
  const retired = Array.isArray(obsolete) ? obsolete : [];
  if (required.length === 0 && retired.length === 0) return null;

  const current = settings.permissions?.[kind];
  const rules = Array.isArray(current) ? current : [];

  const kept = rules.filter((rule) => !retired.includes(rule));
  const missing = required.filter((rule) => !kept.includes(rule));
  const next = [...kept, ...missing];

  /**
   * Compare the result rather than the counts. A rule listed as both
   * required and retired is removed and re-added in the same pass,
   * which nets out to no change. Reporting that as a change would
   * rewrite settings.json on every session, forever.
   */
  const unchanged = next.length === rules.length && next.every((rule, i) => rule === rules[i]);
  if (unchanged) return null;

  settings.permissions = { ...settings.permissions, [kind]: next };

  const removedCount = rules.length - kept.length;
  const parts = [];
  if (missing.length > 0) parts.push(`+${missing.length}`);
  if (removedCount > 0) parts.push(`-${removedCount}`);
  return `${kind} ${parts.join('/')}`;
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
    applyPermissionRules(settings, 'deny', managed?.permissions?.deny, managed?.obsoleteDeny),
    applyPermissionRules(settings, 'ask', managed?.permissions?.ask, managed?.obsoleteAsk),
    applyMarketplaces(settings, managed?.extraKnownMarketplaces),
  ].filter(Boolean);

  if (summaries.length === 0) return;

  writeAtomic(target, `${JSON.stringify(settings, null, 2)}\n`);
  changed.push(`settings.json (${summaries.join('; ')})`);
}

/**
 * Shows a message to the user without adding it to Claude's context.
 *
 * Plain stdout from a SessionStart hook becomes Claude's context,
 * and Claude Code hides stderr when the hook exits 0.
 * A `systemMessage` is shown to the user only.
 *
 * @param {string} message Text to show.
 * @returns {void}
 */
function notify(message) {
  process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
}

try {
  syncRules();
  syncSettings();
  if (changed.length > 0) {
    notify(`[shettayyy] synced global config: ${changed.join(', ')}`);
  }
} catch (error) {
  notify(`[shettayyy] config sync skipped: ${error.message}`);
}

process.exit(0);
