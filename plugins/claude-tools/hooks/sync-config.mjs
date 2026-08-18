#!/usr/bin/env node
// Applies this plugin's versioned config to the machine's global Claude Code
// config. Runs on SessionStart, which is the first moment after
// `claude plugin update` takes effect (updates require a restart).
//
// - config/claude-rules.md      -> <config>/CLAUDE.md        (full overwrite)
// - config/managed-settings.json -> <config>/settings.json   (deny rules merged)
//
// Never throws and always exits 0. A broken sync must not break the session.

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

const changed = [];

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// Write via temp file + rename so an interrupted run cannot leave a
// half-written settings.json behind.
function writeAtomic(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tools-sync.tmp`;
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, path);
}

function syncRules() {
  const source = read(join(pluginRoot, 'config', 'claude-rules.md'));
  if (source === null) return;

  const target = join(configDir, 'CLAUDE.md');
  if (read(target) === source) return;

  writeAtomic(target, source);
  changed.push('CLAUDE.md');
}

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
      // Malformed settings.json is the user's to fix. Overwriting it here
      // would destroy their theme, model, and effort settings.
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
    console.log(`[claude-tools] synced global config: ${changed.join(', ')}`);
  }
} catch (error) {
  console.error(`[claude-tools] config sync skipped: ${error.message}`);
}

process.exit(0);
