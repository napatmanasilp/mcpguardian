import { ToolHashRecord } from './types';
import * as fs from 'fs';
import * as path from 'path';

// ─── Storage ─────────────────────────────────────────────────────────
// In production: use a database table (tool_definition_snapshots).
// For local scanning: persist to a JSON file in user's config directory.

const CONFIG_DIR = process.env.MCPGUARDIAN_CONFIG_DIR || path.join(
  process.env.HOME || process.env.USERPROFILE || '/tmp',
  '.mcpguardian',
);

const HASH_STORE_FILE = path.join(CONFIG_DIR, 'tool_hashes.json');

/** Ensure the config directory exists */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/** Load all stored hash records */
function loadHashStore(): ToolHashRecord[] {
  try {
    ensureConfigDir();
    if (!fs.existsSync(HASH_STORE_FILE)) return [];
    const raw = fs.readFileSync(HASH_STORE_FILE, 'utf-8');
    return JSON.parse(raw) as ToolHashRecord[];
  } catch {
    return [];
  }
}

/** Save hash records to disk */
function saveHashStore(records: ToolHashRecord[]): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(HASH_STORE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Silently fail — hash storage is non-critical
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Load the previous hash record for a given server URL.
 * Returns null if this is the first scan.
 */
export function loadPreviousHash(serverUrl: string): ToolHashRecord | null {
  const records = loadHashStore();
  return records.find(r => r.serverUrl === serverUrl) ?? null;
}

/**
 * Store a new hash record for a server URL.
 * Overwrites any existing record for the same URL.
 */
export function storeHash(record: ToolHashRecord): void {
  const records = loadHashStore();
  const existingIdx = records.findIndex(r => r.serverUrl === record.serverUrl);
  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.push(record);
  }
  saveHashStore(records);
}

/**
 * Compare current hash against the stored hash for a server URL.
 * Returns:
 *   - match: true if hashes are the same
 *   - previousRecord: the stored record (null if first scan)
 *   - currentRecord: the record that would be stored
 *   - diff: list of changed tool names if hashes differ
 */
export function compareHash(
  serverUrl: string,
  currentHash: string,
  currentToolCount: number,
  currentToolNames: string[],
): {
  match: boolean;
  previousRecord: ToolHashRecord | null;
  currentRecord: ToolHashRecord;
  isFirstScan: boolean;
} {
  const previousRecord = loadPreviousHash(serverUrl);
  const currentRecord: ToolHashRecord = {
    serverUrl,
    toolsHash: currentHash,
    scannedAt: new Date().toISOString(),
    toolCount: currentToolCount,
  };

  if (!previousRecord) {
    return { match: true, previousRecord: null, currentRecord, isFirstScan: true };
  }

  const match = previousRecord.toolsHash === currentHash;
  return { match, previousRecord, currentRecord, isFirstScan: false };
}

/**
 * Get all stored hash records (useful for monitoring).
 */
export function getAllRecords(): ToolHashRecord[] {
  return loadHashStore();
}
