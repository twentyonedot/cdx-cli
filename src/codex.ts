import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CdxError } from "./errors.js";
import { ensurePrivateDir, safeRemoveDir } from "./fsx.js";
import { getPaths, resolveCodexHome } from "./paths.js";

export interface CodexInvocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly display: string;
}

export interface CodexCompatibility {
  readonly available: boolean;
  readonly command: string;
  readonly version: string | null;
  readonly supported: boolean;
  readonly issue: string | null;
}

export function resolveCodexInvocation(): CodexInvocation {
  const candidates = [
    process.env.CDX_CODEX_BIN,
    process.env.CODEX_BIN,
    "codex"
  ].filter((candidate): candidate is string => Boolean(candidate));
  const command = candidates[0] || "codex";
  return { command, args: [], display: command };
}

export function detectCodexCompatibility(): CodexCompatibility {
  const invocation = resolveCodexInvocation();
  const result = spawnSync(invocation.command, [...invocation.args, "--version"], {
    encoding: "utf8",
    timeout: 5000
  });
  if (result.error) {
    return {
      available: false,
      command: invocation.display,
      version: null,
      supported: false,
      issue: result.error.message
    };
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const version = output.match(/\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/)?.[1] || null;
  return {
    available: (result.status ?? 1) === 0,
    command: invocation.display,
    version,
    supported: (result.status ?? 1) === 0,
    issue: (result.status ?? 1) === 0 ? null : output.trim() || "codex --version failed"
  };
}

export function assertCodexAvailable(): CodexInvocation {
  const compatibility = detectCodexCompatibility();
  if (!compatibility.available || !compatibility.supported) {
    throw new CdxError("codex-unavailable", `Codex CLI is unavailable or unsupported: ${compatibility.issue || "unknown error"}`);
  }
  return resolveCodexInvocation();
}

export function runIsolatedCodexLogin(): string {
  const invocation = assertCodexAvailable();
  const paths = getPaths();
  ensurePrivateDir(paths.tempDir);
  const tempHome = fs.mkdtempSync(path.join(paths.tempDir, "login-"));
  ensurePrivateDir(tempHome);
  const result = spawnSync(invocation.command, [...invocation.args, "login", "--device-auth"], {
    stdio: "inherit",
    env: {
      ...process.env,
      CODEX_HOME: tempHome
    }
  });
  if (result.error) {
    safeRemoveDir(tempHome);
    throw new CdxError("codex-login-failed", result.error.message);
  }
  if ((result.status ?? 1) !== 0) {
    safeRemoveDir(tempHome);
    throw new CdxError("codex-login-failed", `codex login failed with exit code ${result.status ?? 1}`);
  }
  const authPath = path.join(tempHome, "auth.json");
  if (!fs.existsSync(authPath)) {
    safeRemoveDir(tempHome);
    throw new CdxError("codex-login-failed", "codex login completed but did not produce auth.json.");
  }
  return tempHome;
}

export function codexConfigHome(): string {
  return resolveCodexHome();
}
