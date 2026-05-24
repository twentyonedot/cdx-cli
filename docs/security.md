# Security Model

`cdx` is for switching among ChatGPT/Codex accounts that the same user owns or is authorized to use. Do not use it to share, pool, sell, or bypass account access.

## Secret Handling

- Auth snapshots are stored under `~/.cdx/accounts/`.
- Snapshot files and indexes are written with restrictive permissions where the OS supports them.
- CLI output and JSON output never include access tokens, refresh tokens, proxy bearer tokens, raw JWTs, or raw auth JSON.
- `cdx add` and `cdx refresh` use an isolated temporary `CODEX_HOME` and remove it after import.

## Proxy Boundary

Autoswitch uses a loopback-only local proxy. The proxy binds to `127.0.0.1`, generates a random bearer token, and requires that token for HTTP and WebSocket requests.

Proxy mode is opt-in and only enabled by `cdx autoswitch enable [label]`. It is required for no-quit autoswitch because running Codex processes should not be expected to re-read a changed `auth.json`. Manual snapshot management commands do not require the proxy.

Run this to stop the daemon/proxy and restore the managed Codex config block:

```bash
cdx autoswitch disable
```

## Recovery

If something fails midway:

1. Run `cdx autoswitch disable`.
2. Inspect `~/.codex/config.toml`.
3. Restore from the `.bak.cdx.*` backup noted by `cdx autoswitch enable` if needed.
4. Run `cdx doctor --json` to verify state.
