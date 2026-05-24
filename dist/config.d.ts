export interface AutoswitchConfig {
    readonly intervalSeconds: number;
    readonly triggerFiveHourPercent: number;
    readonly minFiveHourPercent: number;
    readonly minSevenDayPercent: number;
    readonly cooldownMinutes: number;
}
export interface CdxConfig {
    readonly version: 1;
    readonly autoswitch: AutoswitchConfig;
}
export declare const DEFAULT_AUTOSWITCH_CONFIG: AutoswitchConfig;
export declare function defaultConfig(): CdxConfig;
export declare function loadConfig(): CdxConfig;
export declare function saveConfig(config: CdxConfig): void;
export declare function validateAutoswitchConfig(config: AutoswitchConfig): AutoswitchConfig;
export declare function updateAutoswitchConfig(patch: Partial<AutoswitchConfig>): CdxConfig;
export declare function resetAutoswitchConfig(): CdxConfig;
