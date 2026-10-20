/**
 * The counter's Excel copy folder (Design Book 9.11): the receptionist picks a folder once with the Windows folder
 * picker (File System Access API); the PC then writes `<folder>\<YYYY-MM-DD>.xlsx` for each business day.
 *
 * The folder handle is kept in the counter's IndexedDB ('files' store). Browsers may ask again for permission after a
 * restart, so the counter shows a one-click "Allow saving" prompt that calls `allowExcelFolder` (UNVERIFIED on the
 * temple PC, open item O-08). Browser only; nothing here talks to the network.
 */

export type FolderStatus = 'not_set' | 'ready' | 'needs_permission' | 'unsupported';

/** The part of the counter database this module uses; the real `SevaDb` fits it. */
export interface FolderDb {
  get(storeName: 'files', key: string): Promise<FileSystemDirectoryHandle | undefined>;
  put(storeName: 'files', value: FileSystemDirectoryHandle, key: string): Promise<unknown>;
}

/** Key of the Excel copy folder in the 'files' store. */
export const EXCEL_FOLDER_KEY = 'excel-folder';

/** Remembers the last folder in the picker, so it opens where the receptionist chose before. */
const PICKER_ID = 'seva-receipts';

const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

type PermissionDescriptor = { mode: 'readwrite' };
type HandlePermission = 'granted' | 'denied' | 'prompt';

/** Permission methods Chromium adds to file handles; not in TypeScript's DOM library. */
interface PermissionedHandle {
  queryPermission?(descriptor: PermissionDescriptor): Promise<HandlePermission>;
  requestPermission?(descriptor: PermissionDescriptor): Promise<HandlePermission>;
}

/** `window.showDirectoryPicker` (Chromium only); not in TypeScript's DOM library. */
type DirectoryPicker = (options: { mode: 'readwrite'; id: string }) => Promise<FileSystemDirectoryHandle>;

function directoryPicker(): DirectoryPicker | null {
  const picker = (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  return typeof picker === 'function' ? (picker as DirectoryPicker) : null;
}

const READ_WRITE: PermissionDescriptor = { mode: 'readwrite' };

/** Permission for an already chosen folder; a browser without the query method is treated as allowed. */
async function permissionOf(handle: FileSystemDirectoryHandle): Promise<HandlePermission> {
  const permissioned = handle as FileSystemDirectoryHandle & PermissionedHandle;
  if (typeof permissioned.queryPermission !== 'function') return 'granted';
  return permissioned.queryPermission(READ_WRITE);
}

/**
 * Whether the chosen folder can be written now, without asking anything. Unlike `excelFolderStatus` this does not look
 * for the picker: a folder chosen earlier stays writable even where the picker is hidden.
 */
export async function folderWriteStatus(db: FolderDb): Promise<Exclude<FolderStatus, 'unsupported'>> {
  const handle = await db.get('files', EXCEL_FOLDER_KEY);
  if (!handle) return 'not_set';
  return (await permissionOf(handle)) === 'granted' ? 'ready' : 'needs_permission';
}

/**
 * Opens the Windows folder picker and keeps the chosen folder. Call only from a click. Returns null when the browser
 * has no picker or the receptionist closes it; other failures (for example a system folder) are thrown.
 */
export async function chooseExcelFolder(db: FolderDb): Promise<{ name: string } | null> {
  const picker = directoryPicker();
  if (!picker) return null;
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await picker({ mode: 'readwrite', id: PICKER_ID });
  } catch (err) {
    // A DOMException; checked by name because it is not always `instanceof Error` (other realms, older engines).
    if (typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError') return null;
    throw err;
  }
  await db.put('files', handle, EXCEL_FOLDER_KEY);
  return { name: handle.name };
}

/** What the counter strip shows about the Excel copy folder. */
export async function excelFolderStatus(db: FolderDb): Promise<FolderStatus> {
  if (!directoryPicker()) return 'unsupported';
  return folderWriteStatus(db);
}

/** Asks the browser again for permission to write in the chosen folder. Call only from a click. */
export async function allowExcelFolder(db: FolderDb): Promise<boolean> {
  const handle = await db.get('files', EXCEL_FOLDER_KEY);
  if (!handle) return false;
  const permissioned = handle as FileSystemDirectoryHandle & PermissionedHandle;
  if (typeof permissioned.requestPermission !== 'function') return (await permissionOf(handle)) === 'granted';
  return (await permissioned.requestPermission(READ_WRITE)) === 'granted';
}

/** Writes (or replaces) `<YYYY-MM-DD>.xlsx` in the chosen folder. Never asks for permission itself. */
export async function writeDayCopy(
  db: FolderDb,
  date: string,
  bytes: ArrayBuffer,
): Promise<'written' | 'needs_permission' | 'not_set'> {
  if (!DATE_PATTERN.test(date)) throw new RangeError('invalid_date');
  const handle = await db.get('files', EXCEL_FOLDER_KEY);
  if (!handle) return 'not_set';
  if ((await permissionOf(handle)) !== 'granted') return 'needs_permission';
  const file = await handle.getFileHandle(`${date}.xlsx`, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(bytes);
    await writable.close();
  } catch (err) {
    // Throw away the half-written temporary file; the previous copy on disk stays as it was.
    await writable.abort().catch(() => undefined);
    throw err;
  }
  return 'written';
}
