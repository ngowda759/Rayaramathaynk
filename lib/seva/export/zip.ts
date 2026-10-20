/**
 * Zips the ticked CSV parts of an export into one download (DESIGN-BOOK 12.6). Text is stored as UTF-8.
 */
import { strToU8, zipSync, type Zippable } from "fflate";

export interface ZipEntry {
  name: string;
  content: string | Uint8Array;
}

/** Builds a zip archive; throws RangeError('duplicate_file_name') when two entries share a name. */
export function zipFiles(files: ZipEntry[]): Uint8Array {
  const entries: Zippable = {};
  for (const file of files) {
    if (Object.prototype.hasOwnProperty.call(entries, file.name)) {
      throw new RangeError("duplicate_file_name");
    }
    entries[file.name] = typeof file.content === "string" ? strToU8(file.content) : file.content;
  }
  return zipSync(entries);
}
