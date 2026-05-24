export interface CdxPaths {
    home: string;
    accountsDir: string;
    runtimeDir: string;
    logsDir: string;
    tempDir: string;
    locksDir: string;
    configPath: string;
    indexPath: string;
    proxyStatePath: string;
    daemonPidPath: string;
    daemonLogPath: string;
    daemonErrorLogPath: string;
    autoswitchStatePath: string;
}
export declare function resolveCdxHome(): string;
export declare function resolveCodexHome(): string;
export declare function getPaths(home?: string): CdxPaths;
export declare function getCodexConfigPath(codexHome?: string): string;
