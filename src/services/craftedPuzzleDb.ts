import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { CustomPuzzleItem } from '../types/app';
import type { GridSize } from '../types/puzzle';

const META_KEY = 'tilecraft_crafted_puzzles_v1';

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

/**
 * Native iOS/Android durable crafted-puzzle store.
 * Copies cropped JPEG into app DocumentDirectory and stores lightweight metadata in AsyncStorage.
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
    const dir = `${FileSystem.documentDirectory}crafted/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const destUri = `${dir}${input.id}.jpg`;

    await FileSystem.copyAsync({
      from: input.sourceImageUri,
      to: destUri,
    });

    const item: CustomPuzzleItem = {
      id: input.id,
      title: input.title,
      imageUri: destUri,
      preferredGridSize: input.preferredGridSize,
      createdAt: input.createdAt,
      isLocalUpload: input.isLocalUpload,
    };

    const existing = await loadCraftedPuzzles();
    const next = [item, ...existing.items.filter((p) => p.id !== item.id)];
    await AsyncStorage.setItem(META_KEY, JSON.stringify(next));

    return { ok: true, item };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Could not save puzzle to device storage.',
    };
  }
}

export async function loadCraftedPuzzles(): Promise<LoadCraftedPuzzlesResult> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { ok: true, items: [] };
    const parsed = JSON.parse(raw) as CustomPuzzleItem[];
    return { ok: true, items: Array.isArray(parsed) ? parsed : [] };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : 'Failed to load crafted puzzles.',
    };
  }
}

export async function loadCraftedPuzzleById(
  id: string
): Promise<CustomPuzzleItem | null> {
  const { items } = await loadCraftedPuzzles();
  return items.find((item) => item.id === id) ?? null;
}

export async function deleteCraftedPuzzle(id: string): Promise<boolean> {
  try {
    const { items } = await loadCraftedPuzzles();
    const target = items.find((i) => i.id === id);
    const next = items.filter((i) => i.id !== id);
    await AsyncStorage.setItem(META_KEY, JSON.stringify(next));
    if (target?.imageUri) {
      await FileSystem.deleteAsync(target.imageUri, { idempotent: true });
    }
    return true;
  } catch {
    return false;
  }
}
