export declare class CdxError extends Error {
    readonly code: string;
    readonly exitCode: number;
    constructor(code: string, message: string, exitCode?: number);
}
export declare function toErrorMessage(error: unknown): string;
