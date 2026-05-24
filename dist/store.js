import fs from "node:fs";
import path from "node:path";
import { parseAuthFile, redactedAuthInfo } from "./auth.js";
import { CdxError } from "./errors.js";
import { assertInsideDir, copyFilePrivate, ensurePrivateDir, readOptionalJson, writeJsonAtomic } from "./fsx.js";
import { validateLabel } from "./labels.js";
import { getPaths } from "./paths.js";
function emptyIndex() {
    return { version: 1, accounts: [] };
}
export function loadAccountIndex() {
    const paths = getPaths();
    const parsed = readOptionalJson(paths.indexPath);
    if (!parsed) {
        return emptyIndex();
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) {
        throw new CdxError("invalid-index", "Account index is malformed.");
    }
    return parsed;
}
export function saveAccountIndex(index) {
    writeJsonAtomic(getPaths().indexPath, index);
}
export function snapshotPathFor(fileName) {
    const paths = getPaths();
    const snapshotPath = path.join(paths.accountsDir, fileName);
    assertInsideDir(paths.accountsDir, snapshotPath);
    return snapshotPath;
}
function selectedRecordKey() {
    const paths = getPaths();
    const state = readOptionalJson(paths.proxyStatePath);
    return typeof state?.selectedRecordKey === "string" ? state.selectedRecordKey : null;
}
export function listAccounts() {
    const index = loadAccountIndex();
    const selected = selectedRecordKey();
    return index.accounts
        .map((account) => {
        const snapshotPath = snapshotPathFor(account.snapshotFile);
        const snapshotExists = fs.existsSync(snapshotPath);
        let issue = null;
        if (!snapshotExists) {
            issue = "snapshot missing";
        }
        else {
            try {
                parseAuthFile(snapshotPath);
            }
            catch (error) {
                issue = error instanceof Error ? error.message : String(error);
            }
        }
        return {
            ...account,
            snapshotPath,
            snapshotExists,
            selected: selected === account.recordKey,
            eligible: snapshotExists && !issue,
            issue
        };
    })
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}
export function requireAccount(label) {
    const normalized = validateLabel(label);
    const match = listAccounts().find((account) => account.label === normalized);
    if (!match) {
        throw new CdxError("account-not-found", `No saved account matched "${normalized}".`);
    }
    if (!match.snapshotExists) {
        throw new CdxError("snapshot-missing", `Saved account "${normalized}" is missing its snapshot file.`);
    }
    if (match.issue) {
        throw new CdxError("invalid-snapshot", `Saved account "${normalized}" is invalid: ${match.issue}`);
    }
    return match;
}
export function upsertAccountFromSnapshot(label, sourceAuthPath, expectedRecordKey) {
    const normalized = validateLabel(label);
    const info = parseAuthFile(sourceAuthPath);
    if (expectedRecordKey && info.recordKey !== expectedRecordKey) {
        throw new CdxError("identity-mismatch", "The refreshed login is a different ChatGPT/Codex account.");
    }
    const paths = getPaths();
    ensurePrivateDir(paths.accountsDir);
    const index = loadAccountIndex();
    const now = new Date().toISOString();
    const existingWithLabel = index.accounts.find((account) => account.label === normalized && account.recordKey !== info.recordKey);
    if (existingWithLabel) {
        throw new CdxError("duplicate-label", `Label "${normalized}" already belongs to another account.`);
    }
    const existing = index.accounts.find((account) => account.recordKey === info.recordKey);
    const snapshotPath = snapshotPathFor(info.snapshotFile);
    copyFilePrivate(sourceAuthPath, snapshotPath);
    const nextAccount = {
        label: normalized,
        recordKey: info.recordKey,
        email: info.email,
        userId: info.userId,
        accountId: info.accountId,
        plan: info.plan,
        snapshotFile: info.snapshotFile,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        lastSelectedAt: existing?.lastSelectedAt || null
    };
    const accounts = [
        ...index.accounts.filter((account) => account.recordKey !== info.recordKey),
        nextAccount
    ];
    saveAccountIndex({ version: 1, accounts });
    return nextAccount;
}
export function removeAccount(label, force) {
    const target = requireAccount(label);
    if (target.selected && !force) {
        throw new CdxError("account-selected", `Refusing to remove selected account "${target.label}" while proxy selection points at it.`);
    }
    const index = loadAccountIndex();
    const accounts = index.accounts.filter((account) => account.recordKey !== target.recordKey);
    saveAccountIndex({ version: 1, accounts });
    fs.rmSync(target.snapshotPath, { force: true });
    return target;
}
export function markSelected(recordKey) {
    const index = loadAccountIndex();
    const now = new Date().toISOString();
    saveAccountIndex({
        version: 1,
        accounts: index.accounts.map((account) => account.recordKey === recordKey
            ? { ...account, lastSelectedAt: now }
            : account)
    });
}
export function accountWithAuth(account) {
    return { account, auth: parseAuthFile(account.snapshotPath) };
}
export function serializeAccount(account) {
    return {
        label: account.label,
        email: account.email,
        plan: account.plan,
        recordKey: account.recordKey,
        selected: account.selected,
        eligible: account.eligible,
        snapshotExists: account.snapshotExists,
        issue: account.issue,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastSelectedAt: account.lastSelectedAt
    };
}
export function summarizeSnapshot(snapshotPath) {
    return redactedAuthInfo(parseAuthFile(snapshotPath));
}
//# sourceMappingURL=store.js.map