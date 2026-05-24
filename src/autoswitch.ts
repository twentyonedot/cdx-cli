import fs from "node:fs";
import { DEFAULT_AUTOSWITCH_CONFIG, loadConfig, type AutoswitchConfig } from "./config.js";
import { CdxError } from "./errors.js";
import { readOptionalJson, writeJsonAtomic } from "./fsx.js";
import { getPaths } from "./paths.js";
import { readProxyState, selectProxyAccount } from "./proxy.js";
import { listAccounts, type AccountView } from "./store.js";
import { fetchUsage, remainingPercent, type UsageSnapshot } from "./usage.js";

export interface AccountUsage {
  readonly account: AccountView;
  readonly usage: UsageSnapshot | null;
  readonly issue: string | null;
  readonly fiveHourLeft: number | null;
  readonly sevenDayLeft: number | null;
  readonly checkedAt: string | null;
}

export interface AutoswitchDecision {
  readonly checkedAt: string;
  readonly action: "none" | "would-switch" | "switch";
  readonly applied: boolean;
  readonly reason: string;
  readonly current: AccountUsage | null;
  readonly candidate: AccountUsage | null;
  readonly cooldownRemainingMs: number;
  readonly config: AutoswitchConfig;
}

interface AutoswitchState {
  readonly lastAppliedAt?: string;
  readonly lastDecision?: AutoswitchDecision;
}

function loadAutoswitchState(): AutoswitchState {
  return readOptionalJson<AutoswitchState>(getPaths().autoswitchStatePath) || {};
}

function saveAutoswitchDecision(decision: AutoswitchDecision): void {
  const previous = loadAutoswitchState();
  writeJsonAtomic(getPaths().autoswitchStatePath, {
    lastAppliedAt: decision.applied ? decision.checkedAt : previous.lastAppliedAt,
    lastDecision: decision
  });
}

function cooldownRemainingMs(config: AutoswitchConfig, nowMs: number): number {
  const last = loadAutoswitchState().lastAppliedAt;
  if (!last) {
    return 0;
  }
  const lastMs = Date.parse(last);
  if (!Number.isFinite(lastMs)) {
    return 0;
  }
  return Math.max(0, (lastMs + config.cooldownMinutes * 60_000) - nowMs);
}

async function usageFor(account: AccountView): Promise<AccountUsage> {
  try {
    const usage = await fetchUsage(account);
    return {
      account,
      usage,
      issue: null,
      fiveHourLeft: remainingPercent(usage.fiveHour),
      sevenDayLeft: remainingPercent(usage.sevenDay),
      checkedAt: usage.checkedAt
    };
  } catch (error) {
    return {
      account,
      usage: null,
      issue: error instanceof Error ? error.message : String(error),
      fiveHourLeft: null,
      sevenDayLeft: null,
      checkedAt: null
    };
  }
}

function selectedAccount(accounts: readonly AccountView[]): AccountView | null {
  const state = readProxyState();
  if (state.selectedRecordKey) {
    return accounts.find((account) => account.recordKey === state.selectedRecordKey) || null;
  }
  return accounts.find((account) => account.selected) || null;
}

function eligibleCandidate(current: AccountUsage, candidate: AccountUsage, config: AutoswitchConfig): boolean {
  if (candidate.account.recordKey === current.account.recordKey) {
    return false;
  }
  if (candidate.issue || !candidate.account.eligible) {
    return false;
  }
  if (candidate.fiveHourLeft === null || candidate.sevenDayLeft === null) {
    return false;
  }
  return candidate.fiveHourLeft >= config.minFiveHourPercent && candidate.sevenDayLeft >= config.minSevenDayPercent;
}

function rankCandidates(left: AccountUsage, right: AccountUsage): number {
  const leftFive = left.fiveHourLeft ?? -1;
  const rightFive = right.fiveHourLeft ?? -1;
  if (rightFive !== leftFive) {
    return rightFive - leftFive;
  }
  const leftSeven = left.sevenDayLeft ?? -1;
  const rightSeven = right.sevenDayLeft ?? -1;
  if (rightSeven !== leftSeven) {
    return rightSeven - leftSeven;
  }
  return (Date.parse(right.checkedAt || "") || 0) - (Date.parse(left.checkedAt || "") || 0);
}

export async function buildAutoswitchDecision(apply: boolean, overrideConfig?: Partial<AutoswitchConfig>): Promise<AutoswitchDecision> {
  const config = { ...loadConfig().autoswitch, ...overrideConfig };
  const checkedAt = new Date().toISOString();
  const nowMs = Date.parse(checkedAt);
  const accounts = listAccounts().filter((account) => account.eligible);
  const selected = selectedAccount(accounts);
  const cooldown = cooldownRemainingMs(config, nowMs);

  if (!selected) {
    return { checkedAt, action: "none", applied: false, reason: "No selected account. Run `cdx use <label>` or `cdx autoswitch enable <label>`.", current: null, candidate: null, cooldownRemainingMs: cooldown, config };
  }

  const current = await usageFor(selected);
  if (current.issue || current.fiveHourLeft === null) {
    return { checkedAt, action: "none", applied: false, reason: `Current account usage is unavailable: ${current.issue || "missing 5h window"}.`, current, candidate: null, cooldownRemainingMs: cooldown, config };
  }
  if (current.fiveHourLeft >= config.triggerFiveHourPercent) {
    return { checkedAt, action: "none", applied: false, reason: `Current account still has ${current.fiveHourLeft}% remaining in the 5h window.`, current, candidate: null, cooldownRemainingMs: cooldown, config };
  }
  if (cooldown > 0) {
    return { checkedAt, action: "none", applied: false, reason: "Autoswitch cooldown is active.", current, candidate: null, cooldownRemainingMs: cooldown, config };
  }

  const usages = await Promise.all(accounts.map((account) => usageFor(account)));
  const candidate = usages
    .filter((entry) => eligibleCandidate(current, entry, config))
    .sort(rankCandidates)[0] || null;

  if (!candidate) {
    return { checkedAt, action: "none", applied: false, reason: "No eligible candidate account met the configured thresholds.", current, candidate: null, cooldownRemainingMs: 0, config };
  }

  if (!apply) {
    return { checkedAt, action: "would-switch", applied: false, reason: `Would switch from ${current.account.label} to ${candidate.account.label}.`, current, candidate, cooldownRemainingMs: 0, config };
  }

  selectProxyAccount(candidate.account.label);
  return { checkedAt, action: "switch", applied: true, reason: `Switched from ${current.account.label} to ${candidate.account.label}.`, current, candidate, cooldownRemainingMs: 0, config };
}

export async function runAutoswitch(apply: boolean, overrideConfig?: Partial<AutoswitchConfig>): Promise<AutoswitchDecision> {
  const decision = await buildAutoswitchDecision(apply, overrideConfig);
  saveAutoswitchDecision(decision);
  return decision;
}

export function latestAutoswitchDecision(): AutoswitchDecision | null {
  return loadAutoswitchState().lastDecision || null;
}

export async function autoswitchLoop(): Promise<void> {
  fs.mkdirSync(getPaths().logsDir, { recursive: true });
  const config = loadConfig().autoswitch || DEFAULT_AUTOSWITCH_CONFIG;
  for (;;) {
    const decision = await runAutoswitch(true);
    fs.appendFileSync(getPaths().daemonLogPath, `${JSON.stringify({ type: "decision", decision })}\n`);
    await new Promise((resolve) => setTimeout(resolve, config.intervalSeconds * 1000));
  }
}

export function assertAutoswitchReady(): void {
  const state = readProxyState();
  if (!state.enabled || !state.token) {
    throw new CdxError("autoswitch-disabled", "Autoswitch proxy mode is not enabled.");
  }
}
