export class CdxError extends Error {
    code;
    exitCode;
    constructor(code, message, exitCode = 1) {
        super(message);
        this.name = "CdxError";
        this.code = code;
        this.exitCode = exitCode;
    }
}
export function toErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=errors.js.map