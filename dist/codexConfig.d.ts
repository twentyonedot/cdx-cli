export interface ManagedConfigState {
    readonly enabled: boolean;
    readonly configPath: string;
    readonly backupPath: string | null;
    readonly previousBlockId: string | null;
}
export declare function buildManagedBlock(port: number): string;
export declare function enableCodexProxyConfig(port: number, existingBackupPath?: string | null): ManagedConfigState;
export declare function disableCodexProxyConfig(backupPath: string | null): ManagedConfigState;
export declare function assertManagedConfigPresent(): void;
