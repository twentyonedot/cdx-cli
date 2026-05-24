export interface ProxyState {
    readonly enabled: boolean;
    readonly port: number;
    readonly token: string;
    readonly selectedRecordKey: string | null;
    readonly selectedLabel: string | null;
    readonly selectedSnapshotPath: string | null;
    readonly serverPid: number | null;
    readonly configBackupPath: string | null;
    readonly updatedAt: string;
}
export declare function defaultProxyState(): ProxyState;
export declare function readProxyState(): ProxyState;
export declare function writeProxyState(state: ProxyState): void;
export declare function generateProxyToken(): string;
export declare function selectProxyAccount(label: string): ProxyState;
export declare function processIsAlive(pid: number | null): boolean;
export declare function runProxyServer(port?: number): Promise<void>;
export declare function probeSnapshot(snapshotPath: string): void;
