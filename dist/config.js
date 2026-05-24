import { CdxError } from "./errors.js";
import { readOptionalJson, writeJsonAtomic } from "./fsx.js";
import { getPaths } from "./paths.js";
export const DEFAULT_AUTOSWITCH_CONFIG = {
    intervalSeconds: 60,
    triggerFiveHourPercent: 10,
    minFiveHourPercent: 25,
    minSevenDayPercent: 25,
    cooldownMinutes: 15
};
export function defaultConfig() {
    return { version: 1, autoswitch: DEFAULT_AUTOSWITCH_CONFIG };
}
export function loadConfig() {
    const parsed = readOptionalJson(getPaths().configPath);
    if (!parsed) {
        return defaultConfig();
    }
    return {
        version: 1,
        autoswitch: validateAutoswitchConfig({
            ...DEFAULT_AUTOSWITCH_CONFIG,
            ...parsed.autoswitch
        })
    };
}
export function saveConfig(config) {
    writeJsonAtomic(getPaths().configPath, config);
}
function assertPercent(name, value) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new CdxError("invalid-config", `${name} must be a number from 0 to 100.`);
    }
}
export function validateAutoswitchConfig(config) {
    if (!Number.isFinite(config.intervalSeconds) || config.intervalSeconds < 30) {
        throw new CdxError("invalid-config", "intervalSeconds must be at least 30.");
    }
    if (!Number.isFinite(config.cooldownMinutes) || config.cooldownMinutes < 0) {
        throw new CdxError("invalid-config", "cooldownMinutes must be zero or greater.");
    }
    assertPercent("triggerFiveHourPercent", config.triggerFiveHourPercent);
    assertPercent("minFiveHourPercent", config.minFiveHourPercent);
    assertPercent("minSevenDayPercent", config.minSevenDayPercent);
    return {
        intervalSeconds: Math.floor(config.intervalSeconds),
        triggerFiveHourPercent: config.triggerFiveHourPercent,
        minFiveHourPercent: config.minFiveHourPercent,
        minSevenDayPercent: config.minSevenDayPercent,
        cooldownMinutes: config.cooldownMinutes
    };
}
export function updateAutoswitchConfig(patch) {
    const current = loadConfig();
    const next = {
        version: 1,
        autoswitch: validateAutoswitchConfig({
            ...current.autoswitch,
            ...patch
        })
    };
    saveConfig(next);
    return next;
}
export function resetAutoswitchConfig() {
    const next = defaultConfig();
    saveConfig(next);
    return next;
}
//# sourceMappingURL=config.js.map