export interface CodexInvocation {
    readonly command: string;
    readonly args: readonly string[];
    readonly display: string;
}
export interface CodexCompatibility {
    readonly available: boolean;
    readonly command: string;
    readonly version: string | null;
    readonly supported: boolean;
    readonly issue: string | null;
}
export declare function resolveCodexInvocation(): CodexInvocation;
export declare function detectCodexCompatibility(): CodexCompatibility;
export declare function assertCodexAvailable(): CodexInvocation;
export declare function runIsolatedCodexLogin(): string;
export declare function codexConfigHome(): string;
