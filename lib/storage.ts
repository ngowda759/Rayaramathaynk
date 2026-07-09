/**
 * Storage utility for reading and writing JSON files.
 * Uses Node.js fs/promises for file operations.
 * Provides atomic writes to prevent data corruption.
 */

import fs from "fs/promises";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), "storage");

/**
 * Ensures the storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Gets the full path for a storage file
 */
export function getStoragePath(filename: string): string {
  // Remove .json extension if provided
  const name = filename.endsWith(".json") ? filename : `${filename}.json`;
  return path.join(STORAGE_DIR, name);
}

/**
 * Reads a JSON file and returns the parsed data
 */
export async function readJson<T = unknown>(filename: string): Promise<T | null> {
  try {
    const filePath = getStoragePath(filename);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Writes data to a JSON file atomically.
 * Uses a temporary file and rename for atomic writes.
 */
export async function writeJson<T>(
  filename: string,
  data: T
): Promise<void> {
  await ensureStorageDir();

  const filePath = getStoragePath(filename);
  const tempPath = `${filePath}.tmp`;

  // Write to temporary file first
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, content, "utf-8");

  // Rename temp file to target (atomic on most filesystems)
  await fs.rename(tempPath, filePath);
}

/**
 * Appends an item to an array in a JSON file.
 * Creates the file if it doesn't exist.
 */
export async function appendToJsonArray<T extends { id?: string }>(
  filename: string,
  item: T,
  idField: keyof T = "id" as keyof T
): Promise<T & { id: string }> {
  const data = await readJson<{ items: T[] }>(filename) || { items: [] };

  // Generate ID if not provided
  const itemWithId = {
    ...item,
    [idField]: (item[idField] as string) || generateId(),
  } as T & { id: string };

  data.items.push(itemWithId);
  await writeJson(filename, data);

  return itemWithId;
}

/**
 * Updates an item in an array by ID
 */
export async function updateJsonArrayItem<T extends { id: string }>(
  filename: string,
  id: string,
  updates: Partial<T>
): Promise<T | null> {
  const data = await readJson<{ items: T[] }>(filename);
  if (!data) return null;

  const index = data.items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  data.items[index] = { ...data.items[index], ...updates };
  await writeJson(filename, data);

  return data.items[index];
}

/**
 * Deletes an item from an array by ID
 */
export async function deleteJsonArrayItem<T extends { id: string }>(
  filename: string,
  id: string
): Promise<boolean> {
  const data = await readJson<{ items: T[] }>(filename);
  if (!data) return false;

  const initialLength = data.items.length;
  data.items = data.items.filter((item) => item.id !== id);

  if (data.items.length === initialLength) return false;

  await writeJson(filename, data);
  return true;
}

/**
 * Gets an item from an array by ID
 */
export async function getJsonArrayItem<T extends { id: string }>(
  filename: string,
  id: string
): Promise<T | null> {
  const data = await readJson<{ items: T[] }>(filename);
  if (!data) return null;

  return data.items.find((item) => item.id === id) || null;
}

/**
 * Gets all items from an array in a JSON file
 */
export async function getJsonArray<T>(
  filename: string
): Promise<T[]> {
  const data = await readJson<{ items: T[] }>(filename);
  return data?.items || [];
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deletes a storage file
 */
export async function deleteStorageFile(filename: string): Promise<boolean> {
  try {
    const filePath = getStoragePath(filename);
    await fs.unlink(filePath);
    return true;
  } catch (error: any) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Lists all files in storage directory
 */
export async function listStorageFiles(): Promise<string[]> {
  await ensureStorageDir();
  const files = await fs.readdir(STORAGE_DIR);
  return files.filter((f) => f.endsWith(".json"));
}
