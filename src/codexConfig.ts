import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CdxError } from "./errors.js";
import { ensurePrivateDir, writeFileAtomic } from "./fsx.js";
import { getCodexConfigPath } from "./paths.js";

const BEGIN = "# BEGIN CDX AUTOSWITCH";
const END = "# END CDX AUTOSWITCH";

export interface ManagedConfigState {
  readonly enabled: boolean;
  readonly configPath: string;
  readonly backupPath: string | null;
  readonly previousBlockId: string | null;
}

function stripManagedBlock(text: string): string {
  const pattern = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`, "g");
  return text.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function firstTomlTableIndex(text: string): number {
  const match = text.match(/^\s*\[[^\]]+\]\s*$/m);
  return match?.index ?? -1;
}

function insertRootBlock(text: string, block: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) {
    return `${block}\n`;
  }
  const tableIndex = firstTomlTableIndex(trimmed);
  if (tableIndex < 0) {
    return `${trimmed}\n\n${block}\n`;
  }
  const rootText = trimmed.slice(0, tableIndex).trimEnd();
  const tableText = trimmed.slice(tableIndex).trimStart();
  return `${rootText}\n\n${block}\n\n${tableText}\n`;
}

export function buildManagedBlock(port: number): string {
  return [
    BEGIN,
    `# Managed by cdx. Run "cdx autoswitch disable" to restore.`,
    `openai_base_url = "http://127.0.0.1:${port}/v1"`,
    END
  ].join("\n");
}

export function enableCodexProxyConfig(port: number): ManagedConfigState {
  const configPath = getCodexConfigPath();
  ensurePrivateDir(path.dirname(configPath));
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const backupPath = `${configPath}.bak.cdx.${Date.now()}.${randomUUID()}`;
  writeFileAtomic(backupPath, original);
  const next = insertRootBlock(stripManagedBlock(original), buildManagedBlock(port));
  writeFileAtomic(configPath, next);
  return {
    enabled: true,
    configPath,
    backupPath,
    previousBlockId: null
  };
}

export function disableCodexProxyConfig(backupPath: string | null): ManagedConfigState {
  const configPath = getCodexConfigPath();
  if (backupPath && fs.existsSync(backupPath)) {
    writeFileAtomic(configPath, fs.readFileSync(backupPath, "utf8"));
    return { enabled: false, configPath, backupPath, previousBlockId: null };
  }
  if (!fs.existsSync(configPath)) {
    return { enabled: false, configPath, backupPath: null, previousBlockId: null };
  }
  const current = fs.readFileSync(configPath, "utf8");
  if (!current.includes(BEGIN)) {
    return { enabled: false, configPath, backupPath: null, previousBlockId: null };
  }
  writeFileAtomic(configPath, `${stripManagedBlock(current)}\n`);
  return { enabled: false, configPath, backupPath: null, previousBlockId: null };
}

export function assertManagedConfigPresent(): void {
  const configPath = getCodexConfigPath();
  if (!fs.existsSync(configPath) || !fs.readFileSync(configPath, "utf8").includes(BEGIN)) {
    throw new CdxError("proxy-config-missing", "Codex is not configured for cdx proxy mode. Run `cdx autoswitch enable`.");
  }
}
