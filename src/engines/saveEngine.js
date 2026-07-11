// Save engine: versioned localStorage persistence plus JSON export/import.
// Storage is injected (duck-typed getItem/setItem/removeItem) so this stays
// DOM-independent and testable outside a browser.

export const SAVE_KEY = 'footyverse_save_v1';
export const CURRENT_VERSION = 1;

export function saveGame(storage, state) {
  const record = { version: CURRENT_VERSION, savedAt: new Date().toISOString(), state };
  storage.setItem(SAVE_KEY, JSON.stringify(record));
  return record;
}

export function loadGame(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  const record = JSON.parse(raw);
  return migrate(record);
}

export function deleteSave(storage) {
  storage.removeItem(SAVE_KEY);
}

export function exportSave(state) {
  return JSON.stringify({ version: CURRENT_VERSION, savedAt: new Date().toISOString(), state }, null, 2);
}

export function importSave(json) {
  let record;
  try {
    record = JSON.parse(json);
  } catch {
    throw new Error('Import failed: not valid JSON.');
  }
  if (typeof record.version !== 'number') {
    throw new Error('Import failed: missing save version.');
  }
  if (!record.state || typeof record.state !== 'object') {
    throw new Error('Import failed: missing save state.');
  }
  const migrated = migrate(record);
  return migrated.state;
}

function migrate(record) {
  // Placeholder for future version migrations; v0.5 only ever produces
  // CURRENT_VERSION records, so this is currently an identity pass-through.
  if (record.version === CURRENT_VERSION) return record;
  return { ...record, version: CURRENT_VERSION };
}
