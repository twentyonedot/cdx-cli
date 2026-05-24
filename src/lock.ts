import fs from "node:fs";
import path from "node:path";
import { CdxError } from "./errors.js";
import { ensurePrivateDir } from "./fsx.js";
import { getPaths } from "./paths.js";

export interface LockHandle {
  readonly path: string;
  release(): void;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

export function acquireLock(name: string): LockHandle {
  const locksDir = getPaths().locksDir;
  ensurePrivateDir(locksDir);
  const lockPath = path.join(locksDir, `${name}.lock`);

  try {
    const fd = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(fd, `${process.pid}\n`);
    fs.closeSync(fd);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
      throw error;
    }

    const pidText = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8").trim() : "";
    const pid = Number(pidText);
    if (Number.isInteger(pid) && pid > 0 && processIsAlive(pid)) {
      throw new CdxError("lock-busy", `Another cdx operation is already running for ${name}.`);
    }

    fs.rmSync(lockPath, { force: true });
    const fd = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(fd, `${process.pid}\n`);
    fs.closeSync(fd);
  }

  return {
    path: lockPath,
    release() {
      try {
        const text = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8").trim() : "";
        if (text === String(process.pid)) {
          fs.rmSync(lockPath, { force: true });
        }
      } catch {
        // Best effort release. Stale locks are cleaned on next acquisition.
      }
    }
  };
}

export function withLock<T>(name: string, fn: () => T): T {
  const lock = acquireLock(name);
  try {
    return fn();
  } finally {
    lock.release();
  }
}

export async function withLockAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const lock = acquireLock(name);
  try {
    return await fn();
  } finally {
    lock.release();
  }
}
