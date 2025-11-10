import fs from 'fs-extra';
import path from 'path';

export async function readJsonSafe<T = any>(filePath: string, fallback: T | null = null): Promise<T | null> {
  try {
    return await fs.readJson(filePath);
  } catch {
    return fallback;
  }
}

export async function writeJsonSafe(filePath: string, data: unknown, spaces = 2) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces });
}

export async function ensureDirectory(dirPath: string) {
  await fs.ensureDir(dirPath);
}

export const fileExists = fs.pathExists;
