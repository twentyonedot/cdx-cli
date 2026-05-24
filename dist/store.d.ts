import { redactedAuthInfo, type AuthInfo } from "./auth.js";
export interface StoredAccount {
    readonly label: string;
    readonly recordKey: string;
    readonly email: string | null;
    readonly userId: string;
    readonly accountId: string;
    readonly plan: string | null;
    readonly snapshotFile: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSelectedAt: string | null;
}
export interface AccountIndex {
    readonly version: 1;
    readonly accounts: readonly StoredAccount[];
}
export interface AccountView extends StoredAccount {
    readonly snapshotPath: string;
    readonly snapshotExists: boolean;
    readonly selected: boolean;
    readonly eligible: boolean;
    readonly issue: string | null;
}
export declare function loadAccountIndex(): AccountIndex;
export declare function saveAccountIndex(index: AccountIndex): void;
export declare function snapshotPathFor(fileName: string): string;
export declare function listAccounts(): AccountView[];
export declare function requireAccount(label: string): AccountView;
export declare function upsertAccountFromSnapshot(label: string, sourceAuthPath: string, expectedRecordKey?: string): StoredAccount;
export declare function removeAccount(label: string, force: boolean): StoredAccount;
export declare function markSelected(recordKey: string): void;
export declare function accountWithAuth(account: AccountView): {
    account: AccountView;
    auth: AuthInfo;
};
export declare function serializeAccount(account: AccountView): Record<string, unknown>;
export declare function summarizeSnapshot(snapshotPath: string): ReturnType<typeof redactedAuthInfo>;
