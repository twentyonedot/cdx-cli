# Compatibility

`cdx` is a public beta. It depends on Codex login, local config, and live usage behavior that may change.

No-quit autoswitch depends on Codex honoring the managed proxy configuration written by `cdx autoswitch enable [label]`. Manual snapshot commands work without proxy mode, but automatic switching for an already-running Codex session requires the proxy path.

The CLI performs best-effort compatibility checks through:

```bash
cdx doctor
```

Supported runtime:

- Node.js `>=20`
- macOS, Linux, and Windows for the public CLI and manual-start daemon
- ChatGPT/Codex device-auth snapshots only for autoswitch eligibility

Deferred from v1:

- API-key autoswitch
- OS service installers
- Codex.app relaunch. Proxy mode is the intended no-quit path.
- Codex Desktop sidebar or thread-state repair
