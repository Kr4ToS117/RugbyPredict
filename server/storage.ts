import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

export interface StoredFile {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface SaveOptions {
  content: string | Buffer;
  filename?: string;
  extension?: string;
  prefix?: string;
  contentType: string;
}

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage");
const MANIFEST_PATH = path.join(STORAGE_ROOT, "manifest.json");

function buildKey(prefix?: string): string {
  const safePrefix = prefix?.replace(/[^a-zA-Z0-9_-]+/g, "-") ?? "";
  const base = randomUUID();
  return safePrefix ? `${safePrefix}--${base}` : base;
}

async function ensureStorageRoot() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

async function readManifest(): Promise<Record<string, StoredFile>> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, StoredFile>;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeManifest(manifest: Record<string, StoredFile>) {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export async function saveFile({
  content,
  filename,
  extension,
  prefix,
  contentType,
}: SaveOptions): Promise<StoredFile> {
  await ensureStorageRoot();
  const key = buildKey(prefix);
  const safeExtension = extension?.startsWith(".") ? extension : extension ? `.${extension}` : "";
  const finalName = filename ?? `${key}${safeExtension}`;
  const filePath = path.join(STORAGE_ROOT, key);
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const now = new Date().toISOString();

  await fs.writeFile(filePath, buffer);

  const manifest = await readManifest();
  const stored: StoredFile = {
    key,
    filename: finalName,
    contentType,
    size: buffer.byteLength,
    createdAt: manifest[key]?.createdAt ?? now,
    updatedAt: now,
    url: `/api/storage/${encodeURIComponent(key)}`,
  };
  manifest[key] = stored;
  await writeManifest(manifest);

  return stored;
}

export async function listFiles(prefix?: string): Promise<StoredFile[]> {
  const manifest = await readManifest();
  const files = Object.values(manifest);
  if (!prefix) {
    return files.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  const normalized = prefix.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return files
    .filter((item) => item.key.startsWith(`${normalized}--`))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function getFileStream(
  key: string,
): Promise<{ metadata: StoredFile; stream: Readable } | null> {
  const manifest = await readManifest();
  const metadata = manifest[key];
  if (!metadata) {
    return null;
  }

  const filePath = path.join(STORAGE_ROOT, key);
  try {
    const stream = createReadStream(filePath);
    return { metadata, stream };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function removeFile(key: string): Promise<void> {
  const manifest = await readManifest();
  if (!manifest[key]) {
    return;
  }

  const filePath = path.join(STORAGE_ROOT, key);
  await fs.rm(filePath, { force: true });
  delete manifest[key];
  await writeManifest(manifest);
}
