import { type AutoswitchConfig } from "./config.js";
import { type AccountView } from "./store.js";
import { type UsageSnapshot } from "./usage.js";
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
export declare function buildAutoswitchDecision(apply: boolean, overrideConfig?: Partial<AutoswitchConfig>): Promise<AutoswitchDecision>;
export declare function runAutoswitch(apply: boolean, overrideConfig?: Partial<AutoswitchConfig>): Promise<AutoswitchDecision>;
export declare function latestAutoswitchDecision(): AutoswitchDecision | null;
export declare function autoswitchLoop(): Promise<void>;
export declare function assertAutoswitchReady(): void;
