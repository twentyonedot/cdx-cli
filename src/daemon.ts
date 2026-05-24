import fs from "node:fs";
import { spawn } from "node:child_process";
import { CdxError } from "./errors.js";
import { ensurePrivateDir, writeFileAtomic } from "./fsx.js";
import { getPaths } from "./paths.js";
import { processIsAlive } from "./proxy.js";

export interface DaemonStatus {
  readonly running: boolean;
  readonly pid: number | null;
  readonly pidPath: string;
  readonly logPath: string;
  readonly errorLogPath: string;
}

function readPid(): number | null {
  const pidPath = getPaths().daemonPidPath;
  if (!fs.existsSync(pidPath)) {
    return null;
  }
  const pid = Number(fs.readFileSync(pidPath, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function daemonStatus(): DaemonStatus {
  const paths = getPaths();
  const pid = readPid();
  const running = processIsAlive(pid);
  if (pid && !running) {
    fs.rmSync(paths.daemonPidPath, { force: true });
  }
  return {
    running,
    pid: running ? pid : null,
    pidPath: paths.daemonPidPath,
    logPath: paths.daemonLogPath,
    errorLogPath: paths.daemonErrorLogPath
  };
}

export function startDaemon(): DaemonStatus {
  const status = daemonStatus();
  if (status.running) {
    return status;
  }
  const paths = getPaths();
  ensurePrivateDir(paths.runtimeDir);
  ensurePrivateDir(paths.logsDir);
  const out = fs.openSync(paths.daemonLogPath, "a");
  const err = fs.openSync(paths.daemonErrorLogPath, "a");
  const child = spawn(process.execPath, [new URL("../dist/cli.js", import.meta.url).pathname, "__daemon"], {
    detached: true,
    stdio: ["ignore", out, err],
    env: process.env
  });
  child.unref();
  if (!child.pid) {
    throw new CdxError("daemon-start-failed", "Daemon process did not report a pid.");
  }
  writeFileAtomic(paths.daemonPidPath, `${child.pid}\n`);
  return daemonStatus();
}

export function stopDaemon(): DaemonStatus {
  const status = daemonStatus();
  if (!status.running || !status.pid) {
    return status;
  }
  process.kill(status.pid, "SIGTERM");
  fs.rmSync(getPaths().daemonPidPath, { force: true });
  return daemonStatus();
}
