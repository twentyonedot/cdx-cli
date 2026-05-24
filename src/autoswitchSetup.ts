import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { enableCodexProxyConfig } from "./codexConfig.js";
import { daemonStatus, startDaemon, type DaemonStatus } from "./daemon.js";
import { CdxError } from "./errors.js";
import { getPaths } from "./paths.js";
import { generateProxyToken, processIsAlive, readProxyState, selectProxyAccount, writeProxyState } from "./proxy.js";

export interface EnableAutoswitchOptions {
  readonly port?: number;
}

export interface EnableAutoswitchResult {
  readonly enabled: true;
  readonly selectedLabel: string;
  readonly port: number;
  readonly daemon: DaemonStatus;
}

export interface AutoswitchRuntimeDeps {
  readonly ensureProxyServer?: (port: number) => Promise<void>;
  readonly startDaemon?: () => DaemonStatus;
}

export function ensureProxyServer(port: number): Promise<void> {
  const state = readProxyState();
  if (processIsAlive(state.serverPid)) {
    return Promise.resolve();
  }
  const out = fs.openSync(path.join(getPaths().logsDir, "proxy.log"), "a");
  const err = fs.openSync(path.join(getPaths().logsDir, "proxy-error.log"), "a");
  const child = spawn(process.execPath, [new URL("../dist/cli.js", import.meta.url).pathname, "__proxy", "--port", String(port)], {
    detached: true,
    stdio: ["ignore", out, err],
    env: process.env
  });
  child.unref();
  if (!child.pid) {
    throw new CdxError("proxy-start-failed", "Proxy process did not report a pid.");
  }
  writeProxyState({ ...state, enabled: true, port, serverPid: child.pid, updatedAt: new Date().toISOString() });
  return Promise.resolve();
}

export async function enableAutoswitchRuntime(label: string | undefined, options: EnableAutoswitchOptions = {}, deps: AutoswitchRuntimeDeps = {}): Promise<EnableAutoswitchResult> {
  const port = options.port || readProxyState().port || 4141;
  const selected = label ? selectProxyAccount(label) : readProxyState();
  if (!selected.selectedLabel) {
    throw new CdxError("missing-selection", "Add an account with `cdx add [label]` or provide a label: `cdx autoswitch enable <label>`.");
  }
  const portChanged = selected.port !== port;
  if (portChanged && selected.serverPid && processIsAlive(selected.serverPid)) {
    process.kill(selected.serverPid, "SIGTERM");
  }
  const token = selected.token || generateProxyToken();
  const configState = enableCodexProxyConfig(port, selected.configBackupPath);
  writeProxyState({
    ...selected,
    enabled: true,
    port,
    token,
    serverPid: portChanged ? null : selected.serverPid,
    configBackupPath: configState.backupPath,
    updatedAt: new Date().toISOString()
  });
  await (deps.ensureProxyServer || ensureProxyServer)(port);
  const daemon = (deps.startDaemon || startDaemon)();
  return {
    enabled: true,
    selectedLabel: selected.selectedLabel,
    port,
    daemon: daemon.running ? daemon : daemonStatus()
  };
}
