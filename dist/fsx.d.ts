export declare function ensurePrivateDir(dirPath: string): void;
export declare function ensureParentDir(filePath: string): void;
export declare function readJsonFile<T>(filePath: string): T;
export declare function writeFileAtomic(filePath: string, data: string, mode?: number): void;
export declare function writeJsonAtomic(filePath: string, value: unknown, mode?: number): void;
export declare function readOptionalJson<T>(filePath: string): T | null;
export declare function copyFilePrivate(sourcePath: string, targetPath: string): void;
export declare function assertInsideDir(parentDir: string, targetPath: string): void;
export declare function safeRemoveDir(dirPath: string): void;
