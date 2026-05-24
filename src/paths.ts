import os from "node:os";
import path from "node:path";

export interface CdxPaths {
  home: string;
  accountsDir: string;
  runtimeDir: string;
  logsDir: string;
  tempDir: string;
  locksDir: string;
  configPath: string;
  indexPath: string;
  proxyStatePath: string;
  daemonPidPath: string;
  daemonLogPath: string;
  daemonErrorLogPath: string;
  autoswitchStatePath: string;
}

export function resolveCdxHome(): string {
  return process.env.CDX_HOME || path.join(os.homedir(), ".cdx");
}

export function resolveCodexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

export function getPaths(home = resolveCdxHome()): CdxPaths {
  const accountsDir = path.join(home, "accounts");
  const runtimeDir = path.join(home, "runtime");
  const logsDir = path.join(home, "logs");
  const tempDir = path.join(home, "tmp");
  const locksDir = path.join(home, "locks");
  return {
    home,
    accountsDir,
    runtimeDir,
    logsDir,
    tempDir,
    locksDir,
    configPath: path.join(home, "config.json"),
    indexPath: path.join(accountsDir, "index.json"),
    proxyStatePath: path.join(runtimeDir, "proxy-state.json"),
    daemonPidPath: path.join(runtimeDir, "autoswitch.pid"),
    daemonLogPath: path.join(logsDir, "autoswitch.log"),
    daemonErrorLogPath: path.join(logsDir, "autoswitch-error.log"),
    autoswitchStatePath: path.join(runtimeDir, "autoswitch-state.json")
  };
}

export function getCodexConfigPath(codexHome = resolveCodexHome()): string {
  return path.join(codexHome, "config.toml");
}
