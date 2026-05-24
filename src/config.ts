import { CdxError } from "./errors.js";
import { readOptionalJson, writeJsonAtomic } from "./fsx.js";
import { getPaths } from "./paths.js";

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

export const DEFAULT_AUTOSWITCH_CONFIG: AutoswitchConfig = {
  intervalSeconds: 60,
  triggerFiveHourPercent: 10,
  minFiveHourPercent: 25,
  minSevenDayPercent: 25,
  cooldownMinutes: 15
};

export function defaultConfig(): CdxConfig {
  return { version: 1, autoswitch: DEFAULT_AUTOSWITCH_CONFIG };
}

export function loadConfig(): CdxConfig {
  const parsed = readOptionalJson<Partial<CdxConfig>>(getPaths().configPath);
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

export function saveConfig(config: CdxConfig): void {
  writeJsonAtomic(getPaths().configPath, config);
}

function assertPercent(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new CdxError("invalid-config", `${name} must be a number from 0 to 100.`);
  }
}

export function validateAutoswitchConfig(config: AutoswitchConfig): AutoswitchConfig {
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

export function updateAutoswitchConfig(patch: Partial<AutoswitchConfig>): CdxConfig {
  const current = loadConfig();
  const next = {
    version: 1 as const,
    autoswitch: validateAutoswitchConfig({
      ...current.autoswitch,
      ...patch
    })
  };
  saveConfig(next);
  return next;
}

export function resetAutoswitchConfig(): CdxConfig {
  const next = defaultConfig();
  saveConfig(next);
  return next;
}
