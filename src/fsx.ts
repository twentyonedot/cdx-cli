import fs from "node:fs";
import path from "node:path";
import { CdxError } from "./errors.js";

export function ensurePrivateDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dirPath, 0o700);
  } catch {
    // chmod is best-effort on platforms that do not support POSIX permissions.
  }
}

export function ensureParentDir(filePath: string): void {
  ensurePrivateDir(path.dirname(filePath));
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeFileAtomic(filePath: string, data: string, mode = 0o600): void {
  ensureParentDir(filePath);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, data, { mode });
  fs.renameSync(tmpPath, filePath);
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // chmod is best-effort on Windows.
  }
}

export function writeJsonAtomic(filePath: string, value: unknown, mode = 0o600): void {
  writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`, mode);
}

export function readOptionalJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJsonFile<T>(filePath);
}

export function copyFilePrivate(sourcePath: string, targetPath: string): void {
  ensureParentDir(targetPath);
  fs.copyFileSync(sourcePath, targetPath);
  try {
    fs.chmodSync(targetPath, 0o600);
  } catch {
    // chmod is best-effort on Windows.
  }
}

export function assertInsideDir(parentDir: string, targetPath: string): void {
  const relative = path.relative(parentDir, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CdxError("unsafe-path", `Refusing to access path outside ${parentDir}`);
  }
}

export function safeRemoveDir(dirPath: string): void {
  if (!dirPath) {
    return;
  }
  fs.rmSync(dirPath, { recursive: true, force: true });
}
