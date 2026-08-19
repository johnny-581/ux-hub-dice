// Who's in the draw. Main process only.
//
// CONFIG.NAMES is just the first-run seed; from then on this file owns the
// list and keeps it in userData, next to position.json. That's what lets the
// packaged app change its roster — config.js is sealed inside the bundle.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG = require('./config');

// Lazy, not a constant: app.getPath() isn't available until the app is ready.
const rosterFile = () => path.join(app.getPath('userData'), 'names.json');

let entries = null;

function seed() {
  return (CONFIG.NAMES || []).map((name) => ({ name, enabled: true }));
}

// A hand-edited or half-written file shouldn't take the app down, so anything
// unusable is dropped rather than trusted.
function sanitize(raw) {
  if (!Array.isArray(raw)) return null;

  const clean = [];
  const seen = new Set();

  for (const item of raw) {
    if (!item || typeof item.name !== 'string') continue;
    const name = item.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    clean.push({ name, enabled: item.enabled !== false });
  }

  return clean.length ? clean : null;
}

// Something must always be pickable, and the roster must never be empty — the
// UI disables the controls that would break either, but the rules live here so
// the two menus and the editor can't disagree about them.
function ensureOneEnabled() {
  if (entries.length && !entries.some((entry) => entry.enabled)) entries[0].enabled = true;
}

function load() {
  if (entries) return entries;
  try {
    entries = sanitize(JSON.parse(fs.readFileSync(rosterFile(), 'utf8'))) || seed();
  } catch {
    entries = seed(); // first launch, or unreadable
  }
  ensureOneEnabled();
  return entries;
}

function save() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(rosterFile(), JSON.stringify(entries, null, 2));
  } catch (error) {
    console.warn('Could not save names:', error.message);
  }
}

// Copies, so a caller poking at the result can't quietly corrupt the store.
function list() {
  return load().map((entry) => ({ ...entry }));
}

function activeNames() {
  return load()
    .filter((entry) => entry.enabled)
    .map((entry) => entry.name);
}

// Returns a reason rather than a bare false — the editor tells you why.
function add(name) {
  const clean = String(name ?? '').trim();
  if (!clean) return 'empty';

  const all = load();
  if (all.some((entry) => entry.name.toLowerCase() === clean.toLowerCase())) return 'duplicate';

  all.push({ name: clean, enabled: true });
  save();
  return 'ok';
}

function remove(name) {
  const all = load();
  if (all.length <= 1) return false; // never leave it empty

  const index = all.findIndex((entry) => entry.name === name);
  if (index < 0) return false;

  all.splice(index, 1);
  ensureOneEnabled(); // that may have been the only checked one
  save();
  return true;
}

function toggle(name) {
  const all = load();
  const entry = all.find((item) => item.name === name);
  if (!entry) return false;

  // Unchecking the last checked name would leave nothing to pick.
  if (entry.enabled && all.filter((item) => item.enabled).length === 1) return false;

  entry.enabled = !entry.enabled;
  save();
  return true;
}

module.exports = { list, activeNames, add, remove, toggle };
