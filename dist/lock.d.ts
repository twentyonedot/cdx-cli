export interface LockHandle {
    readonly path: string;
    release(): void;
}
export declare function acquireLock(name: string): LockHandle;
export declare function withLock<T>(name: string, fn: () => T): T;
export declare function withLockAsync<T>(name: string, fn: () => Promise<T>): Promise<T>;
