import { type DaemonStatus } from "./daemon.js";
export interface EnableAutoswitchOptions {
    readonly port?: number;
}
export interface EnableAutoswitchResult {
    readonly enabled: true;
    readonly selectedLabel: string;
    readonly port: number;
    readonly daemon: DaemonStatus;
}
export interface AutoswitchRuntimeDeps {
    readonly ensureProxyServer?: (port: number) => Promise<void>;
    readonly startDaemon?: () => DaemonStatus;
}
export declare function ensureProxyServer(port: number): Promise<void>;
export declare function enableAutoswitchRuntime(label: string | undefined, options?: EnableAutoswitchOptions, deps?: AutoswitchRuntimeDeps): Promise<EnableAutoswitchResult>;
