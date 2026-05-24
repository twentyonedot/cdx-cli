export interface DaemonStatus {
    readonly running: boolean;
    readonly pid: number | null;
    readonly pidPath: string;
    readonly logPath: string;
    readonly errorLogPath: string;
}
export declare function daemonStatus(): DaemonStatus;
export declare function startDaemon(): DaemonStatus;
export declare function stopDaemon(): DaemonStatus;
