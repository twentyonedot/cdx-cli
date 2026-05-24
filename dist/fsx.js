import fs from "node:fs";
import path from "node:path";
import { CdxError } from "./errors.js";
export function ensurePrivateDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
    try {
        fs.chmodSync(dirPath, 0o700);
    }
    catch {
        // chmod is best-effort on platforms that do not support POSIX permissions.
    }
}
export function ensureParentDir(filePath) {
    ensurePrivateDir(path.dirname(filePath));
}
export function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
export function writeFileAtomic(filePath, data, mode = 0o600) {
    ensureParentDir(filePath);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, data, { mode });
    fs.renameSync(tmpPath, filePath);
    try {
        fs.chmodSync(filePath, mode);
    }
    catch {
        // chmod is best-effort on Windows.
    }
}
export function writeJsonAtomic(filePath, value, mode = 0o600) {
    writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`, mode);
}
export function readOptionalJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return readJsonFile(filePath);
}
export function copyFilePrivate(sourcePath, targetPath) {
    ensureParentDir(targetPath);
    fs.copyFileSync(sourcePath, targetPath);
    try {
        fs.chmodSync(targetPath, 0o600);
    }
    catch {
        // chmod is best-effort on Windows.
    }
}
export function assertInsideDir(parentDir, targetPath) {
    const relative = path.relative(parentDir, targetPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new CdxError("unsafe-path", `Refusing to access path outside ${parentDir}`);
    }
}
export function safeRemoveDir(dirPath) {
    if (!dirPath) {
        return;
    }
    fs.rmSync(dirPath, { recursive: true, force: true });
}
//# sourceMappingURL=fsx.js.map