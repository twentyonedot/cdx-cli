import crypto from "node:crypto";
import fs from "node:fs";
import { CdxError } from "./errors.js";
function stringOrNull(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
function firstString(values) {
    for (const value of values) {
        const candidate = stringOrNull(value);
        if (candidate) {
            return candidate;
        }
    }
    return null;
}
export function decodeJwtPayload(idToken) {
    const parts = idToken.split(".");
    if (parts.length !== 3 || !parts[1]) {
        throw new CdxError("invalid-auth", "Auth snapshot contains an invalid id_token.");
    }
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}
export function parseAuthText(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new CdxError("invalid-auth", "Auth snapshot is not valid JSON.");
    }
    const tokens = parsed.tokens;
    const idToken = stringOrNull(tokens?.id_token);
    if (!tokens || !idToken) {
        throw new CdxError("invalid-auth", "Only ChatGPT/Codex device-auth snapshots are supported.");
    }
    const payload = decodeJwtPayload(idToken);
    const claims = payload["https://api.openai.com/auth"] || {};
    const accountId = firstString([tokens.account_id, claims.chatgpt_account_id]);
    const userId = firstString([claims.chatgpt_user_id, claims.user_id]);
    if (!accountId || !userId) {
        throw new CdxError("invalid-auth", "Auth snapshot is missing ChatGPT account identity fields.");
    }
    const email = stringOrNull(payload.email)?.toLowerCase() || null;
    const recordKey = `${userId}::${accountId}`;
    const hash = crypto.createHash("sha256").update(recordKey).digest("hex").slice(0, 24);
    return {
        authMode: "chatgpt",
        email,
        userId,
        accountId,
        recordKey,
        plan: firstString([claims.chatgpt_plan_type]),
        accessToken: stringOrNull(tokens.access_token),
        snapshotFile: `${hash}.auth.json`
    };
}
export function parseAuthFile(filePath) {
    return parseAuthText(fs.readFileSync(filePath, "utf8"));
}
export function redactedAuthInfo(info) {
    return {
        authMode: info.authMode,
        email: info.email,
        userId: info.userId,
        accountId: info.accountId,
        recordKey: info.recordKey,
        plan: info.plan,
        snapshotFile: info.snapshotFile
    };
}
//# sourceMappingURL=auth.js.map