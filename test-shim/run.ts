import { readdir, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";

async function collectTests(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir);
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      await collectTests(fullPath, acc);
      continue;
    }
    if (extname(entry) === ".ts" && entry.endsWith(".test.ts")) {
      acc.push(fullPath);
    }
  }
  return acc;
}

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/test";

async function main() {
  const root = resolve(process.cwd(), "server");
  const files = await collectTests(root);
  files.sort();

  for (const file of files) {
    await import(file);
  }
}

void main();
