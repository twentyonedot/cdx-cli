# cdx

`cdx` is a public beta CLI for automatic Codex account switching. It stores local snapshots for ChatGPT/Codex logins that you own or are authorized to use, then switches the active account behind an authenticated loopback proxy when usage thresholds are reached.

It is designed for one user managing their own Codex access. It is not a credential-sharing, pooling, or account-resale tool.

## Install

```bash
npm install -g @twentyonedot/cdx-cli
```

## Quick Start

```bash
cdx add work
cdx add personal
cdx autoswitch enable work
cdx autoswitch status
```

`cdx add <label>` runs `codex login --device-auth` in an isolated temporary `CODEX_HOME`, imports the resulting login snapshot, and removes the temporary folder. It does not overwrite your active `~/.codex/auth.json`.

## What It Touches

- `~/.cdx/accounts/` for encrypted/auth-sensitive local snapshots.
- `~/.cdx/config.json` for autoswitch thresholds.
- `~/.cdx/runtime/` and `~/.cdx/logs/` for daemon/proxy state.
- A marked managed block in `~/.codex/config.toml` when autoswitch is enabled.

Disable and restore with:

```bash
cdx autoswitch disable
```

## Core Commands

```bash
cdx accounts
cdx use work
cdx usage --all
cdx config autoswitch show
cdx config autoswitch set --trigger-5h 10 --min-5h 25 --min-7d 25 --cooldown 15
cdx autoswitch run
cdx doctor
```

## Public Beta Notice

Autoswitch depends on Codex local configuration and live account usage behavior. `cdx doctor` checks what it can, but Codex internals may change. Treat this beta as a tool with explicit disable/restore steps, not invisible infrastructure.

See:

- [Autoswitch guide](docs/autoswitch.md)
- [Command reference](docs/commands.md)
- [Security model](docs/security.md)
- [Compatibility](docs/compatibility.md)
