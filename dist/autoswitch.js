import fs from "node:fs";
import { DEFAULT_AUTOSWITCH_CONFIG, loadConfig } from "./config.js";
import { CdxError } from "./errors.js";
import { readOptionalJson, writeJsonAtomic } from "./fsx.js";
import { getPaths } from "./paths.js";
import { readProxyState, selectProxyAccount } from "./proxy.js";
import { listAccounts } from "./store.js";
import { fetchUsage, remainingPercent } from "./usage.js";
function loadAutoswitchState() {
    return readOptionalJson(getPaths().autoswitchStatePath) || {};
}
function saveAutoswitchDecision(decision) {
    const previous = loadAutoswitchState();
    writeJsonAtomic(getPaths().autoswitchStatePath, {
        lastAppliedAt: decision.applied ? decision.checkedAt : previous.lastAppliedAt,
        lastDecision: decision
    });
}
function cooldownRemainingMs(config, nowMs) {
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
async function usageFor(account) {
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
    }
    catch (error) {
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
function selectedAccount(accounts) {
    const state = readProxyState();
    if (state.selectedRecordKey) {
        return accounts.find((account) => account.recordKey === state.selectedRecordKey) || null;
    }
    return accounts.find((account) => account.selected) || null;
}
function eligibleCandidate(current, candidate, config) {
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
function rankCandidates(left, right) {
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
export async function buildAutoswitchDecision(apply, overrideConfig) {
    const config = { ...loadConfig().autoswitch, ...overrideConfig };
    const checkedAt = new Date().toISOString();
    const nowMs = Date.parse(checkedAt);
    const accounts = listAccounts().filter((account) => account.eligible);
    const selected = selectedAccount(accounts);
    const cooldown = cooldownRemainingMs(config, nowMs);
    if (!selected) {
        return { checkedAt, action: "none", applied: false, reason: "No selected account. Run `cdx add [label]` or `cdx use <label>`.", current: null, candidate: null, cooldownRemainingMs: cooldown, config };
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
export async function runAutoswitch(apply, overrideConfig) {
    const decision = await buildAutoswitchDecision(apply, overrideConfig);
    saveAutoswitchDecision(decision);
    return decision;
}
export function latestAutoswitchDecision() {
    return loadAutoswitchState().lastDecision || null;
}
export async function autoswitchLoop() {
    fs.mkdirSync(getPaths().logsDir, { recursive: true });
    const config = loadConfig().autoswitch || DEFAULT_AUTOSWITCH_CONFIG;
    for (;;) {
        const decision = await runAutoswitch(true);
        fs.appendFileSync(getPaths().daemonLogPath, `${JSON.stringify({ type: "decision", decision })}\n`);
        await new Promise((resolve) => setTimeout(resolve, config.intervalSeconds * 1000));
    }
}
export function assertAutoswitchReady() {
    const state = readProxyState();
    if (!state.enabled || !state.token) {
        throw new CdxError("autoswitch-disabled", "Autoswitch proxy mode is not enabled.");
    }
}
//# sourceMappingURL=autoswitch.js.map