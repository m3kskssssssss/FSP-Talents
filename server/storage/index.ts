import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { randomToken } from "../lib/crypto";

export interface FileStorage {
  readonly name: string;
  put(prefix: string, filename: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
}

class LocalStorage implements FileStorage {
  readonly name = "local";
  private root = path.resolve(env().STORAGE_DIR);
  async put(prefix: string, filename: string, data: Buffer) {
    const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-80);
    const key = `${prefix}/${randomToken(12)}-${safe}`;
    const full = path.join(this.root, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return key;
  }
  async get(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root)) throw new Error("invalid key");
    return readFile(full);
  }
}

/** Vercel Blob. Files are stored with random suffixes; URLs are not exposed to other users. */
class BlobStorage implements FileStorage {
  readonly name = "vercel-blob";
  async put(prefix: string, filename: string, data: Buffer, contentType: string) {
    const { put } = await import("@vercel/blob");
    const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-80);
    const res = await put(`${prefix}/${safe}`, data, {
      access: "public",
      addRandomSuffix: true,
      contentType,
      token: env().BLOB_READ_WRITE_TOKEN,
    });
    return res.url;
  }
  async get(key: string) {
    const res = await fetch(key);
    if (!res.ok) throw new Error(`blob fetch ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

let storage: FileStorage | null = null;
export function getStorage(): FileStorage {
  if (!storage) storage = env().BLOB_READ_WRITE_TOKEN ? new BlobStorage() : new LocalStorage();
  return storage;
}

/** Vercel functions reject request bodies above ~4.5 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
