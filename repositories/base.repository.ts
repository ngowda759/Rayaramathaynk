/**
 * Base repository interface for JSON storage.
 * This interface ensures all repositories follow a consistent pattern,
 * making it easy to swap implementations (e.g., JSON to SQL later).
 */

export interface BaseRepository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: string, data: Partial<Omit<T, "id">>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export interface ListRepository<T> {
  getAll(): Promise<T[]>;
}
