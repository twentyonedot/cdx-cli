import crypto from "node:crypto";
import http from "node:http";
import tls from "node:tls";
import { Readable } from "node:stream";
import { parseAuthFile } from "./auth.js";
import { CdxError } from "./errors.js";
import { readOptionalJson, writeJsonAtomic } from "./fsx.js";
import { getPaths } from "./paths.js";
import { accountWithAuth, markSelected, requireAccount } from "./store.js";
const UPSTREAM_BASE_URL = "https://chatgpt.com/backend-api";
const UPSTREAM_HOST = "chatgpt.com";
const UPSTREAM_WS_PATH = "/backend-api/codex/responses";
const DEFAULT_PORT = 4141;
export function defaultProxyState() {
    return {
        enabled: false,
        port: DEFAULT_PORT,
        token: "",
        selectedRecordKey: null,
        selectedLabel: null,
        selectedSnapshotPath: null,
        serverPid: null,
        configBackupPath: null,
        updatedAt: new Date().toISOString()
    };
}
export function readProxyState() {
    return {
        ...defaultProxyState(),
        ...(readOptionalJson(getPaths().proxyStatePath) || {})
    };
}
export function writeProxyState(state) {
    writeJsonAtomic(getPaths().proxyStatePath, state);
}
export function generateProxyToken() {
    return crypto.randomBytes(32).toString("base64url");
}
export function selectProxyAccount(label) {
    const target = requireAccount(label);
    const current = readProxyState();
    const next = {
        ...current,
        selectedRecordKey: target.recordKey,
        selectedLabel: target.label,
        selectedSnapshotPath: target.snapshotPath,
        updatedAt: new Date().toISOString()
    };
    writeProxyState(next);
    markSelected(target.recordKey);
    return next;
}
export function processIsAlive(pid) {
    if (!pid) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error instanceof Error && "code" in error && error.code === "EPERM";
    }
}
function requestToken(req) {
    const header = req.headers.authorization;
    const value = Array.isArray(header)
        ? header.find((entry) => typeof entry === "string")
        : typeof header === "string"
            ? header
            : undefined;
    if (!value?.startsWith("Bearer ")) {
        return null;
    }
    return value.slice("Bearer ".length);
}
function authorized(req, state) {
    return Boolean(state.token && requestToken(req) === state.token);
}
function writeJson(res, status, value) {
    const payload = `${JSON.stringify(value, null, 2)}\n`;
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload)
    });
    res.end(payload);
}
function selectedAccount(state) {
    if (!state.selectedLabel) {
        throw new CdxError("proxy-no-selection", "No proxy account selected. Run `cdx use <label>`.");
    }
    const selected = requireAccount(state.selectedLabel);
    const { auth } = accountWithAuth(selected);
    if (!auth.accessToken || !auth.accountId) {
        throw new CdxError("proxy-invalid-auth", `Selected account "${selected.label}" is missing live credentials.`);
    }
    return { account: selected, accessToken: auth.accessToken, accountId: auth.accountId };
}
function stripRequestHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const lowered = key.toLowerCase();
        if (["host", "authorization", "chatgpt-account-id", "content-length", "connection", "accept-encoding"].includes(lowered)) {
            continue;
        }
        if (typeof value === "string") {
            headers[lowered] = value;
        }
    }
    return headers;
}
function stripUpgradeHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const lowered = key.toLowerCase();
        if (["host", "authorization", "chatgpt-account-id", "connection"].includes(lowered)) {
            continue;
        }
        if (typeof value === "string") {
            headers[lowered] = value;
        }
    }
    return headers;
}
function headerLines(headers) {
    return Object.entries(headers).map(([key, value]) => `${key}: ${value}`);
}
async function collectBody(req) {
    if (req.method === "GET" || req.method === "HEAD") {
        return null;
    }
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks);
}
function upstreamPath(url) {
    if (url.pathname === "/v1/models") {
        return `/codex/models${url.search}`;
    }
    if (url.pathname === "/v1/responses") {
        return "/codex/responses";
    }
    if (url.pathname === "/v1/responses/compact") {
        return "/codex/responses/compact";
    }
    if (url.pathname.startsWith("/backend-api/")) {
        return `${url.pathname.replace(/^\/backend-api/, "")}${url.search}`;
    }
    throw new CdxError("unsupported-route", `Unsupported proxy route: ${url.pathname}`);
}
async function forward(req, res, url, state) {
    const selected = selectedAccount(state);
    const body = await collectBody(req);
    const headers = {
        ...stripRequestHeaders(req),
        Authorization: `Bearer ${selected.accessToken}`,
        "ChatGPT-Account-Id": selected.accountId,
        "User-Agent": "@twentyonedot/cdx-cli"
    };
    const init = {
        method: req.method || "GET",
        headers,
        redirect: "follow"
    };
    if (body) {
        init.body = body;
    }
    const response = await fetch(`${UPSTREAM_BASE_URL}${upstreamPath(url)}`, init);
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
        if (!["content-length", "content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) {
            responseHeaders[key] = value;
        }
    }
    res.writeHead(response.status, responseHeaders);
    if (!response.body) {
        res.end();
        return;
    }
    Readable.fromWeb(response.body).pipe(res);
}
export async function runProxyServer(port = readProxyState().port) {
    const server = http.createServer((req, res) => {
        void (async () => {
            const state = readProxyState();
            if (!authorized(req, state)) {
                writeJson(res, 401, { error: "Unauthorized" });
                return;
            }
            const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
            if (req.method === "GET" && url.pathname === "/health") {
                writeJson(res, 200, {
                    ok: true,
                    selectedLabel: state.selectedLabel,
                    port
                });
                return;
            }
            await forward(req, res, url, state);
        })().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            writeJson(res, 500, { error: message });
        });
    });
    server.on("upgrade", (req, socket, head) => {
        const state = readProxyState();
        if (!authorized(req, state)) {
            socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            socket.destroy();
            return;
        }
        const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
        if (req.method !== "GET" || url.pathname !== "/v1/responses") {
            socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            socket.destroy();
            return;
        }
        try {
            const selected = selectedAccount(state);
            const upstreamSocket = tls.connect({
                host: UPSTREAM_HOST,
                port: 443,
                servername: UPSTREAM_HOST,
                ALPNProtocols: ["http/1.1"]
            });
            upstreamSocket.once("secureConnect", () => {
                const upstreamHeaders = {
                    ...stripUpgradeHeaders(req),
                    Authorization: `Bearer ${selected.accessToken}`,
                    "ChatGPT-Account-Id": selected.accountId,
                    host: UPSTREAM_HOST,
                    connection: "Upgrade",
                    upgrade: "websocket"
                };
                upstreamSocket.write([
                    `GET ${UPSTREAM_WS_PATH}${url.search || ""} HTTP/1.1`,
                    ...headerLines(upstreamHeaders),
                    "",
                    ""
                ].join("\r\n"));
                if (head.length > 0) {
                    upstreamSocket.write(head);
                }
                upstreamSocket.pipe(socket);
                socket.pipe(upstreamSocket);
            });
            upstreamSocket.once("error", () => {
                if (!socket.destroyed) {
                    socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
                    socket.destroy();
                }
            });
            socket.once("error", () => upstreamSocket.destroy());
            socket.once("close", () => upstreamSocket.destroy());
            upstreamSocket.once("close", () => socket.destroy());
        }
        catch {
            socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            socket.destroy();
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
    });
    const state = readProxyState();
    writeProxyState({ ...state, enabled: true, port, serverPid: process.pid, updatedAt: new Date().toISOString() });
    const shutdown = () => {
        server.close(() => process.exit(0));
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
export function probeSnapshot(snapshotPath) {
    parseAuthFile(snapshotPath);
}
//# sourceMappingURL=proxy.js.map