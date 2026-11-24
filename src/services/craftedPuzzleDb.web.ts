import type { CustomPuzzleItem } from '../types/app';
import type { GridSize } from '../types/puzzle';

const DB_NAME = 'tilecraft_crafted_db';
const DB_VERSION = 1;
const STORE_NAME = 'crafted_puzzles';

interface StoredCraftedRecord {
  id: string;
  title: string;
  preferredGridSize: GridSize;
  createdAt: string;
  isLocalUpload: boolean;
  imageBlob: Blob;
}

export interface SaveCraftedPuzzleResult {
  ok: boolean;
  item?: CustomPuzzleItem;
  error?: string;
}

export interface LoadCraftedPuzzlesResult {
  ok: boolean;
  items: CustomPuzzleItem[];
  error?: string;
}

const activeObjectUrls = new Map<string, string>();

function openCraftedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser context.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open local puzzle database.'));
  });
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read cropped image data.');
  }
  return await response.blob();
}

function getRuntimeObjectUrl(id: string, blob: Blob): string {
  const existing = activeObjectUrls.get(id);
  if (existing) {
    URL.revokeObjectURL(existing);
  }
  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(id, url);
  return url;
}

/**
 * Persists a crafted photo puzzle (binary Blob + metadata) in IndexedDB on Web.
 * Never persists temporary object URLs or puts large image bytes into localStorage.
 */
export async function saveCraftedPuzzle(input: {
  id: string;
  title: string;
  sourceImageUri: string;
  preferredGridSize: GridSize;
  createdAt: string;
  isLocalUpload: boolean;
}): Promise<SaveCraftedPuzzleResult> {
  try {
    const blob = await uriToBlob(input.sourceImageUri);
    const db = await openCraftedDb();

    const record: StoredCraftedRecord = {
      id: input.id,
      title: input.title,
      preferredGridSize: input.preferredGridSize,
      createdAt: input.createdAt,
      isLocalUpload: input.isLocalUpload,
      imageBlob: blob,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error('Could not save puzzle to browser storage.'));
      tx.onabort = () =>
        reject(tx.error ?? new Error('Browser storage ran out of space or aborted.'));
    });

    db.close();

    const runtimeUri = getRuntimeObjectUrl(record.id, record.imageBlob);
    return {
      ok: true,
      item: {
        id: record.id,
        title: record.title,
        imageUri: runtimeUri,
        preferredGridSize: record.preferredGridSize,
        createdAt: record.createdAt,
        isLocalUpload: record.isLocalUpload,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Storage is unavailable. Your puzzle could not be saved permanently.',
    };
  }
}

/**
 * Loads all crafted puzzles from IndexedDB and synthesizes fresh runtime object URLs.
 */
export async function loadCraftedPuzzles(): Promise<LoadCraftedPuzzlesResult> {
  try {
    const db = await openCraftedDb();
    const records = await new Promise<StoredCraftedRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredCraftedRecord[]) ?? []);
      req.onerror = () =>
        reject(req.error ?? new Error('Could not read saved puzzles.'));
    });
    db.close();

    records.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const items: CustomPuzzleItem[] = records.map((rec) => ({
      id: rec.id,
      title: rec.title,
      imageUri: getRuntimeObjectUrl(rec.id, rec.imageBlob),
      preferredGridSize: rec.preferredGridSize,
      createdAt: rec.createdAt,
      isLocalUpload: rec.isLocalUpload,
    }));

    return { ok: true, items };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error:
        err instanceof Error
          ? err.message
          : 'Unable to access saved puzzles in this browser.',
    };
  }
}

/**
 * Resolves a single crafted puzzle by stable ID (used when resuming an active photo game).
 */
export async function loadCraftedPuzzleById(
  id: string
): Promise<CustomPuzzleItem | null> {
  try {
    const db = await openCraftedDb();
    const rec = await new Promise<StoredCraftedRecord | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () =>
          resolve(req.result as StoredCraftedRecord | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    if (!rec) return null;

    return {
      id: rec.id,
      title: rec.title,
      imageUri: getRuntimeObjectUrl(rec.id, rec.imageBlob),
      preferredGridSize: rec.preferredGridSize,
      createdAt: rec.createdAt,
      isLocalUpload: rec.isLocalUpload,
    };
  } catch {
    return null;
  }
}

export async function deleteCraftedPuzzle(id: string): Promise<boolean> {
  try {
    const db = await openCraftedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const existingUrl = activeObjectUrls.get(id);
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      activeObjectUrls.delete(id);
    }
    return true;
  } catch {
    return false;
  }
}
