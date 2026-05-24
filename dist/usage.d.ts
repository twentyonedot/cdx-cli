import type { AccountView } from "./store.js";
export interface UsageWindow {
    readonly windowMinutes: number;
    readonly usedPercent: number;
    readonly resetsAt: string | null;
}
export interface UsageSnapshot {
    readonly source: "live";
    readonly checkedAt: string;
    readonly fiveHour: UsageWindow | null;
    readonly sevenDay: UsageWindow | null;
}
export declare function remainingPercent(window: UsageWindow | null): number | null;
export declare function fetchUsage(account: AccountView): Promise<UsageSnapshot>;
