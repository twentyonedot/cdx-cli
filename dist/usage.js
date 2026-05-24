import { parseAuthFile } from "./auth.js";
import { CdxError } from "./errors.js";
const USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
function normalizeWindow(window) {
    if (!window) {
        return null;
    }
    const minutes = typeof window.window_minutes === "number"
        ? window.window_minutes
        : typeof window.limit_window_seconds === "number"
            ? Math.ceil(window.limit_window_seconds / 60)
            : null;
    const usedPercent = typeof window.used_percent === "number" ? window.used_percent : null;
    if (minutes === null || usedPercent === null) {
        return null;
    }
    return {
        windowMinutes: minutes,
        usedPercent,
        resetsAt: typeof window.reset_at === "number" ? new Date(window.reset_at * 1000).toISOString() : null
    };
}
function pickWindow(windows, minutes) {
    return windows.find((window) => window?.windowMinutes === minutes) || null;
}
export function remainingPercent(window) {
    return window ? Math.max(0, Math.min(100, Math.round((100 - window.usedPercent) * 10) / 10)) : null;
}
export async function fetchUsage(account) {
    const auth = parseAuthFile(account.snapshotPath);
    if (!auth.accessToken || !auth.accountId) {
        throw new CdxError("usage-unavailable", `Account "${account.label}" is missing live usage credentials.`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(USAGE_ENDPOINT, {
            headers: {
                Authorization: `Bearer ${auth.accessToken}`,
                "ChatGPT-Account-Id": auth.accountId,
                "User-Agent": "@twentyonedot/cdx-cli"
            },
            signal: controller.signal
        });
        const text = await response.text();
        if (!response.ok) {
            throw new CdxError("usage-unavailable", `Usage request failed for "${account.label}" with ${response.status}.`);
        }
        const raw = JSON.parse(text);
        const primary = normalizeWindow(raw.rate_limit?.primary_window || raw.primary);
        const secondary = normalizeWindow(raw.rate_limit?.secondary_window || raw.secondary);
        const windows = [primary, secondary];
        const fiveHour = pickWindow(windows, 300);
        const sevenDay = pickWindow(windows, 10080);
        if (!fiveHour && !sevenDay) {
            throw new CdxError("usage-unavailable", `Usage response for "${account.label}" did not include supported windows.`);
        }
        return { source: "live", checkedAt: new Date().toISOString(), fiveHour, sevenDay };
    }
    finally {
        clearTimeout(timeout);
    }
}
//# sourceMappingURL=usage.js.map